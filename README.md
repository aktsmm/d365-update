# D365 UPDATE MCP

[![Status](https://badgen.net/badge/Status/Beta/orange)](https://marketplace.visualstudio.com/items?itemName=yamapan.d365-update)
[![VS Marketplace](https://badgen.net/vs-marketplace/v/yamapan.d365-update)](https://marketplace.visualstudio.com/items?itemName=yamapan.d365-update)
[![Installs](https://badgen.net/vs-marketplace/i/yamapan.d365-update)](https://marketplace.visualstudio.com/items?itemName=yamapan.d365-update)
[![License](https://badgen.net/badge/License/CC%20BY-NC-SA%204.0/gray)](LICENSE)
[![GitHub](https://badgen.net/badge/GitHub/Source/black)](https://github.com/aktsmm/d365-update)

> ⚠️ **Beta Version**: This extension is currently in beta. Features and APIs may change. Feedback and bug reports are welcome!

<p align="center">
  <strong>Search and retrieve Dynamics 365 update information from GitHub Docs via Copilot Chat</strong>
</p>

<p align="center">
  🇯🇵 <a href="README_ja.md">日本語版はこちら</a>
</p>

---

## 🆕 Latest Release (v0.3.11)

- Fixed startup fallback for environments without FTS5 support
- Ensured `schema.sql`, `sql-wasm.wasm`, and bundled DB are packaged correctly
- Switched the MCP runtime entrypoint to `dist/mcp/index.mjs`
- Added contract tests to prevent `.js`/`.mjs` drift across package, extension, and VS Code configs
- Moved local VSIX packaging into `artifacts/vsix/` and prune old archives automatically

### Links

- Release: https://github.com/aktsmm/d365-update/releases/tag/v0.3.11
- Compare: https://github.com/aktsmm/d365-update/compare/v0.3.10...v0.3.11
- Marketplace: https://marketplace.visualstudio.com/items?itemName=yamapan.d365-update

## ✨ Features

- 🔍 **Natural Language Search**: Ask "What's new in D365 Finance 10.0.41?" in Copilot Chat
- 🚀 **Fast Search**: Local full-text search powered by SQLite + FTS5
- 🔄 **GitHub Sync**: Syncs directly from 16 MicrosoftDocs repositories
- 📊 **Rich Filters**: Filter by product, version, and date
- ⚙️ **Zero Config**: Automatically registers as MCP tool on installation
- 📅 **Recent Changes**: Track file modifications within the last week
- 🔗 **Reference URLs**: Direct links to GitHub source files
- 🌐 **Multi-language Support**: Auto-detects user language and returns localized Microsoft Learn URLs
- 🗣️ **Auto Translation**: Copilot translates titles and summaries to your language

## 🛠️ Technical Highlights

### 📦 Bundled Database - Zero Wait on First Use

The extension ships with a pre-built database containing the latest update information.
New users can search immediately after installation—no sync required!

- Database is bundled at package time
- Automatically copied to user directory on first launch
- Users can sync later to get the absolute latest data

### 🚀 Repository-Level Incremental Sync

Instead of fetching all files every time, we implemented **two-level diff checking**:

| Level             | What it checks             | API calls              |
| ----------------- | -------------------------- | ---------------------- |
| **1. Repository** | Latest commit SHA per repo | 16 calls (lightweight) |
| **2. File**       | File content SHA           | Only for changed repos |

**Result:**
| Scenario | Time |
|----------|------|
| Full sync (force) | ~200s |
| Incremental (changes) | ~26s |
| **Incremental (no changes)** | **~3s** ⚡ |

### ⚡ Parallel Processing

All GitHub API calls leverage parallel execution with semaphore-based concurrency control:

```
Tree fetching:    4 parallel requests
File processing:  5 parallel requests
Commit fetching:  4 parallel requests
```

### 🔄 Background Auto-Sync

MCP server automatically syncs in the background on startup:

- Non-blocking: Search works immediately using cached data
- Incremental: Only fetches changes since last sync
- Silent: No user intervention required

## 📦 Installation

1. Search for "D365 UPDATE" in VS Code Extension Marketplace
2. Or run: `ext install yamapan.d365-update`
3. Reload VS Code
4. The tool automatically appears in Copilot Chat's tool list! 🎉

### ⏳ First-Time Use

On first use, data synchronization from GitHub runs automatically. This may take **1-2 minutes** depending on your network speed. Subsequent uses are instant thanks to local caching.

### GitHub Token Setup (Recommended)

GitHub API has rate limits. Setting a token increases the limit significantly:

|            | Without Token | With Token        |
| ---------- | ------------- | ----------------- |
| Rate Limit | 60/hour       | **5,000/hour** ✨ |

**Setup in VS Code:**

1. Open Settings (`Ctrl+,`)
2. Search for `d365Update.githubToken`
3. Click **"Create a token here"** link → Creates token with correct scopes
4. Paste the token

> 💡 The token needs `public_repo` scope only.
>
> ⚠️ **Token Lifetime**: Must be 90 days or less (Microsoft Open Source policy).
>
> 📝 **Microsoft Employees**: Join MicrosoftDocs org via Open Source Portal and authorize SSO for your token.

## 🎯 Usage

Ask Copilot Chat like this:

```
"What's new in D365 Finance 10.0.41?"     → Version-specific search
"D365 Commerce の新機能は？"              → Product search
"SCM の倉庫管理の最新アップデート"         → Keyword + product search
"Business Central の最新変更点"           → BC product search
"今週の D365 アップデート"                → Recent changes
```

### Default Behavior

- **No filters**: Returns last 1 month's updates (prevents overwhelming results)
- **With query/version**: Searches all time
- **Summary included**: First key points for quick overview

## 🛠️ MCP Tools

| Tool                  | Description                                           |
| --------------------- | ----------------------------------------------------- |
| `search_d365_updates` | Search with keywords & filters (lightweight metadata) |
| `get_d365_update`     | Get full details by ID                                |
| `sync_d365_updates`   | Sync data from GitHub                                 |

### search_d365_updates Parameters

| Parameter  | Type   | Description                                               |
| ---------- | ------ | --------------------------------------------------------- |
| `query`    | string | Search keyword (full-text search on title & description)  |
| `product`  | string | Filter by product (e.g., `Dynamics 365 Finance`)          |
| `version`  | string | Filter by version (e.g., `10.0.41`)                       |
| `dateFrom` | string | Date range start (`YYYY-MM-DD`)                           |
| `dateTo`   | string | Date range end (`YYYY-MM-DD`)                             |
| `locale`   | string | Language for URLs (e.g., `ja-jp`, `en-us`). Auto-detected |
| `limit`    | number | Max results (default: all matching results)               |

### Response Example

```json
{
  "totalResults": 5,
  "dateRange": "2026-01-01 ~ now",
  "results": [
    {
      "id": 123,
      "title": "What's new in Dynamics 365 Finance 10.0.41",
      "product": "Dynamics 365 Finance",
      "version": "10.0.41",
      "summary": "New features include...",
      "docsUrl": "https://learn.microsoft.com/en-us/dynamics365/finance/...",
      "githubUrl": "https://github.com/MicrosoftDocs/.../blob/main/...",
      "githubCommitsUrl": "https://github.com/MicrosoftDocs/.../commits/main/..."
    }
  ]
}
```

## 📊 Data Sources

Syncs from **16 MicrosoftDocs repositories**:

### Current Products (Dynamics 365)

| Repository                                                                                                              | Products                                          |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| [dynamics-365-unified-operations-public](https://github.com/MicrosoftDocs/dynamics-365-unified-operations-public)       | Finance, SCM, HR, Commerce                        |
| [dynamics-365-customer-engagement](https://github.com/MicrosoftDocs/dynamics-365-customer-engagement)                   | Sales, Customer Service, Field Service, Marketing |
| [dynamics-365-project-operations](https://github.com/MicrosoftDocs/dynamics-365-project-operations)                     | Project Operations                                |
| [dynamics365smb-devitpro-pb](https://github.com/MicrosoftDocs/dynamics365smb-devitpro-pb)                               | Business Central (Dev)                            |
| [dynamics365smb-docs](https://github.com/MicrosoftDocs/dynamics365smb-docs)                                             | Business Central (User)                           |
| [dynamics-365-fraud-protection](https://github.com/MicrosoftDocs/dynamics-365-fraud-protection)                         | Fraud Protection                                  |
| [dynamics-365-mixed-reality](https://github.com/MicrosoftDocs/dynamics-365-mixed-reality)                               | Guides, Remote Assist                             |
| [dynamics-365-contact-center](https://github.com/MicrosoftDocs/dynamics-365-contact-center)                             | Contact Center                                    |
| [dynamics365-guidance](https://github.com/MicrosoftDocs/dynamics365-guidance)                                           | Implementation Guidance                           |
| [dynamics-365-intelligent-order-management](https://github.com/MicrosoftDocs/dynamics-365-intelligent-order-management) | IOM                                               |
| [dynamics365-industry-solutions](https://github.com/MicrosoftDocs/dynamics365-industry-solutions)                       | Healthcare, Retail, etc.                          |
| [dynamics-365-supply-chain-insights](https://github.com/MicrosoftDocs/dynamics-365-supply-chain-insights)               | Supply Chain Insights                             |

### Legacy Products (Historical Reference)

| Repository                                                                        | Products         | Note                         |
| --------------------------------------------------------------------------------- | ---------------- | ---------------------------- |
| [DynamicsAX2012-technet](https://github.com/MicrosoftDocs/DynamicsAX2012-technet) | Dynamics AX 2012 | TechNet docs                 |
| [DynamicsAX2012-msdn](https://github.com/MicrosoftDocs/DynamicsAX2012-msdn)       | Dynamics AX 2012 | MSDN/Developer docs          |
| [nav-content](https://github.com/MicrosoftDocs/nav-content)                       | Dynamics NAV     | Migrated to Business Central |
| [msftdynamicsgpdocs](https://github.com/MicrosoftDocs/msftdynamicsgpdocs)         | Dynamics GP      | Great Plains                 |

---

## 🐛 Troubleshooting

### Issue: "Failed to initialize database" or "no such module: fts5"

**Cause**: SQLite FTS5 extension is not available in your environment

**Solution**: The extension automatically falls back to standard search without FTS5. Your searches will work but may be slightly slower. No action is required.

- ✅ Extension will auto-detect and adapt
- ✅ Local full-text search still works
- ✅ All features remain functional

### Issue: "Cannot find module ... dist/mcp/index.mjs" after update or profile change

**Cause**: User settings contain an absolute path (e.g., `c:\Users\<old-username>\...\d365-update\dist\mcp\index.mjs`) that becomes invalid when:

- Windows username changes
- User home directory moves
- Profile is recreated

**Solution**: Use the **relative path** with `${extensionPath}` variable instead:

```json
// ❌ DO NOT USE (absolute path)
"d365-update": {
  "command": "node",
  "args": ["c:\\Users\\admin\\...\\d365-update-0.3.9\\dist\\mcp\\index.mjs"]
}

// ✅ RECOMMENDED (relative path)
"d365-update": {
  "command": "node",
  "args": ["${extensionPath}/dist/mcp/index.mjs"]
}
```

If you've manually added this extension to VS Code settings, update it using the relative path format.

### Issue: "Cannot use import statement outside a module"

**Cause**: The MCP entrypoint is an ES module, but Node.js was asked to load a `.js` path under a CommonJS package boundary.

**Solution**: This is fixed in v0.3.9+ by shipping the MCP entrypoint as `dist/mcp/index.mjs` and registering that exact path in the extension manifest and `mcp.json` update flow.

### Issue: Node.js warnings during startup

**Example**: `[MODULE_TYPELESS_PACKAGE_JSON] Warning`

**Cause**: Node.js v20+ requires explicit module type declaration

**Solution**: This is fixed in v0.3.10+. Upgrade via VS Code Marketplace for the latest build with proper module declarations.

---

## 📝 License

Licensed under [CC BY-NC-SA 4.0](LICENSE)

## 📦 Supported Products

### Finance & Operations

- Dynamics 365 Finance
- Dynamics 365 Supply Chain Management
- Dynamics 365 Human Resources
- Dynamics 365 Commerce
- Dynamics 365 Project Operations

### Customer Engagement

- Dynamics 365 Sales
- Dynamics 365 Customer Service
- Dynamics 365 Field Service
- Dynamics 365 Marketing

### Other Products

- Dynamics 365 Business Central
- Dynamics 365 Fraud Protection
- Dynamics 365 Mixed Reality (Guides, Remote Assist)
- Dynamics 365 Contact Center
- Dynamics 365 Intelligent Order Management
- Dynamics 365 Industry Solutions
- Dynamics 365 Supply Chain Insights

### Legacy Products

- Dynamics AX 2012
- Dynamics NAV
- Dynamics GP

## ⚙️ Configuration

| Setting                        | Description                   | Default |
| ------------------------------ | ----------------------------- | ------- |
| `d365Update.githubToken`       | GitHub Personal Access Token  | ``      |
| `d365Update.autoSync`          | Automatically sync on startup | `true`  |
| `d365Update.syncIntervalHours` | Hours between auto sync       | `24`    |

## 🔧 Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Test with MCP Inspector
npm run inspect

# Package for distribution (writes to artifacts/vsix/)
npm run package
```

## 📝 Tech Stack

- **MCP SDK**: `@modelcontextprotocol/sdk`
- **Database**: SQLite via `sql.js` (WebAssembly) with FTS5 fallback
- **Data Source**: GitHub API (MicrosoftDocs repositories)
- **VS Code API**: Extension integration

## 📄 License

[CC-BY-NC-SA-4.0](LICENSE)

---

© 2026 yamapan (aktsmm)
