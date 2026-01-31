#!/usr/bin/env node
/**
 * D365 Update MCP Server エントリーポイント
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { getDatabase, closeDatabase } from "./database/database.js";
import { syncFromGitHub } from "./services/sync.service.js";
import * as logger from "./utils/logger.js";

/**
 * バックグラウンド自動同期を実行
 */
async function runBackgroundSync(): Promise<void> {
  const db = await getDatabase();
  const token =
    process.env.D365_UPDATE_GITHUB_TOKEN || process.env.GITHUB_TOKEN;

  logger.info("Starting background sync");

  try {
    const result = await syncFromGitHub(db, { token, force: false });
    logger.info("Background sync completed", {
      success: result.success,
      updatesCount: result.updatesCount,
      durationMs: result.durationMs,
    });
  } catch (error) {
    logger.warn("Background sync failed", { error: String(error) });
  }
}

async function main(): Promise<void> {
  logger.info("Starting D365 Update MCP Server");

  // 環境変数からトークン確認（デバッグ用）
  const hasGitHubToken = !!process.env.GITHUB_TOKEN;
  const hasD365Token = !!process.env.D365_UPDATE_GITHUB_TOKEN;
  logger.info(
    `GitHub Token status: GITHUB_TOKEN=${hasGitHubToken}, D365_UPDATE_GITHUB_TOKEN=${hasD365Token}`,
  );

  // データベース初期化
  try {
    await getDatabase();
    logger.info("Database initialized");
  } catch (error) {
    logger.error("Failed to initialize database", { error: String(error) });
    process.exit(1);
  }

  // サーバー作成
  const server = createServer();

  // Stdio トランスポート
  const transport = new StdioServerTransport();

  // シグナルハンドリング
  process.on("SIGINT", () => {
    logger.info("Received SIGINT, shutting down");
    closeDatabase();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    logger.info("Received SIGTERM, shutting down");
    closeDatabase();
    process.exit(0);
  });

  // サーバー起動
  await server.connect(transport);
  logger.info("D365 Update MCP Server running on stdio");

  // バックグラウンド自動同期を開始（ブロックしない）
  runBackgroundSync().catch((error) => {
    logger.warn("Background sync error", { error: String(error) });
  });
}

main().catch((error) => {
  logger.error("Fatal error", { error: String(error) });
  process.exit(1);
});
