# Changelog

All notable changes to this project will be documented in this file.

## [0.1.3] - 2026-01-26

### Fixed

- 🐛 MCP サーバー起動失敗を修正（`@modelcontextprotocol/sdk` が見つからないエラー）
- 📦 esbuild で依存関係をバンドルするように変更
- 📦 `better-sqlite3` を拡張機能パッケージに含めるよう `.vscodeignore` を修正

## [0.1.0] - 2026-01-26

### Added

- 🎉 Initial release
- 🔍 `search_d365_updates`: Full-text search with filters (product, version, date)
- 📄 `get_d365_update`: Get detailed information by ID
- 🔄 `sync_d365_updates`: Sync data from GitHub repositories
- 📦 Support for 16 MicrosoftDocs repositories
- 📅 Default 1-month date filter (prevents overwhelming results)
- 📝 Summary extraction (bullet points or first 300 chars)
- ⏰ File modification tracking (commit date from GitHub)
- ⚙️ VS Code settings for GitHub Token
- 🔗 Direct link to GitHub Token creation page
- 🌐 English and Japanese README

### Supported Products

- **Finance & Operations**: Finance, SCM, HR, Commerce, Project Operations
- **Customer Engagement**: Sales, Customer Service, Field Service, Marketing
- **Business Central**: Dev and User docs
- **Other**: Fraud Protection, Mixed Reality, Contact Center, IOM, Industry Solutions
- **Legacy**: AX 2012, NAV, GP

### Technical

- SQLite + FTS5 for fast full-text search
- MCP SDK integration
- GitHub API with token support (5,000 requests/hour)
