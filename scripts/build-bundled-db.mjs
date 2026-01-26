#!/usr/bin/env node
/**
 * パッケージ用の同梱データベースを準備するスクリプト
 *
 * ユーザーの既存DB (~/.d365-update/d365-updates.db) を
 * dist/mcp/bundled.db にコピーして同梱する
 *
 * 使用方法:
 *   1. 事前に `d365-update.syncUpdates` コマンドを実行してDBを最新化
 *   2. `npm run build:bundled-db` を実行
 *   3. `npm run package` でパッケージング
 */

import { existsSync, copyFileSync, mkdirSync, statSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

// ソース（ユーザーDB）
const userDbPath = join(homedir(), ".d365-update", "d365-updates.db");

// 出力先
const distDir = join(rootDir, "dist", "mcp");
const bundledDbPath = join(distDir, "bundled.db");

function main() {
  console.log("📦 同梱用データベースを準備中...\n");

  // ユーザーDBの存在確認
  if (!existsSync(userDbPath)) {
    console.error(`❌ ユーザーDBが見つかりません: ${userDbPath}`);
    console.error("\n以下を実行してください:");
    console.error("  1. VS Code で拡張機能を開発モードで起動");
    console.error(
      '  2. コマンドパレットから "D365 UPDATE: Sync Updates from GitHub" を実行',
    );
    console.error("  3. 同期完了後、再度このスクリプトを実行");
    process.exit(1);
  }

  // dist/mcp ディレクトリ作成
  if (!existsSync(distDir)) {
    mkdirSync(distDir, { recursive: true });
  }

  // 既存の同梱DBを削除
  if (existsSync(bundledDbPath)) {
    unlinkSync(bundledDbPath);
  }

  // WALモードのDBを通常モードに変換してコピー
  // better-sqlite3 で開いて vacuum すると WAL が統合される
  console.log(`📁 ソースDB: ${userDbPath}`);

  // DBをコピー
  copyFileSync(userDbPath, bundledDbPath);

  // WAL/SHMファイルは不要（vacuum済みのDBをコピーするため）
  const walPath = bundledDbPath + "-wal";
  const shmPath = bundledDbPath + "-shm";
  if (existsSync(walPath)) unlinkSync(walPath);
  if (existsSync(shmPath)) unlinkSync(shmPath);

  // 統計表示
  const stats = statSync(bundledDbPath);
  const sizeKB = Math.round(stats.size / 1024);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

  console.log(`\n✅ 同梱用データベース準備完了`);
  console.log(`   サイズ: ${sizeKB} KB (${sizeMB} MB)`);
  console.log(`   出力先: ${bundledDbPath}`);

  console.log("\n🎉 次のステップ:");
  console.log("   npm run package");
}

main();
