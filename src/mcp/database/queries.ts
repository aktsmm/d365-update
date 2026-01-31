/**
 * データベースクエリ
 *
 * sql.js 用のクエリ関数
 */

import type { Database as SqlJsDatabase } from "sql.js";
import type { D365Update, D365Commit, SearchFilters } from "../types.js";

/**
 * sql.js の結果を型付きオブジェクトに変換するヘルパー
 */
function resultToObjects<T>(result: {
  columns: string[];
  values: unknown[][];
}): T[] {
  const { columns, values } = result;
  return values.map((row) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj as T;
  });
}

/**
 * 同期チェックポイントを取得
 */
export function getSyncCheckpoint(db: SqlJsDatabase): {
  lastSync: string;
  syncStatus: string;
  recordCount: number;
} {
  const result = db.exec(
    "SELECT last_sync as lastSync, sync_status as syncStatus, record_count as recordCount FROM sync_checkpoint WHERE id = 1",
  );

  if (result.length === 0 || result[0].values.length === 0) {
    return {
      lastSync: "1970-01-01T00:00:00.000Z",
      syncStatus: "idle",
      recordCount: 0,
    };
  }

  const [lastSync, syncStatus, recordCount] = result[0].values[0] as [
    string,
    string,
    number,
  ];
  return { lastSync, syncStatus, recordCount };
}

/**
 * 同期チェックポイントを更新
 */
export function updateSyncCheckpoint(
  db: SqlJsDatabase,
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
  db.run(sql, values);
}

/**
 * アップデートを upsert
 */
export function upsertUpdate(db: SqlJsDatabase, update: D365Update): void {
  db.run(
    `
    INSERT INTO d365_updates (
      file_path, title, description, product, version,
      release_date, preview_date, ga_date,
      commit_sha, commit_date, first_commit_date, file_url, raw_content_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      first_commit_date = COALESCE(d365_updates.first_commit_date, excluded.first_commit_date),
      file_url = excluded.file_url,
      raw_content_url = excluded.raw_content_url,
      updated_at = datetime('now')
  `,
    [
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
      update.firstCommitDate,
      update.fileUrl,
      update.rawContentUrl,
    ],
  );
}

/**
 * コミットを upsert
 */
export function upsertCommit(db: SqlJsDatabase, commit: D365Commit): void {
  db.run(
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
    [
      commit.sha,
      commit.message,
      commit.author,
      commit.date,
      commit.filesChanged,
      commit.additions,
      commit.deletions,
    ],
  );
}

/**
 * ファイルのコミット日を更新
 */
export function updateCommitDate(
  db: SqlJsDatabase,
  filePath: string,
  commitDate: string,
  commitSha: string,
): void {
  db.run(
    `
    UPDATE d365_updates 
    SET commit_date = ?, commit_sha = ?, updated_at = datetime('now')
    WHERE file_path LIKE ?
  `,
    [commitDate, commitSha, `%${filePath}`],
  );
}

/**
 * ファイルの初回コミット日を更新
 */
export function updateFirstCommitDate(
  db: SqlJsDatabase,
  filePath: string,
  firstCommitDate: string,
): void {
  db.run(
    `
    UPDATE d365_updates 
    SET first_commit_date = ?, updated_at = datetime('now')
    WHERE file_path LIKE ? AND first_commit_date IS NULL
  `,
    [firstCommitDate, `%${filePath}`],
  );
}

/**
 * 全ファイルの SHA マップを取得（差分同期用）
 */
export function getFileShaMap(db: SqlJsDatabase): Map<string, string> {
  const result = db.exec(
    `SELECT file_path, commit_sha FROM d365_updates WHERE commit_sha IS NOT NULL`,
  );

  const map = new Map<string, string>();
  if (result.length > 0) {
    for (const row of result[0].values) {
      const [filePath, commitSha] = row as [string, string];
      map.set(filePath, commitSha);
    }
  }
  return map;
}

/**
 * リポジトリSHAマップを取得（リポジトリレベル差分チェック用）
 */
export function getRepositoryShaMap(db: SqlJsDatabase): Map<string, string> {
  try {
    const result = db.exec(`SELECT repo_key, latest_sha FROM repository_shas`);

    const map = new Map<string, string>();
    if (result.length > 0) {
      for (const row of result[0].values) {
        const [repoKey, latestSha] = row as [string, string];
        map.set(repoKey, latestSha);
      }
    }
    return map;
  } catch {
    // テーブルが存在しない場合は空のマップを返す
    return new Map();
  }
}

/**
 * リポジトリSHAを保存（リポジトリレベル差分チェック用）
 */
export function saveRepositoryShas(
  db: SqlJsDatabase,
  shaMap: Map<string, string>,
): void {
  for (const [repoKey, sha] of shaMap) {
    db.run(
      `INSERT OR REPLACE INTO repository_shas (repo_key, latest_sha, checked_at)
       VALUES (?, ?, datetime('now'))`,
      [repoKey, sha],
    );
  }
}

/**
 * アップデートを検索
 */
export function searchUpdates(
  db: SqlJsDatabase,
  filters: SearchFilters,
): D365Update[] {
  let sql = `
    SELECT 
      d.id, d.file_path as filePath, d.title, d.description,
      d.product, d.version, d.release_date as releaseDate,
      d.preview_date as previewDate, d.ga_date as gaDate,
      d.commit_sha as commitSha, d.commit_date as commitDate,
      d.first_commit_date as firstCommitDate,
      d.file_url as fileUrl, d.raw_content_url as rawContentUrl
    FROM d365_updates d
  `;

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  // 全文検索（sql.js では FTS5 が限定的なので LIKE で代替）
  if (filters.query) {
    // FTS5 テーブルが存在する場合は使用、なければ LIKE 検索
    try {
      // FTS5 を試す
      sql = `
        SELECT 
          d.id, d.file_path as filePath, d.title, d.description,
          d.product, d.version, d.release_date as releaseDate,
          d.preview_date as previewDate, d.ga_date as gaDate,
          d.commit_sha as commitSha, d.commit_date as commitDate,
          d.first_commit_date as firstCommitDate,
          d.file_url as fileUrl, d.raw_content_url as rawContentUrl
        FROM d365_updates d
        JOIN d365_updates_fts fts ON d.id = fts.rowid
        WHERE d365_updates_fts MATCH ?
      `;
      params.push(filters.query);
    } catch {
      // FTS5 が無い場合は LIKE 検索にフォールバック
      conditions.push("(d.title LIKE ? OR d.description LIKE ?)");
      params.push(`%${filters.query}%`, `%${filters.query}%`);
    }
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

  // ソート
  sql += ` ORDER BY COALESCE(
    CASE WHEN d.release_date IS NOT NULL 
      THEN substr(d.release_date, 7, 4) || '-' || substr(d.release_date, 1, 2) || '-' || substr(d.release_date, 4, 2)
      ELSE NULL END,
    d.commit_date
  ) DESC NULLS LAST`;

  // リミット
  if (filters.limit !== undefined) {
    sql += " LIMIT ?";
    params.push(filters.limit);
  }
  if (filters.offset !== undefined && filters.offset > 0) {
    sql += " OFFSET ?";
    params.push(filters.offset);
  }

  // sql.js でパラメータ付きクエリを実行
  const stmt = db.prepare(sql);
  stmt.bind(params);

  const results: D365Update[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as unknown as D365Update;
    results.push(row);
  }
  stmt.free();

  return results;
}

/**
 * ID でアップデートを取得
 */
export function getUpdateById(
  db: SqlJsDatabase,
  id: number,
): D365Update | null {
  const stmt = db.prepare(`
    SELECT 
      id, file_path as filePath, title, description,
      product, version, release_date as releaseDate,
      preview_date as previewDate, ga_date as gaDate,
      commit_sha as commitSha, commit_date as commitDate,
      first_commit_date as firstCommitDate,
      file_url as fileUrl, raw_content_url as rawContentUrl
    FROM d365_updates
    WHERE id = ?
  `);
  stmt.bind([id]);

  if (stmt.step()) {
    const result = stmt.getAsObject() as unknown as D365Update;
    stmt.free();
    return result;
  }
  stmt.free();
  return null;
}

/**
 * 製品一覧を取得
 */
export function getProducts(db: SqlJsDatabase): string[] {
  const result = db.exec(
    "SELECT DISTINCT product FROM d365_updates ORDER BY product",
  );

  if (result.length === 0 || result[0].values.length === 0) {
    return [];
  }

  return result[0].values.map((row) => row[0] as string);
}

/**
 * 最近のコミットを取得
 */
export function getRecentCommits(
  db: SqlJsDatabase,
  limit: number = 20,
): D365Commit[] {
  const stmt = db.prepare(`
    SELECT sha, message, author, date, files_changed as filesChanged,
           additions, deletions
    FROM d365_commits
    ORDER BY date DESC
    LIMIT ?
  `);
  stmt.bind([limit]);

  const results: D365Commit[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as unknown as D365Commit;
    results.push(row);
  }
  stmt.free();

  return results;
}
