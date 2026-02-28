import initSqlJs from "sql.js";
import { describe, expect, it } from "vitest";
import { searchUpdates } from "./queries.js";

describe("searchUpdates", () => {
  it("falls back to LIKE search when FTS table is missing", async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();

    db.run(`
      CREATE TABLE d365_updates (
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
        raw_content_url TEXT NOT NULL
      )
    `);

    db.run(
      `INSERT INTO d365_updates (
        file_path, title, description, product, version,
        release_date, preview_date, ga_date,
        commit_sha, commit_date, first_commit_date, file_url, raw_content_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "MicrosoftDocs/dynamics-365-unified-operations-public/articles/whats-new.md",
        "Copilot wave updates",
        "- Added planning suggestions",
        "Dynamics 365 Finance",
        "10.0.45",
        "2026-02-20",
        null,
        null,
        "abc123",
        "2026-02-21T00:00:00Z",
        null,
        "https://github.com/MicrosoftDocs/dynamics-365-unified-operations-public/blob/main/articles/whats-new.md",
        "https://raw.githubusercontent.com/MicrosoftDocs/dynamics-365-unified-operations-public/main/articles/whats-new.md",
      ],
    );

    const results = searchUpdates(db, { query: "Copilot", limit: 10 });

    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe("Copilot wave updates");
    expect(results[0]?.product).toBe("Dynamics 365 Finance");

    db.close();
  });
});
