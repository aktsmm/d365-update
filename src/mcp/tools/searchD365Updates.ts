/**
 * search_d365_updates ツール
 *
 * Dynamics 365 アップデート情報を検索
 */

import { z } from "zod";
import { getDatabase } from "../database/database.js";
import { searchUpdates, getProducts } from "../database/queries.js";

/**
 * ツール入力スキーマ
 */
export const searchD365UpdatesSchema = z.object({
  query: z
    .string()
    .optional()
    .describe(
      "Full-text search query (searches title + description). Use keywords like 'Copilot', 'warehouse', 'invoice'. Case-insensitive.",
    ),
  product: z
    .string()
    .optional()
    .describe(
      "Filter by product (e.g., 'Dynamics 365 Finance', 'Dynamics 365 Supply Chain Management', 'Dynamics 365 Human Resources', 'Dynamics 365 Commerce')",
    ),
  version: z
    .string()
    .optional()
    .describe("Filter by version (e.g., '10.0.41', '10.0.40')"),
  dateFrom: z
    .string()
    .optional()
    .describe(
      "Filter by commit date range start (ISO 8601 format, e.g., '2024-01-01')",
    ),
  dateTo: z
    .string()
    .optional()
    .describe(
      "Filter by commit date range end (ISO 8601 format, e.g., '2024-12-31')",
    ),
  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .describe("Maximum number of results (1-100, default: 20)"),
  offset: z
    .number()
    .min(0)
    .optional()
    .describe("Number of results to skip for pagination (default: 0)"),
});

export type SearchD365UpdatesInput = z.infer<typeof searchD365UpdatesSchema>;

/**
 * ツール実行
 */
export async function executeSearchD365Updates(
  input: SearchD365UpdatesInput,
): Promise<string> {
  const db = getDatabase();

  // 製品一覧を取得（フィルタのヒント用）
  const products = getProducts(db);

  // デフォルト: 1ヶ月前から（日付指定がない場合）
  let dateFrom = input.dateFrom;
  if (!dateFrom && !input.query && !input.version) {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    dateFrom = oneMonthAgo.toISOString().split("T")[0];
  }

  // 検索実行
  const results = searchUpdates(db, {
    query: input.query,
    product: input.product,
    version: input.version,
    dateFrom,
    dateTo: input.dateTo,
    limit: input.limit,
    offset: input.offset,
  });

  // 結果をフォーマット
  const formattedResults = results.map((update) => {
    // 概要を抽出（最初の段落またはキーポイント）
    let summary = "";
    if (update.description) {
      // 箇条書きや機能説明を優先的に抽出
      const lines = update.description
        .split("\n")
        .filter((l: string) => l.trim());
      const bulletPoints = lines.filter(
        (l: string) => l.trim().startsWith("-") || l.trim().startsWith("*"),
      );

      if (bulletPoints.length > 0) {
        // 箇条書きがあれば最初の3つ
        summary = bulletPoints
          .slice(0, 3)
          .map((l: string) => l.trim())
          .join(" | ");
      } else {
        // なければ最初の300文字
        summary = update.description.substring(0, 300);
        if (update.description.length > 300) summary += "...";
      }
    }

    return {
      id: update.id,
      title: update.title,
      product: update.product,
      version: update.version,
      releaseDate: update.releaseDate,
      commitDate: update.commitDate,
      summary,
      fileUrl: update.fileUrl,
    };
  });

  // 期間情報を追加
  const dateRange = dateFrom
    ? `${dateFrom} ~ ${input.dateTo || "now"}`
    : "all time";

  return JSON.stringify(
    {
      totalResults: results.length,
      dateRange,
      results: formattedResults,
      availableProducts: products,
      tip: "Use get_d365_update with an ID to get full details including the complete description.",
    },
    null,
    2,
  );
}
