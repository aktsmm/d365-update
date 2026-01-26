/**
 * search_d365_updates ツール
 *
 * Dynamics 365 アップデート情報を検索
 *
 * ## GitHub Copilot への出力指示（重要）
 *
 * このツールの結果を表示する際は、**全件を省略せず**以下の形式で出力すること：
 *
 * ### 各アップデートの表示形式（Markdown）:
 * ```
 * ### [番号]. [タイトル（日本語訳）]
 * **製品**: [製品名]
 * **概要**: [概要を日本語で]
 *
 * | リンク | URL |
 * |--------|-----|
 * | MS Learn (日本語) | [docsUrl_ja] |
 * | GitHub Commits | [githubCommitsUrl] |
 * ```
 *
 * **重要ルール**:
 * 1. title と summary は必ずユーザーの言語（日本語）に翻訳して表示
 * 2. 全件を省略せず表示（「...他N件」のような省略は禁止）
 * 3. URLはすべてクリック可能なリンクとして出力
 * 4. get_d365_update を追加で呼ぶ必要はない（この検索結果で完結）
 */

import { z } from "zod";
import { getDatabase } from "../database/database.js";
import { searchUpdates, getProducts } from "../database/queries.js";

/**
 * GitHub ファイルパスから Microsoft Learn Docs URL を生成
 * @param fileUrl - GitHub のファイル URL
 * @param locale - ロケール (例: 'ja-jp', 'en-us')
 * @returns Microsoft Learn の URL
 */
function convertToDocsUrl(fileUrl: string, locale: string): string | null {
  // GitHub URL パターン:
  // https://github.com/MicrosoftDocs/dynamics-365-unified-operations-public/blob/main/articles/...
  // https://github.com/MicrosoftDocs/dynamics-365-project-operations/blob/main/articles/...

  const match = fileUrl.match(
    /github\.com\/MicrosoftDocs\/([^/]+)\/blob\/main\/articles\/(.+)\.md$/,
  );
  if (!match) return null;

  const [, repo, path] = match;

  // リポジトリ別のドキュメントベース URL マッピング
  const repoToDocsBase: Record<string, string> = {
    "dynamics-365-unified-operations-public": "dynamics365/unified-operations",
    "dynamics-365-project-operations": "dynamics365/project-operations",
    "dynamics365smb-docs": "dynamics365/business-central",
  };

  const docsBase = repoToDocsBase[repo];
  if (!docsBase) return null;

  // パスから言語固有のセグメントを除去し、URL を構築
  // articles/finance/whats-new/whats-new-*.md → /dynamics365/unified-operations/finance/whats-new/whats-new-*
  return `https://learn.microsoft.com/${locale}/${docsBase}/${path}`;
}

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
  locale: z
    .string()
    .optional()
    .describe(
      "IMPORTANT: Set this based on user's language. Use 'ja-jp' if user writes in Japanese, 'en-us' for English, etc. This affects Microsoft Learn URLs. If user asks in Japanese, ALWAYS set to 'ja-jp'.",
    ),
  limit: z
    .number()
    .min(1)
    .optional()
    .describe(
      "Maximum number of results. If not specified, returns all matching results.",
    ),
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

    // MS Learn URL を日本語・英語両方生成
    const docsUrlJa = convertToDocsUrl(update.fileUrl, "ja-jp");
    const docsUrlEn = convertToDocsUrl(update.fileUrl, "en-us");

    // GitHub コミット履歴リンクを生成
    // fileUrl: https://github.com/MicrosoftDocs/dynamics-365-unified-operations-public/blob/main/articles/...
    // → commits: https://github.com/MicrosoftDocs/dynamics-365-unified-operations-public/commits/main/articles/...
    const commitsUrl = update.fileUrl?.replace("/blob/", "/commits/") || null;

    return {
      id: update.id,
      title: update.title,
      product: update.product,
      version: update.version,
      releaseDate: update.releaseDate,
      commitDate: update.commitDate,
      summary,
      // Microsoft Learn Docs URL（日本語・英語両方）
      docsUrl_ja: docsUrlJa,
      docsUrl_en: docsUrlEn,
      // GitHub ソース・コミット履歴
      githubUrl: update.fileUrl,
      githubCommitsUrl: commitsUrl,
    };
  });

  // 期間情報を追加
  const dateRange = dateFrom
    ? `${dateFrom} ~ ${input.dateTo || "now"}`
    : "all time";

  // ロケール（デフォルト: en-us）
  const locale = input.locale || "en-us";
  const isJapanese = locale.startsWith("ja");

  // サマリ情報を生成
  const productCounts: Record<string, number> = {};

  for (const r of formattedResults) {
    // 製品別カウント
    const prod = r.product || "Unknown";
    productCounts[prod] = (productCounts[prod] || 0) + 1;
  }

  // 言語に応じたメッセージ
  const messages = isJapanese
    ? {
        summary: "📊 サマリ",
        totalResults: "件数",
        period: "期間",
        byProduct: "製品別",
        allResults: "📋 全件一覧（以下をすべて日本語に翻訳して表示）",
        availableProducts: "利用可能な製品フィルタ",
        outputInstruction:
          "⚠️ 出力指示: title と summary を日本語に翻訳し、全件を省略せず表示してください",
      }
    : {
        summary: "📊 Summary",
        totalResults: "Total Results",
        period: "Period",
        byProduct: "By Product",
        allResults: "📋 All Results",
        availableProducts: "Available Product Filters",
        outputInstruction:
          "⚠️ Output Instruction: Display all results without truncation",
      };

  return JSON.stringify(
    {
      [messages.outputInstruction]: true,
      [messages.summary]: {
        [messages.totalResults]: results.length,
        [messages.period]: dateRange,
        [messages.byProduct]: productCounts,
      },
      [messages.allResults]: formattedResults.map((r) => ({
        id: r.id,
        title: r.title,
        product: r.product,
        version: r.version,
        releaseDate: r.releaseDate,
        commitDate: r.commitDate,
        summary: r.summary,
        docsUrl_ja: r.docsUrl_ja,
        docsUrl_en: r.docsUrl_en,
        githubCommitsUrl: r.githubCommitsUrl,
      })),
      [messages.availableProducts]: products,
    },
    null,
    2,
  );
}
