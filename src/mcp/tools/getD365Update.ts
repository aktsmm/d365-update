/**
 * get_d365_update ツール
 *
 * ID 指定で D365 アップデートの詳細を取得
 */

import { z } from "zod";
import { getDatabase } from "../database/database.js";
import { getUpdateById } from "../database/queries.js";
import { convertToDocsUrl } from "../utils/docsUrl.js";

/**
 * ツール入力スキーマ
 */
export const getD365UpdateSchema = z.object({
  id: z.number().describe("Unique identifier of the D365 update (required)"),
  locale: z
    .string()
    .optional()
    .describe(
      "IMPORTANT: Set this based on user's language. Use 'ja-jp' if user writes in Japanese, 'en-us' for English. This affects Microsoft Learn URLs in response.",
    ),
});

export type GetD365UpdateInput = z.infer<typeof getD365UpdateSchema>;

/**
 * 参考 URL を生成
 */
function generateReferenceUrls(
  product: string,
  version: string | null | undefined,
  locale: string,
): {
  learnSearchUrl: string;
  productDocsUrl: string;
} {
  // 製品名からドキュメントパスを推測
  const productPath = product.toLowerCase().includes("finance")
    ? "dynamics365/finance"
    : product.toLowerCase().includes("supply chain")
      ? "dynamics365/supply-chain"
      : product.toLowerCase().includes("commerce")
        ? "dynamics365/commerce"
        : product.toLowerCase().includes("human resources")
          ? "dynamics365/human-resources"
          : product.toLowerCase().includes("business central")
            ? "dynamics365/business-central"
            : product.toLowerCase().includes("project operations")
              ? "dynamics365/project-operations"
              : "dynamics365";

  const searchTerms = encodeURIComponent(
    `${product} ${version || ""} what's new`,
  );

  return {
    learnSearchUrl: `https://learn.microsoft.com/${locale}/search/?terms=${searchTerms}`,
    productDocsUrl: `https://learn.microsoft.com/${locale}/${productPath}/get-started/whats-new-home-page`,
  };
}

/**
 * ツール実行
 */
export async function executeGetD365Update(
  input: GetD365UpdateInput,
): Promise<string> {
  const db = await getDatabase();

  const update = getUpdateById(db, input.id);

  if (!update) {
    return JSON.stringify({
      error: `Update with ID ${input.id} not found`,
      suggestion: "Use search_d365_updates to find valid update IDs",
    });
  }

  // ロケール（デフォルト: en-us）
  const locale = input.locale || "en-us";

  // 参考 URL を生成
  const urls = generateReferenceUrls(update.product, update.version, locale);

  // Docs URL を生成
  const docsUrl =
    convertToDocsUrl(update.fileUrl, locale) || urls.learnSearchUrl;

  // GitHub コミット履歴リンク
  const commitsUrl = update.fileUrl?.replace("/blob/", "/commits/") || null;

  return JSON.stringify(
    {
      id: update.id,
      title: update.title,
      product: update.product,
      version: update.version,
      description: update.description,
      releaseDate: update.releaseDate,
      previewDate: update.previewDate,
      gaDate: update.gaDate,
      lastCommitDate: update.commitDate,
      // Microsoft Learn Docs URL（言語対応）
      docsUrl,
      // GitHub ソース・コミット履歴
      githubUrl: update.fileUrl,
      githubCommitsUrl: commitsUrl,
      rawContentUrl: update.rawContentUrl,
      // 参考リンク
      references: {
        learnSearchUrl: urls.learnSearchUrl,
        productDocsUrl: urls.productDocsUrl,
      },
    },
    null,
    2,
  );
}
