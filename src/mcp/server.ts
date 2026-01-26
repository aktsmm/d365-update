/**
 * MCP Server 実装
 *
 * D365 Update MCP Server
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  searchD365UpdatesSchema,
  executeSearchD365Updates,
} from "./tools/searchD365Updates.js";
import {
  getD365UpdateSchema,
  executeGetD365Update,
} from "./tools/getD365Update.js";
import {
  syncD365UpdatesSchema,
  executeSyncD365Updates,
} from "./tools/syncD365Updates.js";
import * as logger from "./utils/logger.js";

/**
 * MCP Server を作成
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: "d365-update",
    version: "0.1.0",
  });

  // search_d365_updates ツール
  server.tool(
    "search_d365_updates",
    `Search Dynamics 365 update information from GitHub Docs. Returns lightweight metadata. Supports full-text search, product/version/date filters, and pagination. Use get_d365_update to retrieve full details. IMPORTANT: If user writes in Japanese, set locale='ja-jp' to return Japanese Microsoft Learn URLs. ALWAYS translate the title and summary to the user's language when presenting results (e.g., translate to Japanese if user asks in Japanese).

## Output Format Instructions for GitHub Copilot

When presenting results to the user, ALWAYS format as follows:

1. **Summary Table**: Show count, date range, and counts by product
2. **Full Results Table** with ALL of the following columns:
   - Release Date (リリース日)
   - Product (製品)
   - Title - TRANSLATED to user's language (タイトル - 翻訳)
   - Summary - TRANSLATED to user's language (概要 - 翻訳)
   - Japanese Docs URL (docsUrl_ja) - as clickable link [日本語](url)
   - English Docs URL (docsUrl_en) - as clickable link [英語](url)
   - GitHub Commits URL (githubCommitsUrl) - as clickable link [Commits](url)

CRITICAL: Always translate title and summary to the user's language. Never omit URLs.`,
    searchD365UpdatesSchema.shape,
    async (input) => {
      try {
        const result = await executeSearchD365Updates(input);
        return {
          content: [{ type: "text", text: result }],
        };
      } catch (error) {
        logger.error("search_d365_updates failed", { error: String(error) });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: String(error) }),
            },
          ],
          isError: true,
        };
      }
    },
  );

  // get_d365_update ツール
  server.tool(
    "get_d365_update",
    "Retrieve complete details of a specific D365 update by ID. Includes full description, product info, version, and reference URLs. Use after search_d365_updates to get detailed content. IMPORTANT: If user writes in Japanese, set locale='ja-jp' to return Japanese Microsoft Learn URLs. ALWAYS translate the title, description and all content to the user's language when presenting results (e.g., translate to Japanese if user asks in Japanese).",
    getD365UpdateSchema.shape,
    async (input) => {
      try {
        const result = await executeGetD365Update(input);
        return {
          content: [{ type: "text", text: result }],
        };
      } catch (error) {
        logger.error("get_d365_update failed", { error: String(error) });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: String(error) }),
            },
          ],
          isError: true,
        };
      }
    },
  );

  // sync_d365_updates ツール
  server.tool(
    "sync_d365_updates",
    "Synchronize D365 update data from GitHub MicrosoftDocs repository. Fetches all what's-new articles and stores them in the local database. Use this to update the local cache with the latest update data.",
    syncD365UpdatesSchema.shape,
    async (input) => {
      try {
        const result = await executeSyncD365Updates(input);
        return {
          content: [{ type: "text", text: result }],
        };
      } catch (error) {
        logger.error("sync_d365_updates failed", { error: String(error) });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: String(error) }),
            },
          ],
          isError: true,
        };
      }
    },
  );

  return server;
}
