/**
 * 同期サービス
 *
 * GitHub から D365 アップデート情報を取得してデータベースに保存
 * リポジトリレベル差分チェック + ファイルレベル差分同期
 * 並列処理対応版
 */

import type Database from "better-sqlite3";
import type { SyncResult } from "../types.js";
import {
  getWhatsNewFiles,
  getWhatsNewFilesIncremental,
  fetchAndParseFile,
  getRecentCommits,
  getRecentlyChangedFiles,
  getFileFirstCommitDate,
} from "../api/githubClient.js";
import {
  upsertUpdate,
  upsertCommit,
  updateSyncCheckpoint,
  getSyncCheckpoint,
  updateCommitDate,
  updateFirstCommitDate,
  getFileShaMap,
  getRepositoryShaMap,
  saveRepositoryShas,
} from "../database/queries.js";
import { TARGET_REPOSITORIES } from "../types.js";
import * as logger from "../utils/logger.js";

/** 並列処理設定 */
const PARALLEL_FILE_LIMIT = 5;

/**
 * 同期オプション
 */
export interface SyncOptions {
  /** GitHub トークン */
  token?: string;
  /** 強制同期（キャッシュ無視） */
  force?: boolean;
  /** 最大ファイル数 */
  maxFiles?: number;
}

/**
 * 同期実行
 */
export async function syncFromGitHub(
  db: Database.Database,
  options: SyncOptions = {},
): Promise<SyncResult> {
  const startTime = Date.now();
  const { token, force = false, maxFiles = 500 } = options;

  try {
    // 同期状態を更新
    updateSyncCheckpoint(db, { syncStatus: "syncing", lastError: null });

    // 前回同期からの経過時間をチェック
    const checkpoint = getSyncCheckpoint(db);
    const lastSyncDate = new Date(checkpoint.lastSync);
    const hoursSinceLastSync =
      (Date.now() - lastSyncDate.getTime()) / (1000 * 60 * 60);

    if (!force && hoursSinceLastSync < 1) {
      logger.info("Skipping sync, last sync was recent", {
        hoursSinceLastSync,
      });
      updateSyncCheckpoint(db, { syncStatus: "idle" });
      return {
        success: true,
        updatesCount: checkpoint.recordCount,
        commitsCount: 0,
        durationMs: Date.now() - startTime,
      };
    }

    logger.info("Starting sync from GitHub", { force, maxFiles });

    // リポジトリレベル差分チェック（force=false の場合）
    let files: Awaited<ReturnType<typeof getWhatsNewFiles>>;
    let newRepoShaMap: Map<string, string> | null = null;

    if (force) {
      // 強制同期: 全リポジトリからファイル取得
      files = await getWhatsNewFiles(token);
    } else {
      // インクリメンタル同期: 変更があったリポジトリのみ
      const previousRepoShaMap = getRepositoryShaMap(db);
      const result = await getWhatsNewFilesIncremental(
        previousRepoShaMap,
        token,
      );

      files = result.files;
      newRepoShaMap = result.newShaMap;

      logger.info("Incremental sync result", {
        changedRepos: result.changedRepos.length,
        skippedRepos: result.skippedRepos.length,
        filesFromChangedRepos: files.length,
      });

      // 変更がなければ早期リターン
      if (result.changedRepos.length === 0) {
        const durationMs = Date.now() - startTime;
        updateSyncCheckpoint(db, {
          lastSync: new Date().toISOString(),
          syncStatus: "idle",
          lastSyncDurationMs: durationMs,
        });
        logger.info("No repository changes detected, sync skipped", {
          durationMs,
        });
        return {
          success: true,
          updatesCount: 0,
          commitsCount: 0,
          durationMs,
        };
      }
    }

    // 既存ファイルの SHA マップを取得
    const existingShaMap = getFileShaMap(db);
    const isFirstSync = existingShaMap.size === 0;

    // ファイルレベル差分同期: SHA が変わったファイルのみ処理
    const filesToProcess = files
      .filter((file) => {
        if (force || isFirstSync) return true;
        const existingSha = existingShaMap.get(file.path);
        return existingSha !== file.sha;
      })
      .slice(0, maxFiles);

    logger.info("Files to process", {
      total: files.length,
      changed: filesToProcess.length,
      isFirstSync,
      force,
    });

    let updatesCount = 0;
    let errorCount = 0;

    // ファイル処理を並列化（同時5件まで）
    logger.info("Processing files (parallel)", {
      count: filesToProcess.length,
      parallelLimit: PARALLEL_FILE_LIMIT,
    });

    const processFile = async (file: (typeof filesToProcess)[0]) => {
      try {
        const update = await fetchAndParseFile(file.rawUrl, file.path, token);
        update.commitSha = file.sha;
        return { success: true, update, file };
      } catch (error) {
        return { success: false, error: String(error), file };
      }
    };

    // バッチ処理（同時実行数制限）
    for (let i = 0; i < filesToProcess.length; i += PARALLEL_FILE_LIMIT) {
      const batch = filesToProcess.slice(i, i + PARALLEL_FILE_LIMIT);
      const results = await Promise.all(batch.map(processFile));

      for (const result of results) {
        if (result.success && "update" in result) {
          upsertUpdate(db, result.update);
          updatesCount++;
        } else {
          errorCount++;
          logger.warn("Failed to process file", {
            path: result.file.path,
            error: "error" in result ? result.error : "Unknown",
          });
        }
      }
    }

    // コミット履歴を取得
    const since = force ? undefined : checkpoint.lastSync;
    const commits = await getRecentCommits(since, token);
    let commitsCount = 0;

    for (const commit of commits) {
      try {
        upsertCommit(db, commit);
        commitsCount++;
      } catch (error) {
        logger.warn("Failed to save commit", {
          sha: commit.sha,
          error: String(error),
        });
      }
    }

    // 最近変更されたファイルのコミット日を更新
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const changedFiles = await getRecentlyChangedFiles(
      oneWeekAgo.toISOString(),
      token,
    );

    for (const [filePath, info] of changedFiles) {
      try {
        updateCommitDate(db, filePath, info.date, info.sha);
      } catch (error) {
        logger.warn("Failed to update commit date", {
          filePath,
          error: String(error),
        });
      }
    }

    // 初回コミット日を取得（変更されたファイルのみ、API 負荷を考慮）
    // 変更されたファイルの初回コミット日のみ取得（最大10件）
    let firstCommitFetched = 0;
    for (const [filePath] of [...changedFiles].slice(0, 10)) {
      try {
        // ファイルパスからリポジトリ情報を推測
        for (const repo of TARGET_REPOSITORIES) {
          if (filePath.startsWith(repo.basePath)) {
            const firstCommit = await getFileFirstCommitDate(
              repo.owner,
              repo.repo,
              filePath,
              token,
            );
            if (firstCommit) {
              updateFirstCommitDate(db, filePath, firstCommit.date);
              firstCommitFetched++;
            }
            break;
          }
        }
      } catch (error) {
        logger.warn("Failed to get first commit date", {
          filePath,
          error: String(error),
        });
      }
    }

    logger.info("First commit dates updated", { count: firstCommitFetched });

    const durationMs = Date.now() - startTime;

    // リポジトリSHAを保存（次回のインクリメンタル同期用）
    if (newRepoShaMap) {
      saveRepositoryShas(db, newRepoShaMap);
      logger.info("Repository SHAs saved for incremental sync");
    }

    // 同期完了
    updateSyncCheckpoint(db, {
      lastSync: new Date().toISOString(),
      syncStatus: "idle",
      recordCount: updatesCount,
      lastSyncDurationMs: durationMs,
      lastError: errorCount > 0 ? `${errorCount} files failed` : null,
    });

    logger.info("Sync completed", {
      updatesCount,
      commitsCount,
      errorCount,
      durationMs,
    });

    return {
      success: true,
      updatesCount,
      commitsCount,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    updateSyncCheckpoint(db, {
      syncStatus: "error",
      lastError: errorMessage,
    });

    logger.error("Sync failed", { error: errorMessage, durationMs });

    return {
      success: false,
      updatesCount: 0,
      commitsCount: 0,
      durationMs,
      error: errorMessage,
    };
  }
}
