/**
 * データベース初期化・管理
 *
 * SQLite with WAL mode, FTS5 for full-text search
 */

import Database from "better-sqlite3";
import { readFileSync, existsSync, mkdirSync, copyFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";

// ESM-friendly __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * データベース設定
 */
export interface DatabaseConfig {
  /** データベースファイルパス */
  path?: string;
  /** 読み取り専用モード */
  readonly?: boolean;
  /** 詳細ログ出力 */
  verbose?: boolean;
}

let dbInstance: Database.Database | null = null;

/**
 * デフォルトのデータベースパスを取得
 */
function getDefaultDatabasePath(): string {
  // 環境変数でオーバーライド可能（テスト用）
  if (process.env.D365_UPDATE_DB_PATH) {
    return process.env.D365_UPDATE_DB_PATH;
  }
  const dataDir = join(homedir(), ".d365-update");
  return join(dataDir, "d365-updates.db");
}

/**
 * 同梱データベースのパスを取得
 */
function getBundledDatabasePath(): string {
  return join(__dirname, "bundled.db");
}

/**
 * 同梱データベースからユーザーDBを初期化
 * ユーザーDBが存在しない場合のみコピー
 */
function initializeFromBundledDb(userDbPath: string): boolean {
  const bundledDbPath = getBundledDatabasePath();

  if (!existsSync(bundledDbPath)) {
    return false; // 同梱DBが無い場合はスキップ
  }

  if (existsSync(userDbPath)) {
    return false; // ユーザーDBが既にある場合はスキップ
  }

  // ディレクトリ作成
  const dataDir = dirname(userDbPath);
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  // 同梱DBをコピー
  copyFileSync(bundledDbPath, userDbPath);

  // WALファイルもコピー（存在する場合）
  const bundledWalPath = bundledDbPath + "-wal";
  if (existsSync(bundledWalPath)) {
    copyFileSync(bundledWalPath, userDbPath + "-wal");
  }

  const bundledShmPath = bundledDbPath + "-shm";
  if (existsSync(bundledShmPath)) {
    copyFileSync(bundledShmPath, userDbPath + "-shm");
  }

  return true;
}

/**
 * データベースを初期化
 */
export function initializeDatabase(
  config: DatabaseConfig = {},
): Database.Database {
  const dbPath = config.path ?? getDefaultDatabasePath();

  // 同梱DBからの初期化を試行（ユーザーDBが無い場合のみ）
  const copiedFromBundled = initializeFromBundledDb(dbPath);
  if (copiedFromBundled) {
    console.error("[D365 UPDATE] Initialized database from bundled data");
  }

  // ディレクトリ作成
  const dataDir = dirname(dbPath);
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  // データベース接続
  const db = new Database(dbPath, {
    readonly: config.readonly ?? false,
    verbose: config.verbose ? console.error : undefined,
  });

  // パフォーマンス最適化
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("cache_size = -64000"); // 64MB
  db.pragma("temp_store = MEMORY");
  db.pragma("foreign_keys = ON");

  // スキーマ適用
  if (!isSchemaInitialized(db)) {
    applySchema(db);
  } else {
    // 既存DBの場合はマイグレーションを適用
    migrateSchema(db);
  }

  return db;
}

/**
 * シングルトンデータベースインスタンスを取得
 */
export function getDatabase(config?: DatabaseConfig): Database.Database {
  if (!dbInstance) {
    dbInstance = initializeDatabase(config);
  }
  return dbInstance;
}

/**
 * データベース接続を閉じる
 */
export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * スキーマが初期化済みか確認
 */
function isSchemaInitialized(db: Database.Database): boolean {
  const result = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'",
    )
    .get() as { name: string } | undefined;

  return result !== undefined;
}

/**
 * スキーマを適用
 */
function applySchema(db: Database.Database): void {
  const schemaPath = join(__dirname, "schema.sql");
  const schemaSql = readFileSync(schemaPath, "utf-8");
  db.exec(schemaSql);
}

/**
 * スキーママイグレーションを適用
 * 既存のデータベースに新しいカラム/テーブルを追加
 */
export function migrateSchema(db: Database.Database): void {
  // first_commit_date カラムが存在するか確認
  const columns = db.prepare("PRAGMA table_info(d365_updates)").all() as Array<{
    name: string;
  }>;

  const hasFirstCommitDate = columns.some(
    (col) => col.name === "first_commit_date",
  );

  if (!hasFirstCommitDate) {
    db.exec("ALTER TABLE d365_updates ADD COLUMN first_commit_date TEXT");
  }

  // repository_shas テーブルが存在するか確認
  const hasRepoShasTable = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='repository_shas'",
    )
    .get() as { name: string } | undefined;

  if (!hasRepoShasTable) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS repository_shas (
        repo_key TEXT PRIMARY KEY,
        latest_sha TEXT NOT NULL,
        checked_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }
}

/**
 * データベース統計を取得
 */
export function getDatabaseStats(db: Database.Database): {
  updateCount: number;
  featureCount: number;
  commitCount: number;
  productCount: number;
  databaseSizeKB: number;
} {
  const updateCount = (
    db.prepare("SELECT COUNT(*) as count FROM d365_updates").get() as {
      count: number;
    }
  ).count;
  const featureCount = (
    db.prepare("SELECT COUNT(*) as count FROM d365_features").get() as {
      count: number;
    }
  ).count;
  const commitCount = (
    db.prepare("SELECT COUNT(*) as count FROM d365_commits").get() as {
      count: number;
    }
  ).count;
  const productCount = (
    db
      .prepare("SELECT COUNT(DISTINCT product) as count FROM d365_updates")
      .get() as { count: number }
  ).count;

  const pageCount = db.pragma("page_count", { simple: true }) as number;
  const pageSize = db.pragma("page_size", { simple: true }) as number;
  const databaseSizeKB = Math.round((pageCount * pageSize) / 1024);

  return {
    updateCount,
    featureCount,
    commitCount,
    productCount,
    databaseSizeKB,
  };
}
