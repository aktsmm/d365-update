#!/usr/bin/env node
/**
 * D365 Update MCP Server エントリーポイント
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { getDatabase, closeDatabase } from "./database/database.js";
import * as logger from "./utils/logger.js";

async function main(): Promise<void> {
  logger.info("Starting D365 Update MCP Server");

  // データベース初期化
  try {
    getDatabase();
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
}

main().catch((error) => {
  logger.error("Fatal error", { error: String(error) });
  process.exit(1);
});
