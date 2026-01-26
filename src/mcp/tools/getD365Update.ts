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
      fileUrl: update.fileUrl,
      rawContentUrl: update.rawContentUrl,
    },
    null,
    2,
  );
}
