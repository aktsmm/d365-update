# Changelog

All notable changes to this project will be documented in this file.

## [0.2.4] - 2026-01-26

### Changed

- 🎯 `search_d365_updates` の出力を改善
  - 追加の `get_d365_update` 呼び出し不要で検索結果が完結するように変更
  - 「新リリース」「ドキュメント更新」の重複分類を廃止し、全件一覧に統合
  - 出力指示を強化: 全件表示・翻訳必須・省略禁止を明記
  - ツール description にマークダウン出力テンプレートを追加

## [0.2.3] - 2026-01-26

### Changed

- 📋 MCP ツール説明に GitHub Copilot への出力形式指示を追加
  - サマリテーブル（件数、期間、製品別カウント）
  - 全件一覧テーブル（リリース日、製品、タイトル翻訳、概要翻訳、日本語/英語Docs URL、GitHubコミットURL）
  - タイトル・概要のユーザー言語への翻訳を必須化
  - すべてのURLをリンクとして出力することを明記

## [0.2.2] - 2026-01-26

### Fixed

- 🔑 GitHub Token が mcp.json 経由で MCP Server に渡されない問題を修正
  - 拡張機能が VS Code 設定から Token を読み取り mcp.json の env に書き込むように変更
  - Token 設定変更時に自動で mcp.json を更新するリスナーを追加
- 📅 日付フィルタが正しく動作しない問題を修正
  - `release_date` (MM/DD/YYYY 形式) を YYYY-MM-DD に変換して比較するように修正
  - ソート順も同様に修正

### Added

- 🔍 起動時に GitHub Token の有無をログ出力（デバッグ用）

## [0.2.1] - 2026-01-26

### Added

- 🌐 MS Learn URL を日本語・英語両方で出力 (`docsUrl_ja`, `docsUrl_en`)
- 📊 サマリセクション追加: 件数、期間、製品別カウントを表示
- 🆕 新機能リリース vs ドキュメント更新を自動分類

### Fixed

- 🔗 `githubCommitsUrl` がサマリ出力に含まれていなかった問題を修正

### Changed

- 🌏 ロケールに関係なく日本語・英語両方の Docs URL を常に出力
- 📤 出力ラベルがロケールに応じて日本語/英語に切り替わるように変更

## [0.2.0] - 2026-01-26

### Added

- 🌐 `locale` パラメータ追加: ユーザーの言語に応じた Microsoft Learn URL を生成
- 📝 `docsUrl`: Microsoft Learn ページへの直接リンク（ロケール対応）
- 🔗 `githubCommitsUrl`: GitHub コミット履歴へのリンク
- 🗣️ 自動翻訳指示: Copilot がユーザーの言語に合わせてタイトル・概要を翻訳

### Changed

- 📈 `limit` デフォルト値を変更: 20件 → 制限なし（全件取得）
- 📆 日付未指定時は過去1ヶ月のデータを返却

### Improved

- 🎯 ツール description を強化: 言語検出・翻訳指示を追加

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
