/**
 * D365 Update MCP 型定義
 */

/**
 * D365 アップデート情報
 */
export interface D365Update {
  id?: number;
  filePath: string;
  title: string;
  description: string | null;
  product: string;
  version: string | null;
  releaseDate: string | null;
  previewDate: string | null;
  gaDate: string | null;
  commitSha: string | null;
  commitDate: string | null;
  firstCommitDate: string | null;
  fileUrl: string;
  rawContentUrl: string;
}

/**
 * D365 コミット情報
 */
export interface D365Commit {
  sha: string;
  message: string;
  author: string | null;
  date: string;
  filesChanged: number | null;
  additions: number | null;
  deletions: number | null;
}

/**
 * 検索フィルター
 */
export interface SearchFilters {
  /** 全文検索クエリ */
  query?: string;
  /** 製品フィルタ（Finance, SCM, HR, Commerce など） */
  product?: string;
  /** バージョンフィルタ（10.0.41 など） */
  version?: string;
  /** 日付範囲（開始） */
  dateFrom?: string;
  /** 日付範囲（終了） */
  dateTo?: string;
  /** 取得件数上限 */
  limit?: number;
  /** オフセット */
  offset?: number;
}

/**
 * 同期結果
 */
export interface SyncResult {
  success: boolean;
  updatesCount: number;
  commitsCount: number;
  durationMs: number;
  error?: string;
}

/**
 * GitHub API レスポンス型
 */
export interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    };
  };
  stats?: {
    additions: number;
    deletions: number;
    total: number;
  };
  files?: Array<{
    filename: string;
    status: string;
    additions: number;
    deletions: number;
  }>;
}

export interface GitHubTreeItem {
  path: string;
  mode: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
  url: string;
}

export interface GitHubTreeResponse {
  sha: string;
  url: string;
  tree: GitHubTreeItem[];
  truncated: boolean;
}

/**
 * 製品マッピング
 */
export const PRODUCT_MAPPING: Record<string, string> = {
  finance: "Dynamics 365 Finance",
  "supply-chain": "Dynamics 365 Supply Chain Management",
  "human-resources": "Dynamics 365 Human Resources",
  commerce: "Dynamics 365 Commerce",
  "fin-ops-core": "Finance and Operations Core",
  "project-operations": "Dynamics 365 Project Operations",
  // Customer Engagement 系
  "customer-service": "Dynamics 365 Customer Service",
  sales: "Dynamics 365 Sales",
  marketing: "Dynamics 365 Marketing",
  "field-service": "Dynamics 365 Field Service",
  // Business Central
  "business-central": "Dynamics 365 Business Central",
  // その他
  "fraud-protection": "Dynamics 365 Fraud Protection",
  "mixed-reality": "Dynamics 365 Mixed Reality",
  "contact-center": "Dynamics 365 Contact Center",
  "intelligent-order-management": "Dynamics 365 Intelligent Order Management",
  industry: "Dynamics 365 Industry Solutions",
  "supply-chain-insights": "Dynamics 365 Supply Chain Insights",
  guidance: "Dynamics 365 Guidance",
  // Legacy
  dynamicsax2012: "Dynamics AX 2012",
  "dynamics-nav": "Dynamics NAV",
  "dynamics-gp": "Dynamics GP",
};

/**
 * 対象リポジトリ設定
 */
export const TARGET_REPOSITORIES = [
  // Finance & Operations 系
  {
    owner: "MicrosoftDocs",
    repo: "dynamics-365-unified-operations-public",
    branch: "main",
    basePath: "articles",
  },
  // Customer Engagement 系 (Sales, Customer Service, Field Service, Marketing)
  {
    owner: "MicrosoftDocs",
    repo: "dynamics-365-customer-engagement",
    branch: "main",
    basePath: "ce",
  },
  // Project Operations
  {
    owner: "MicrosoftDocs",
    repo: "dynamics-365-project-operations",
    branch: "main",
    basePath: "articles",
  },
  // Business Central (開発者向け)
  {
    owner: "MicrosoftDocs",
    repo: "dynamics365smb-devitpro-pb",
    branch: "main",
    basePath: "dev-itpro",
  },
  // Business Central (ユーザー向け)
  {
    owner: "MicrosoftDocs",
    repo: "dynamics365smb-docs",
    branch: "main",
    basePath: "business-central",
  },
  // Fraud Protection
  {
    owner: "MicrosoftDocs",
    repo: "dynamics-365-fraud-protection",
    branch: "main",
    basePath: "content",
  },
  // Mixed Reality (Guides, Remote Assist)
  {
    owner: "MicrosoftDocs",
    repo: "dynamics-365-mixed-reality",
    branch: "main",
    basePath: "mr-docs",
  },
  // Contact Center
  {
    owner: "MicrosoftDocs",
    repo: "dynamics-365-contact-center",
    branch: "main",
    basePath: "contact-center",
  },
  // Guidance (実装ガイド)
  {
    owner: "MicrosoftDocs",
    repo: "dynamics365-guidance",
    branch: "main",
    basePath: "guidance",
  },
  // Intelligent Order Management
  {
    owner: "MicrosoftDocs",
    repo: "dynamics-365-intelligent-order-management",
    branch: "main",
    basePath: "topics",
  },
  // Industry Solutions (Healthcare, Retail, etc.)
  {
    owner: "MicrosoftDocs",
    repo: "dynamics365-industry-solutions",
    branch: "main",
    basePath: "industry",
  },
  // Supply Chain Insights
  {
    owner: "MicrosoftDocs",
    repo: "dynamics-365-supply-chain-insights",
    branch: "main",
    basePath: "articles",
  },
  // ========== Legacy / Historical ==========
  // Dynamics AX 2012 (TechNet)
  {
    owner: "MicrosoftDocs",
    repo: "DynamicsAX2012-technet",
    branch: "main",
    basePath: "dynamicsax2012-technet",
  },
  // Dynamics AX 2012 (MSDN)
  {
    owner: "MicrosoftDocs",
    repo: "DynamicsAX2012-msdn",
    branch: "main",
    basePath: "dynamicsax2012-msdn",
  },
  // Dynamics NAV (legacy, migrated to Business Central)
  {
    owner: "MicrosoftDocs",
    repo: "nav-content",
    branch: "main",
    basePath: "dynamics-nav-app",
  },
  // Dynamics GP
  {
    owner: "MicrosoftDocs",
    repo: "msftdynamicsgpdocs",
    branch: "main",
    basePath: "dynamics-gp",
  },
];
