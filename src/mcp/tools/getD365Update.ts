/**
 * get_d365_update ツール
 *
 * ID 指定で D365 アップデートの詳細を取得
 */

import { z } from "zod";
import { getDatabase } from "../database/database.js";
import { getUpdateById } from "../database/queries.js";

/**
 * ツール入力スキーマ
 */
export const getD365UpdateSchema = z.object({
  id: z.number().describe("Unique identifier of the D365 update (required)"),
});

export type GetD365UpdateInput = z.infer<typeof getD365UpdateSchema>;

/**
 * 参考 URL を生成
 */
function generateReferenceUrls(
  title: string,
  product: string,
  version?: string | null,
): {
  learnSearchUrl: string;
  learnSearchUrlJa: string;
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
            : "dynamics365";

  const searchTerms = encodeURIComponent(
    `${product} ${version || ""} what's new`,
  );

  return {
    learnSearchUrl: `https://learn.microsoft.com/en-us/search/?terms=${searchTerms}`,
    learnSearchUrlJa: `https://learn.microsoft.com/ja-jp/search/?terms=${searchTerms}`,
    productDocsUrl: `https://learn.microsoft.com/ja-jp/${productPath}/get-started/whats-new-home-page`,
  };
}

/**
 * ツール実行
 */
export async function executeGetD365Update(
  input: GetD365UpdateInput,
): Promise<string> {
  const db = getDatabase();

  const update = getUpdateById(db, input.id);

  if (!update) {
    return JSON.stringify({
      error: `Update with ID ${input.id} not found`,
      suggestion: "Use search_d365_updates to find valid update IDs",
    });
  }

  // 参考 URL を生成
  const urls = generateReferenceUrls(
    update.title,
    update.product,
    update.version,
  );

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
      // ソースファイル
      sourceUrl: update.fileUrl,
      rawContentUrl: update.rawContentUrl,
      // 参考リンク
      references: {
        learnSearchUrl: urls.learnSearchUrlJa,
        learnSearchUrlEn: urls.learnSearchUrl,
        productDocsUrl: urls.productDocsUrl,
      },
    },
    null,
    2,
  );
}
