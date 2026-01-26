-- D365 Update データベーススキーマ
-- SQLite with FTS5 for full-text search

-- スキーマバージョン管理
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 初期バージョン挿入
INSERT OR IGNORE INTO schema_version (version) VALUES (1);

-- 同期チェックポイント
CREATE TABLE IF NOT EXISTS sync_checkpoint (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    last_sync TEXT NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'idle',
    record_count INTEGER NOT NULL DEFAULT 0,
    last_sync_duration_ms INTEGER,
    last_error TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 初期チェックポイント
INSERT OR IGNORE INTO sync_checkpoint (id, last_sync, sync_status, record_count)
VALUES (1, '1970-01-01T00:00:00.000Z', 'idle', 0);

-- D365 アップデート（what's-new ファイル）
CREATE TABLE IF NOT EXISTS d365_updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    product TEXT NOT NULL,
    version TEXT,
    release_date TEXT,
    preview_date TEXT,
    ga_date TEXT,
    commit_sha TEXT,
    commit_date TEXT,
    first_commit_date TEXT,
    file_url TEXT NOT NULL,
    raw_content_url TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- マイグレーション: first_commit_date カラムが存在しない場合に追加
-- ALTER TABLE d365_updates ADD COLUMN first_commit_date TEXT;

-- インデックス
CREATE INDEX IF NOT EXISTS idx_d365_updates_product ON d365_updates(product);
CREATE INDEX IF NOT EXISTS idx_d365_updates_version ON d365_updates(version);
CREATE INDEX IF NOT EXISTS idx_d365_updates_release_date ON d365_updates(release_date);
CREATE INDEX IF NOT EXISTS idx_d365_updates_commit_date ON d365_updates(commit_date);

-- 新機能テーブル
CREATE TABLE IF NOT EXISTS d365_features (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    update_id INTEGER NOT NULL,
    feature_name TEXT NOT NULL,
    feature_description TEXT,
    feature_type TEXT,
    FOREIGN KEY (update_id) REFERENCES d365_updates(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_d365_features_update ON d365_features(update_id);

-- コミット履歴テーブル（差分追跡用）
CREATE TABLE IF NOT EXISTS d365_commits (
    sha TEXT PRIMARY KEY,
    message TEXT NOT NULL,
    author TEXT,
    date TEXT NOT NULL,
    files_changed INTEGER,
    additions INTEGER,
    deletions INTEGER
);

CREATE INDEX IF NOT EXISTS idx_d365_commits_date ON d365_commits(date);

-- コミットとファイルの関連テーブル
CREATE TABLE IF NOT EXISTS commit_files (
    commit_sha TEXT NOT NULL,
    file_path TEXT NOT NULL,
    change_type TEXT NOT NULL,
    PRIMARY KEY (commit_sha, file_path),
    FOREIGN KEY (commit_sha) REFERENCES d365_commits(sha) ON DELETE CASCADE
);

-- FTS5 全文検索インデックス
CREATE VIRTUAL TABLE IF NOT EXISTS d365_updates_fts USING fts5(
    title,
    description,
    content='d365_updates',
    content_rowid='id'
);

-- FTS トリガー: INSERT
CREATE TRIGGER IF NOT EXISTS d365_updates_ai AFTER INSERT ON d365_updates BEGIN
    INSERT INTO d365_updates_fts(rowid, title, description)
    VALUES (new.id, new.title, new.description);
END;

-- FTS トリガー: UPDATE
CREATE TRIGGER IF NOT EXISTS d365_updates_au AFTER UPDATE ON d365_updates BEGIN
    INSERT INTO d365_updates_fts(d365_updates_fts, rowid, title, description)
    VALUES ('delete', old.id, old.title, old.description);
    INSERT INTO d365_updates_fts(rowid, title, description)
    VALUES (new.id, new.title, new.description);
END;

-- FTS トリガー: DELETE
CREATE TRIGGER IF NOT EXISTS d365_updates_ad AFTER DELETE ON d365_updates BEGIN
    INSERT INTO d365_updates_fts(d365_updates_fts, rowid, title, description)
    VALUES ('delete', old.id, old.title, old.description);
END;
