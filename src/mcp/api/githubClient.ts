/**
 * GitHub API クライアント
 *
 * Dynamics 365 Docs リポジトリから更新情報を取得
 * 並列処理対応版
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

/** 並列処理設定 */
const PARALLEL_TREE_LIMIT = 4; // ツリー取得の同時実行数
const PARALLEL_FILE_LIMIT = 5; // ファイル処理の同時実行数
const PARALLEL_COMMIT_LIMIT = 4; // コミット取得の同時実行数

/**
 * 並列処理用のセマフォ
 */
class Semaphore {
  private queue: Array<() => void> = [];
  private running = 0;

  constructor(private limit: number) {}

  async acquire(): Promise<void> {
    if (this.running < this.limit) {
      this.running++;
      return;
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.running++;
  }

  release(): void {
    this.running--;
    const next = this.queue.shift();
    if (next) next();
  }
}

/**
 * 並列実行ヘルパー（制限付き）
 */
async function parallelLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const semaphore = new Semaphore(limit);
  return Promise.all(
    items.map(async (item) => {
      await semaphore.acquire();
      try {
        return await fn(item);
      } finally {
        semaphore.release();
      }
    }),
  );
}

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
 * リポジトリの最新コミットSHAを取得（軽量チェック用）
 * ツリー全体を取得せず、ブランチの最新コミットだけ確認
 */
export async function getRepositoryLatestCommitSha(
  owner: string,
  repo: string,
  branch: string,
  token?: string,
): Promise<string | null> {
  const url = `https://api.github.com/repos/${owner}/${repo}/commits/${branch}`;

  try {
    const response = await githubFetch(url, token);
    const data = (await response.json()) as { sha: string };
    return data.sha;
  } catch (error) {
    logger.warn("Failed to get latest commit SHA", {
      owner,
      repo,
      error: String(error),
    });
    return null;
  }
}

/**
 * 全リポジトリの最新コミットSHAを並列取得
 */
export async function getAllRepositoryLatestShas(
  token?: string,
): Promise<Map<string, string>> {
  logger.info("Checking repository latest commits (lightweight)", {
    repoCount: TARGET_REPOSITORIES.length,
  });

  const results = await parallelLimit(
    TARGET_REPOSITORIES,
    PARALLEL_TREE_LIMIT,
    async (repo) => {
      const sha = await getRepositoryLatestCommitSha(
        repo.owner,
        repo.repo,
        repo.branch,
        token,
      );
      return { key: `${repo.owner}/${repo.repo}`, sha };
    },
  );

  const shaMap = new Map<string, string>();
  for (const { key, sha } of results) {
    if (sha) shaMap.set(key, sha);
  }

  logger.info("Got repository SHAs", { count: shaMap.size });
  return shaMap;
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
 * what's-new ファイル一覧を取得（並列処理版）
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
  logger.info("Fetching what's-new files (parallel)", {
    repoCount: TARGET_REPOSITORIES.length,
    parallelLimit: PARALLEL_TREE_LIMIT,
  });

  // 各リポジトリのツリー取得を並列化
  const repoResults = await parallelLimit(
    TARGET_REPOSITORIES,
    PARALLEL_TREE_LIMIT,
    async (repo) => {
      const tree = await getRepositoryTree(
        repo.owner,
        repo.repo,
        repo.branch,
        token,
      );

      const files: Array<{
        path: string;
        url: string;
        rawUrl: string;
        product: string;
        version: string | null;
        sha: string;
      }> = [];

      for (const item of tree) {
        if (item.type !== "blob") continue;
        if (!item.path.endsWith(".md")) continue;
        if (!item.path.startsWith(repo.basePath)) continue;
        if (!isWhatsNewFile(item.path)) continue;

        files.push({
          path: item.path,
          url: `https://github.com/${repo.owner}/${repo.repo}/blob/${repo.branch}/${item.path}`,
          rawUrl: `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/${repo.branch}/${item.path}`,
          product: inferProduct(item.path),
          version: extractVersion(item.path),
          sha: item.sha,
        });
      }

      return files;
    },
  );

  const results = repoResults.flat();
  logger.info("Found what's-new files", { count: results.length });
  return results;
}

/**
 * 変更があったリポジトリのみの what's-new ファイル一覧を取得
 * リポジトリレベルの差分チェックで高速化
 */
export async function getWhatsNewFilesIncremental(
  previousShaMap: Map<string, string>,
  token?: string,
): Promise<{
  files: Array<{
    path: string;
    url: string;
    rawUrl: string;
    product: string;
    version: string | null;
    sha: string;
  }>;
  newShaMap: Map<string, string>;
  changedRepos: string[];
  skippedRepos: string[];
}> {
  // 1. 全リポジトリの最新コミットSHAを取得（軽量）
  const currentShaMap = await getAllRepositoryLatestShas(token);

  // 2. 変更があったリポジトリを特定
  const changedRepos: typeof TARGET_REPOSITORIES = [];
  const skippedRepoNames: string[] = [];

  for (const repo of TARGET_REPOSITORIES) {
    const repoKey = `${repo.owner}/${repo.repo}`;
    const previousSha = previousShaMap.get(repoKey);
    const currentSha = currentShaMap.get(repoKey);

    if (!previousSha || previousSha !== currentSha) {
      changedRepos.push(repo);
    } else {
      skippedRepoNames.push(repoKey);
    }
  }

  logger.info("Repository-level diff check", {
    total: TARGET_REPOSITORIES.length,
    changed: changedRepos.length,
    skipped: skippedRepoNames.length,
  });

  // 3. 変更があったリポジトリのみツリー取得
  if (changedRepos.length === 0) {
    logger.info("No repositories changed, skipping tree fetch");
    return {
      files: [],
      newShaMap: currentShaMap,
      changedRepos: [],
      skippedRepos: skippedRepoNames,
    };
  }

  const repoResults = await parallelLimit(
    changedRepos,
    PARALLEL_TREE_LIMIT,
    async (repo) => {
      const tree = await getRepositoryTree(
        repo.owner,
        repo.repo,
        repo.branch,
        token,
      );

      const files: Array<{
        path: string;
        url: string;
        rawUrl: string;
        product: string;
        version: string | null;
        sha: string;
      }> = [];

      for (const item of tree) {
        if (item.type !== "blob") continue;
        if (!item.path.endsWith(".md")) continue;
        if (!item.path.startsWith(repo.basePath)) continue;
        if (!isWhatsNewFile(item.path)) continue;

        files.push({
          path: item.path,
          url: `https://github.com/${repo.owner}/${repo.repo}/blob/${repo.branch}/${item.path}`,
          rawUrl: `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/${repo.branch}/${item.path}`,
          product: inferProduct(item.path),
          version: extractVersion(item.path),
          sha: item.sha,
        });
      }

      return files;
    },
  );

  const files = repoResults.flat();
  logger.info("Found what's-new files from changed repos", {
    count: files.length,
  });

  return {
    files,
    newShaMap: currentShaMap,
    changedRepos: changedRepos.map((r) => `${r.owner}/${r.repo}`),
    skippedRepos: skippedRepoNames,
  };
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
 * 最近変更されたファイル一覧を取得（コミット経由・並列処理版）
 */
export async function getRecentlyChangedFiles(
  since: string,
  token?: string,
): Promise<Map<string, { date: string; sha: string; message: string }>> {
  const changedFiles = new Map<
    string,
    { date: string; sha: string; message: string }
  >();

  logger.info("Fetching recently changed files (parallel)", {
    since,
    parallelLimit: PARALLEL_COMMIT_LIMIT,
  });

  // 各リポジトリを並列で処理
  const repoResults = await parallelLimit(
    TARGET_REPOSITORIES,
    PARALLEL_COMMIT_LIMIT,
    async (repo) => {
      const localChanges = new Map<
        string,
        { date: string; sha: string; message: string }
      >();

      const url = `https://api.github.com/repos/${repo.owner}/${repo.repo}/commits?path=${repo.basePath}&per_page=50&since=${since}`;

      try {
        const response = await githubFetch(url, token);
        const commits = (await response.json()) as GitHubCommit[];

        // コミット詳細取得も並列化（最大5件まで）
        const commitDetails = await parallelLimit(
          commits.slice(0, 10),
          PARALLEL_FILE_LIMIT,
          async (commit) => {
            const detailUrl = `https://api.github.com/repos/${repo.owner}/${repo.repo}/commits/${commit.sha}`;
            const detailResponse = await githubFetch(detailUrl, token);
            const detail = (await detailResponse.json()) as {
              files?: Array<{ filename: string; status: string }>;
            };
            return { commit, detail };
          },
        );

        for (const { commit, detail } of commitDetails) {
          if (detail.files) {
            for (const file of detail.files) {
              if (
                isWhatsNewFile(file.filename) &&
                file.filename.endsWith(".md")
              ) {
                const existing = localChanges.get(file.filename);
                if (
                  !existing ||
                  new Date(commit.commit.author.date) > new Date(existing.date)
                ) {
                  localChanges.set(file.filename, {
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

      return localChanges;
    },
  );

  // 結果をマージ
  for (const localChanges of repoResults) {
    for (const [filename, info] of localChanges) {
      const existing = changedFiles.get(filename);
      if (!existing || new Date(info.date) > new Date(existing.date)) {
        changedFiles.set(filename, info);
      }
    }
  }

  logger.info("Found recently changed files", { count: changedFiles.size });
  return changedFiles;
}

/**
 * 最近のコミットを取得（並列処理版）
 */
export async function getRecentCommits(
  since?: string,
  token?: string,
): Promise<D365Commit[]> {
  logger.info("Fetching recent commits (parallel)", {
    since,
    parallelLimit: PARALLEL_COMMIT_LIMIT,
  });

  // 各リポジトリを並列で処理
  const repoResults = await parallelLimit(
    TARGET_REPOSITORIES,
    PARALLEL_COMMIT_LIMIT,
    async (repo) => {
      let url = `https://api.github.com/repos/${repo.owner}/${repo.repo}/commits?path=${repo.basePath}&per_page=100`;
      if (since) {
        url += `&since=${since}`;
      }

      try {
        const response = await githubFetch(url, token);
        const data = (await response.json()) as GitHubCommit[];

        return data
          .filter((commit) => {
            const msg = commit.commit.message.toLowerCase();
            return (
              msg.includes("whats-new") ||
              msg.includes("what's new") ||
              msg.includes("release")
            );
          })
          .map((commit) => ({
            sha: commit.sha,
            message: commit.commit.message.split("\n")[0].substring(0, 200),
            author: commit.commit.author.name,
            date: commit.commit.author.date,
            filesChanged: commit.stats?.total ?? null,
            additions: commit.stats?.additions ?? null,
            deletions: commit.stats?.deletions ?? null,
          }));
      } catch (error) {
        logger.warn("Failed to get commits for repo", {
          repo: repo.repo,
          error: String(error),
        });
        return [];
      }
    },
  );

  const commits = repoResults.flat();
  logger.info("Fetched recent commits", { count: commits.length });
  return commits;
}
