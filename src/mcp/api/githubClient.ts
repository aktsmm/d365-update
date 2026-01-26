/**
 * GitHub API クライアント
 *
 * Dynamics 365 Docs リポジトリから更新情報を取得
 */

import type {
  GitHubCommit,
  GitHubTreeResponse,
  GitHubTreeItem,
  D365Update,
  D365Commit,
} from "../types.js";
import { PRODUCT_MAPPING, TARGET_REPOSITORIES } from "../types.js";
import * as logger from "../utils/logger.js";

/** リトライ設定 */
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * GitHub API fetch with auth
 */
async function githubFetch(url: string, token?: string): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "D365-Update-MCP-Server/0.1.0",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
    logger.info("Using GitHub token for API request", {
      tokenPrefix: token.substring(0, 10),
    });
  } else {
    logger.warn(
      "No GitHub token provided, using unauthenticated request (60/hour limit)",
    );
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, { headers });

      // Rate limit check
      const remaining = response.headers.get("X-RateLimit-Remaining");
      if (remaining && parseInt(remaining) < 10) {
        logger.warn("GitHub API rate limit low", { remaining });
      }

      if (response.status === 403) {
        const resetTime = response.headers.get("X-RateLimit-Reset");
        throw new Error(
          `GitHub API rate limit exceeded. Reset at: ${resetTime ? new Date(parseInt(resetTime) * 1000).toISOString() : "unknown"}`,
        );
      }

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      return response;
    } catch (error) {
      if (attempt === MAX_RETRIES) {
        throw error;
      }
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
    }
  }

  throw new Error("Unreachable");
}

/**
 * what's-new ファイルかどうかを判定
 */
function isWhatsNewFile(path: string): boolean {
  const lowerPath = path.toLowerCase();
  return (
    lowerPath.includes("whats-new") ||
    lowerPath.includes("what-s-new") ||
    lowerPath.includes("release-notes")
  );
}

/**
 * ファイルパスから製品を推測
 */
function inferProduct(filePath: string): string {
  const lowerPath = filePath.toLowerCase();

  for (const [key, value] of Object.entries(PRODUCT_MAPPING)) {
    if (lowerPath.includes(key)) {
      return value;
    }
  }

  return "Dynamics 365";
}

/**
 * ファイルパスからバージョンを抽出
 */
function extractVersion(filePath: string): string | null {
  // 10-0-41 or 10.0.41 パターン
  const versionMatch = filePath.match(/(\d+)[.-]0[.-](\d+)/);
  if (versionMatch) {
    return `10.0.${versionMatch[2]}`;
  }
  return null;
}

/**
 * Markdown ファイルのフロントマターを解析
 */
function parseFrontmatter(content: string): {
  title?: string;
  description?: string;
  date?: string;
} {
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    // フロントマターがない場合、最初の # 見出しをタイトルとして使用
    const titleMatch = content.match(/^#\s+(.+)/m);
    return {
      title: titleMatch?.[1]?.trim(),
    };
  }

  const frontmatter = frontmatterMatch[1];
  const result: { title?: string; description?: string; date?: string } = {};

  const titleMatch = frontmatter.match(/^title:\s*["']?(.+?)["']?\s*$/m);
  if (titleMatch) result.title = titleMatch[1].trim();

  const descMatch = frontmatter.match(/^description:\s*["']?(.+?)["']?\s*$/m);
  if (descMatch) result.description = descMatch[1].trim();

  const dateMatch = frontmatter.match(
    /^(?:ms\.)?date:\s*(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/m,
  );
  if (dateMatch) result.date = dateMatch[1];

  return result;
}

/**
 * リポジトリのツリーを取得
 */
export async function getRepositoryTree(
  owner: string,
  repo: string,
  branch: string,
  token?: string,
): Promise<GitHubTreeItem[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;

  logger.info("Fetching repository tree", { owner, repo, branch });

  const response = await githubFetch(url, token);
  const data = (await response.json()) as GitHubTreeResponse;

  if (data.truncated) {
    logger.warn("Repository tree was truncated", { owner, repo });
  }

  return data.tree;
}

/**
 * what's-new ファイル一覧を取得
 */
export async function getWhatsNewFiles(token?: string): Promise<
  Array<{
    path: string;
    url: string;
    rawUrl: string;
    product: string;
    version: string | null;
    sha: string;
  }>
> {
  const results: Array<{
    path: string;
    url: string;
    rawUrl: string;
    product: string;
    version: string | null;
    sha: string;
  }> = [];

  for (const repo of TARGET_REPOSITORIES) {
    const tree = await getRepositoryTree(
      repo.owner,
      repo.repo,
      repo.branch,
      token,
    );

    for (const item of tree) {
      if (item.type !== "blob") continue;
      if (!item.path.endsWith(".md")) continue;
      if (!item.path.startsWith(repo.basePath)) continue;
      if (!isWhatsNewFile(item.path)) continue;

      results.push({
        path: item.path,
        url: `https://github.com/${repo.owner}/${repo.repo}/blob/${repo.branch}/${item.path}`,
        rawUrl: `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/${repo.branch}/${item.path}`,
        product: inferProduct(item.path),
        version: extractVersion(item.path),
        sha: item.sha,
      });
    }
  }

  logger.info("Found what's-new files", { count: results.length });
  return results;
}

/**
 * ファイルの内容を取得してパース
 */
export async function fetchAndParseFile(
  rawUrl: string,
  filePath: string,
  token?: string,
): Promise<Omit<D365Update, "id">> {
  const response = await githubFetch(rawUrl, token);
  const content = await response.text();

  const metadata = parseFrontmatter(content);
  const product = inferProduct(filePath);
  const version = extractVersion(filePath);

  return {
    filePath,
    title: metadata.title ?? filePath.split("/").pop() ?? "Unknown",
    description: metadata.description ?? null,
    product,
    version,
    releaseDate: metadata.date ?? null,
    previewDate: null,
    gaDate: null,
    commitSha: null,
    commitDate: null,
    firstCommitDate: null,
    fileUrl: rawUrl
      .replace("raw.githubusercontent.com", "github.com")
      .replace("/main/", "/blob/main/"),
    rawContentUrl: rawUrl,
  };
}

/**
 * ファイルの初回コミット日を取得
 */
export async function getFileFirstCommitDate(
  owner: string,
  repo: string,
  filePath: string,
  token?: string,
): Promise<{ date: string; sha: string } | null> {
  // per_page=1 で最後のページを取得することで初回コミットを取得
  // まず全コミット数を確認
  const url = `https://api.github.com/repos/${owner}/${repo}/commits?path=${filePath}&per_page=1`;

  try {
    const response = await githubFetch(url, token);

    // Link ヘッダーから最後のページを取得
    const linkHeader = response.headers.get("Link");
    if (linkHeader) {
      const lastMatch = linkHeader.match(/<([^>]+)>;\s*rel="last"/);
      if (lastMatch) {
        // 最後のページを取得
        const lastResponse = await githubFetch(lastMatch[1], token);
        const lastData = (await lastResponse.json()) as GitHubCommit[];
        if (lastData.length > 0) {
          return {
            date: lastData[lastData.length - 1].commit.author.date,
            sha: lastData[lastData.length - 1].sha,
          };
        }
      }
    }

    // ページネーションがない場合（コミットが1つだけ）
    const data = (await response.json()) as GitHubCommit[];
    if (data.length > 0) {
      return {
        date: data[0].commit.author.date,
        sha: data[0].sha,
      };
    }
  } catch (error) {
    logger.warn("Failed to get file first commit date", {
      filePath,
      error: String(error),
    });
  }

  return null;
}

/**
 * ファイルの最終コミット日を取得
 */
export async function getFileLastCommitDate(
  owner: string,
  repo: string,
  filePath: string,
  token?: string,
): Promise<{ date: string; sha: string } | null> {
  const url = `https://api.github.com/repos/${owner}/${repo}/commits?path=${filePath}&per_page=1`;

  try {
    const response = await githubFetch(url, token);
    const data = (await response.json()) as GitHubCommit[];

    if (data.length > 0) {
      return {
        date: data[0].commit.author.date,
        sha: data[0].sha,
      };
    }
  } catch (error) {
    logger.warn("Failed to get file commit date", {
      filePath,
      error: String(error),
    });
  }

  return null;
}

/**
 * 最近変更されたファイル一覧を取得（コミット経由）
 */
export async function getRecentlyChangedFiles(
  since: string,
  token?: string,
): Promise<Map<string, { date: string; sha: string; message: string }>> {
  const changedFiles = new Map<
    string,
    { date: string; sha: string; message: string }
  >();

  for (const repo of TARGET_REPOSITORIES) {
    const url = `https://api.github.com/repos/${repo.owner}/${repo.repo}/commits?path=${repo.basePath}&per_page=50&since=${since}`;

    try {
      const response = await githubFetch(url, token);
      const commits = (await response.json()) as GitHubCommit[];

      for (const commit of commits) {
        // コミットの詳細を取得（変更されたファイル一覧）
        const detailUrl = `https://api.github.com/repos/${repo.owner}/${repo.repo}/commits/${commit.sha}`;
        const detailResponse = await githubFetch(detailUrl, token);
        const detail = (await detailResponse.json()) as {
          files?: Array<{ filename: string; status: string }>;
        };

        if (detail.files) {
          for (const file of detail.files) {
            if (
              isWhatsNewFile(file.filename) &&
              file.filename.endsWith(".md")
            ) {
              // 最新のコミット日を保持
              const existing = changedFiles.get(file.filename);
              if (
                !existing ||
                new Date(commit.commit.author.date) > new Date(existing.date)
              ) {
                changedFiles.set(file.filename, {
                  date: commit.commit.author.date,
                  sha: commit.sha,
                  message: commit.commit.message
                    .split("\n")[0]
                    .substring(0, 100),
                });
              }
            }
          }
        }
      }
    } catch (error) {
      logger.warn("Failed to get recent commits for repo", {
        repo: repo.repo,
        error: String(error),
      });
    }
  }

  logger.info("Found recently changed files", { count: changedFiles.size });
  return changedFiles;
}

/**
 * 最近のコミットを取得
 */
export async function getRecentCommits(
  since?: string,
  token?: string,
): Promise<D365Commit[]> {
  const commits: D365Commit[] = [];

  for (const repo of TARGET_REPOSITORIES) {
    let url = `https://api.github.com/repos/${repo.owner}/${repo.repo}/commits?path=${repo.basePath}&per_page=100`;
    if (since) {
      url += `&since=${since}`;
    }

    const response = await githubFetch(url, token);
    const data = (await response.json()) as GitHubCommit[];

    for (const commit of data) {
      // what's-new 関連のコミットのみフィルタ
      if (
        commit.commit.message.toLowerCase().includes("whats-new") ||
        commit.commit.message.toLowerCase().includes("what's new") ||
        commit.commit.message.toLowerCase().includes("release")
      ) {
        commits.push({
          sha: commit.sha,
          message: commit.commit.message.split("\n")[0].substring(0, 200),
          author: commit.commit.author.name,
          date: commit.commit.author.date,
          filesChanged: commit.stats?.total ?? null,
          additions: commit.stats?.additions ?? null,
          deletions: commit.stats?.deletions ?? null,
        });
      }
    }
  }

  logger.info("Fetched recent commits", { count: commits.length });
  return commits;
}
