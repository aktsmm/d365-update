/**
 * データベースクエリ
 */

import type Database from "better-sqlite3";
import type { D365Update, D365Commit, SearchFilters } from "../types.js";

/**
 * 同期チェックポイントを取得
 */
export function getSyncCheckpoint(db: Database.Database): {
  lastSync: string;
  syncStatus: string;
  recordCount: number;
} {
  return db
    .prepare(
      "SELECT last_sync as lastSync, sync_status as syncStatus, record_count as recordCount FROM sync_checkpoint WHERE id = 1",
    )
    .get() as { lastSync: string; syncStatus: string; recordCount: number };
}

/**
 * 同期チェックポイントを更新
 */
export function updateSyncCheckpoint(
  db: Database.Database,
  data: {
    lastSync?: string;
    syncStatus?: string;
    recordCount?: number;
    lastSyncDurationMs?: number;
    lastError?: string | null;
  },
): void {
  const sets: string[] = ["updated_at = datetime('now')"];
  const values: (string | number | null)[] = [];

  if (data.lastSync !== undefined) {
    sets.push("last_sync = ?");
    values.push(data.lastSync);
  }
  if (data.syncStatus !== undefined) {
    sets.push("sync_status = ?");
    values.push(data.syncStatus);
  }
  if (data.recordCount !== undefined) {
    sets.push("record_count = ?");
    values.push(data.recordCount);
  }
  if (data.lastSyncDurationMs !== undefined) {
    sets.push("last_sync_duration_ms = ?");
    values.push(data.lastSyncDurationMs);
  }
  if (data.lastError !== undefined) {
    sets.push("last_error = ?");
    values.push(data.lastError);
  }

  const sql = `UPDATE sync_checkpoint SET ${sets.join(", ")} WHERE id = 1`;
  db.prepare(sql).run(...values);
}

/**
 * アップデートを upsert
 */
export function upsertUpdate(db: Database.Database, update: D365Update): void {
  db.prepare(
    `
    INSERT INTO d365_updates (
      file_path, title, description, product, version,
      release_date, preview_date, ga_date,
      commit_sha, commit_date, file_url, raw_content_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(file_path) DO UPDATE SET
      title = excluded.title,
      description = excluded.description,
      product = excluded.product,
      version = excluded.version,
      release_date = excluded.release_date,
      preview_date = excluded.preview_date,
      ga_date = excluded.ga_date,
      commit_sha = excluded.commit_sha,
      commit_date = excluded.commit_date,
      file_url = excluded.file_url,
      raw_content_url = excluded.raw_content_url,
      updated_at = datetime('now')
  `,
  ).run(
    update.filePath,
    update.title,
    update.description,
    update.product,
    update.version,
    update.releaseDate,
    update.previewDate,
    update.gaDate,
    update.commitSha,
    update.commitDate,
    update.fileUrl,
    update.rawContentUrl,
  );
}

/**
 * コミットを upsert
 */
export function upsertCommit(db: Database.Database, commit: D365Commit): void {
  db.prepare(
    `
    INSERT INTO d365_commits (sha, message, author, date, files_changed, additions, deletions)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(sha) DO UPDATE SET
      message = excluded.message,
      author = excluded.author,
      date = excluded.date,
      files_changed = excluded.files_changed,
      additions = excluded.additions,
      deletions = excluded.deletions
  `,
  ).run(
    commit.sha,
    commit.message,
    commit.author,
    commit.date,
    commit.filesChanged,
    commit.additions,
    commit.deletions,
  );
}

/**
 * ファイルのコミット日を更新
 */
export function updateCommitDate(
  db: Database.Database,
  filePath: string,
  commitDate: string,
  commitSha: string,
): void {
  db.prepare(
    `
    UPDATE d365_updates 
    SET commit_date = ?, commit_sha = ?, updated_at = datetime('now')
    WHERE file_path LIKE ?
  `,
  ).run(commitDate, commitSha, `%${filePath}`);
}

/**
 * 全ファイルの SHA マップを取得（差分同期用）
 */
export function getFileShaMap(db: Database.Database): Map<string, string> {
  const rows = db
    .prepare(
      `SELECT file_path, commit_sha FROM d365_updates WHERE commit_sha IS NOT NULL`,
    )
    .all() as Array<{ file_path: string; commit_sha: string }>;

  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(row.file_path, row.commit_sha);
  }
  return map;
}

/**
 * アップデートを検索
 */
export function searchUpdates(
  db: Database.Database,
  filters: SearchFilters,
): D365Update[] {
  let sql = `
    SELECT 
      d.id, d.file_path as filePath, d.title, d.description,
      d.product, d.version, d.release_date as releaseDate,
      d.preview_date as previewDate, d.ga_date as gaDate,
      d.commit_sha as commitSha, d.commit_date as commitDate,
      d.file_url as fileUrl, d.raw_content_url as rawContentUrl
    FROM d365_updates d
  `;

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  // 全文検索
  if (filters.query) {
    sql = `
      SELECT 
        d.id, d.file_path as filePath, d.title, d.description,
        d.product, d.version, d.release_date as releaseDate,
        d.preview_date as previewDate, d.ga_date as gaDate,
        d.commit_sha as commitSha, d.commit_date as commitDate,
        d.file_url as fileUrl, d.raw_content_url as rawContentUrl
      FROM d365_updates d
      JOIN d365_updates_fts fts ON d.id = fts.rowid
      WHERE d365_updates_fts MATCH ?
    `;
    params.push(filters.query);
  }

  // 製品フィルタ
  if (filters.product) {
    conditions.push("d.product = ?");
    params.push(filters.product);
  }

  // バージョンフィルタ
  if (filters.version) {
    conditions.push("d.version LIKE ?");
    params.push(`%${filters.version}%`);
  }

  // 日付フィルタ
  // release_date は MM/DD/YYYY 形式、commit_date は ISO 8601 形式
  // SQLite で release_date を YYYY-MM-DD に変換して比較
  if (filters.dateFrom) {
    conditions.push(`(
      (d.release_date IS NOT NULL AND 
       substr(d.release_date, 7, 4) || '-' || substr(d.release_date, 1, 2) || '-' || substr(d.release_date, 4, 2) >= ?) 
      OR (d.commit_date IS NOT NULL AND d.commit_date >= ?)
    )`);
    params.push(filters.dateFrom, filters.dateFrom);
  }
  if (filters.dateTo) {
    conditions.push(`(
      (d.release_date IS NOT NULL AND 
       substr(d.release_date, 7, 4) || '-' || substr(d.release_date, 1, 2) || '-' || substr(d.release_date, 4, 2) <= ?) 
      OR (d.commit_date IS NOT NULL AND d.commit_date <= ?)
    )`);
    params.push(filters.dateTo, filters.dateTo);
  }

  if (conditions.length > 0) {
    sql += (filters.query ? " AND " : " WHERE ") + conditions.join(" AND ");
  }

  // ソート (release_date を YYYY-MM-DD に変換してソート、なければ commit_date)
  sql += ` ORDER BY COALESCE(
    CASE WHEN d.release_date IS NOT NULL 
      THEN substr(d.release_date, 7, 4) || '-' || substr(d.release_date, 1, 2) || '-' || substr(d.release_date, 4, 2)
      ELSE NULL END,
    d.commit_date
  ) DESC NULLS LAST`;

  // リミット（指定がなければ全件）
  if (filters.limit !== undefined) {
    sql += " LIMIT ?";
    params.push(filters.limit);
  }
  if (filters.offset !== undefined && filters.offset > 0) {
    sql += " OFFSET ?";
    params.push(filters.offset);
  }

  return db.prepare(sql).all(...params) as D365Update[];
}

/**
 * ID でアップデートを取得
 */
export function getUpdateById(
  db: Database.Database,
  id: number,
): D365Update | null {
  return db
    .prepare(
      `
    SELECT 
      id, file_path as filePath, title, description,
      product, version, release_date as releaseDate,
      preview_date as previewDate, ga_date as gaDate,
      commit_sha as commitSha, commit_date as commitDate,
      file_url as fileUrl, raw_content_url as rawContentUrl
    FROM d365_updates
    WHERE id = ?
  `,
    )
    .get(id) as D365Update | null;
}

/**
 * 製品一覧を取得
 */
export function getProducts(db: Database.Database): string[] {
  const rows = db
    .prepare("SELECT DISTINCT product FROM d365_updates ORDER BY product")
    .all() as { product: string }[];
  return rows.map((r) => r.product);
}

/**
 * 最近のコミットを取得
 */
export function getRecentCommits(
  db: Database.Database,
  limit: number = 20,
): D365Commit[] {
  return db
    .prepare(
      `
    SELECT sha, message, author, date, files_changed as filesChanged,
           additions, deletions
    FROM d365_commits
    ORDER BY date DESC
    LIMIT ?
  `,
    )
    .all(limit) as D365Commit[];
}
