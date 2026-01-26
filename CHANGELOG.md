# Changelog

All notable changes to this project will be documented in this file.

## [0.3.3] - 2026-01-27

### Changed

- 📝 **README 更新**: 技術的な工夫（同梱DB、差分同期、並列処理）を追記

## [0.3.2] - 2026-01-27

### Added

- 🚀 **リポジトリレベル差分チェック**: 変更がないリポジトリはスキップ
  - 全リポジトリの最新コミットSHAを軽量チェック（16 API）
  - 変更があったリポジトリのみツリー取得
  - `repository_shas` テーブルでSHAを永続化
- ⚡ **バックグラウンド自動同期**: MCPサーバー起動時に裏で同期実行

### Changed

- 🏎️ **同期速度大幅改善**:
  - フル同期: 207秒 → 変わらず
  - インクリメンタル同期（変更なし）: **3秒**（98%削減）

## [0.3.1] - 2026-01-27

### Added

- ⚡ **並列処理による高速化**: 同期処理を大幅に高速化
  - リポジトリツリー取得: 4並列処理
  - ファイル処理: 5並列処理
  - コミット取得: 4並列処理
- 🔄 セマフォによる同時実行数制御で安定した並列処理を実現

### Changed

- 🏗️ GitHub API 呼び出しを並列化してレスポンス時間を短縮

## [0.3.0] - 2026-01-27

### Added

- 📦 **同梱データベース機能**: パッケージ時点の最新データをDBに同梱
  - 新規インストールユーザーは初回から検索可能（同期不要）
  - ユーザーDBが存在しない場合、同梱DBから自動初期化
- 🔧 **環境変数オーバーライド**: `D365_UPDATE_DB_PATH` でDBパスを指定可能（テスト用）
- 📜 `build:bundled-db` スクリプト追加: 同梱DB準備用

### Changed

- 🏗️ `npm run package` で同梱DB作成を自動実行

## [0.2.8] - 2026-01-26

### Fixed

- 🔗 **MS Learn URL 生成の改善**: より多くのリポジトリに対応
  - `dynamics-365-mixed-reality` (Remote Assist, Guides) → MS Learn URL 生成対応
  - `dynamics-365-fraud-protection` → MS Learn URL 生成対応
  - `dynamics-365-contact-center` → MS Learn URL 生成対応
  - `dynamics-365-customer-engagement` → MS Learn URL 生成対応
  - `dynamics365-guidance` → MS Learn URL 生成対応
  - `dynamics365smb-devitpro-pb` (Business Central DevItPro) → MS Learn URL 生成対応
- 📁 各リポジトリのベースパス（`articles/`, `mr-docs/`, `content/` 等）に対応

## [0.2.7] - 2026-01-26

### Added

- 🆕 **updateType フィールド追加**: 検索結果に「新規ページ」か「既存ページ更新」かを判定する `updateType` を追加
  - `"new"` = 🆕 新規ページ（新しいリリースノート）
  - `"updated"` = 📝 既存ページの更新
- 📅 **初回コミット日（first_commit_date）** をデータベースに保存
  - firstCommitDate と commitDate の差分から新規/更新を自動判定
- 📝 **概要（summary）のフォールバック表示**: description がない場合でもタイトルから概要を生成

### Changed

- 🔧 データベースマイグレーション機能を追加（既存DBに first_commit_date カラムを自動追加）
- 📋 ツールの出力指示を強化: updateType の表示方法を明記

## [0.2.6] - 2026-01-26

### Changed

- 📝 出力フォーマットを改善
  - リンク表示を表形式からインライン形式に変更（よりコンパクトに）
  - 概要の文字数を300文字→600文字に拡大
  - 箇条書きの抽出件数を3つ→5つに拡大

## [0.2.5] - 2026-01-26

### Fixed

- 📝 出力指示のコメントを修正: 「日本語に翻訳」→「ユーザーの言語に翻訳」
  - ロケールに応じて適切な言語で翻訳されるよう表現を修正

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
