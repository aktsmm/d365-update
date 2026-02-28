/**
 * GitHub ファイル URL から Microsoft Learn Docs URL を生成
 */

interface DocsRepoConfig {
  basePath: string;
  docsBase: string;
  pathPrefix?: string;
}

const DOCS_REPO_CONFIG: Record<string, DocsRepoConfig> = {
  // Finance & Operations 系
  "dynamics-365-unified-operations-public": {
    basePath: "articles",
    docsBase: "dynamics365/unified-operations",
  },
  // Project Operations
  "dynamics-365-project-operations": {
    basePath: "articles",
    docsBase: "dynamics365/project-operations",
  },
  // Business Central
  "dynamics365smb-docs": {
    basePath: "business-central",
    docsBase: "dynamics365/business-central",
  },
  "dynamics365smb-devitpro-pb": {
    basePath: "dev-itpro",
    docsBase: "dynamics365/business-central/dev-itpro",
  },
  // Mixed Reality
  "dynamics-365-mixed-reality": {
    basePath: "mr-docs",
    docsBase: "dynamics365",
    pathPrefix: "",
  },
  // Fraud Protection
  "dynamics-365-fraud-protection": {
    basePath: "content",
    docsBase: "dynamics365/fraud-protection",
  },
  // Contact Center
  "dynamics-365-contact-center": {
    basePath: "contact-center",
    docsBase: "dynamics365/contact-center",
  },
  // Customer Engagement
  "dynamics-365-customer-engagement": {
    basePath: "ce",
    docsBase: "dynamics365/customerengagement",
  },
  // Guidance
  "dynamics365-guidance": {
    basePath: "guidance",
    docsBase: "dynamics365/guidance",
  },
};

function normalizeLocale(locale: string): string {
  const normalized = locale.trim().toLowerCase();
  return normalized || "en-us";
}

/**
 * GitHub の markdown ファイル URL を MS Learn URL に変換する
 */
export function convertToDocsUrl(
  fileUrl: string,
  locale: string,
): string | null {
  const match = fileUrl.match(
    /github\.com\/MicrosoftDocs\/([^/]+)\/blob\/[^/]+\/(.+)\.md$/,
  );
  if (!match) return null;

  const [, repo, fullPath] = match;
  const config = DOCS_REPO_CONFIG[repo];
  if (!config) return null;

  if (!fullPath.startsWith(`${config.basePath}/`)) return null;
  const docPath = fullPath.substring(config.basePath.length + 1);

  const pathSegments = [config.docsBase];
  if (config.pathPrefix) {
    pathSegments.push(config.pathPrefix);
  }
  pathSegments.push(docPath);

  return `https://learn.microsoft.com/${normalizeLocale(locale)}/${pathSegments.join("/")}`;
}
