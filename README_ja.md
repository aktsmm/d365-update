# D365 UPDATE MCP

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/yamapan.d365-update?style=flat-square&label=VS%20Code%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=yamapan.d365-update)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/yamapan.d365-update?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=yamapan.d365-update)
[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg?style=flat-square)](LICENSE)

<p align="center">
  <strong>Copilot Chat から Dynamics 365 のアップデート情報を検索</strong>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=yamapan.d365-update">
    <img src="https://img.shields.io/badge/インストール-VS%20Code%20Marketplace-007ACC?style=for-the-badge&logo=visual-studio-code" alt="VS Code Marketplace からインストール">
  </a>
</p>

<p align="center">
  🇺🇸 <a href="README.md">English version</a>
</p>

---

## ✨ 特徴

- 🔍 **自然言語検索**: Copilot Chat で「D365 Finance 10.0.41 の新機能は？」と聞くだけ
- 🚀 **高速検索**: SQLite + FTS5 によるローカル全文検索
- 🔄 **GitHub 同期**: 16 の MicrosoftDocs リポジトリから直接同期
- 📊 **豊富なフィルタ**: 製品、バージョン、日付でフィルタ
- ⚙️ **設定不要**: インストールするだけで MCP ツールとして自動登録
- 📅 **最新の変更を追跡**: 直近1週間のファイル更新を検出
- 🔗 **参照URL**: GitHub ソースファイルへの直接リンク

## 📦 インストール

1. VS Code 拡張機能マーケットプレイスで "D365 UPDATE" を検索
2. または: `ext install yamapan.d365-update`
3. VS Code を再読み込み
4. Copilot Chat のツール一覧に自動で表示されます！ 🎉

### GitHub Token の設定（推奨）

GitHub API にはレート制限があります。Token を設定すると大幅に緩和されます:

|            | Token なし | Token あり          |
| ---------- | ---------- | ------------------- |
| レート制限 | 60回/時間  | **5,000回/時間** ✨ |

**VS Code での設定方法:**

1. 設定を開く（`Ctrl+,`）
2. `d365Update.githubToken` を検索
3. **「Create a token here」** リンクをクリック → 正しいスコープで Token 作成ページが開く
4. Token をコピーして貼り付け

> 💡 Token には `public_repo` スコープのみ必要です。
>
> ⚠️ **Token の有効期限**: 90日以下に設定してください（Microsoft Open Source ポリシー）。
>
> 📝 **Microsoft 社員の場合**: Open Source Portal から MicrosoftDocs 組織に参加し、Token に SSO 認可が必要です。

## 🎯 使い方

Copilot Chat でこのように聞いてください:

```
「D365 Finance 10.0.41 の新機能は？」     → バージョン指定検索
「D365 Commerce の新機能は？」           → 製品検索
「SCM の倉庫管理の最新アップデート」      → キーワード + 製品検索
「Business Central の最新変更点」        → BC 製品検索
「今週の D365 アップデート」             → 最近の変更
```

### デフォルト動作

- **フィルタなし**: 直近1ヶ月のアップデートを返す（大量の結果を防ぐ）
- **クエリ/バージョンあり**: 全期間を検索
- **概要を含む**: 素早く把握できるキーポイント

## 🛠️ MCP ツール

| ツール                | 説明                                         |
| --------------------- | -------------------------------------------- |
| `search_d365_updates` | キーワード＆フィルタで検索（軽量メタデータ） |
| `get_d365_update`     | ID で詳細を取得                              |
| `sync_d365_updates`   | GitHub からデータを同期                      |

### search_d365_updates パラメータ

| パラメータ | 型     | 説明                                         |
| ---------- | ------ | -------------------------------------------- |
| `query`    | string | 検索キーワード（タイトル＆説明の全文検索）   |
| `product`  | string | 製品でフィルタ（例: `Dynamics 365 Finance`） |
| `version`  | string | バージョンでフィルタ（例: `10.0.41`）        |
| `dateFrom` | string | 日付範囲の開始（`YYYY-MM-DD`）               |
| `dateTo`   | string | 日付範囲の終了（`YYYY-MM-DD`）               |
| `limit`    | number | 最大結果数（1-100、デフォルト: 20）          |

### レスポンス例

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
      "fileUrl": "https://github.com/MicrosoftDocs/..."
    }
  ]
}
```

## 📊 データソース

**16 の MicrosoftDocs リポジトリ**から同期:

### 現行製品 (Dynamics 365)

| リポジトリ                                                                                                              | 製品                                              |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| [dynamics-365-unified-operations-public](https://github.com/MicrosoftDocs/dynamics-365-unified-operations-public)       | Finance, SCM, HR, Commerce                        |
| [dynamics-365-customer-engagement](https://github.com/MicrosoftDocs/dynamics-365-customer-engagement)                   | Sales, Customer Service, Field Service, Marketing |
| [dynamics-365-project-operations](https://github.com/MicrosoftDocs/dynamics-365-project-operations)                     | Project Operations                                |
| [dynamics365smb-devitpro-pb](https://github.com/MicrosoftDocs/dynamics365smb-devitpro-pb)                               | Business Central (Dev)                            |
| [dynamics365smb-docs](https://github.com/MicrosoftDocs/dynamics365smb-docs)                                             | Business Central (User)                           |
| [dynamics-365-fraud-protection](https://github.com/MicrosoftDocs/dynamics-365-fraud-protection)                         | Fraud Protection                                  |
| [dynamics-365-mixed-reality](https://github.com/MicrosoftDocs/dynamics-365-mixed-reality)                               | Guides, Remote Assist                             |
| [dynamics-365-contact-center](https://github.com/MicrosoftDocs/dynamics-365-contact-center)                             | Contact Center                                    |
| [dynamics365-guidance](https://github.com/MicrosoftDocs/dynamics365-guidance)                                           | 実装ガイダンス                                    |
| [dynamics-365-intelligent-order-management](https://github.com/MicrosoftDocs/dynamics-365-intelligent-order-management) | IOM                                               |
| [dynamics365-industry-solutions](https://github.com/MicrosoftDocs/dynamics365-industry-solutions)                       | Healthcare, Retail など                           |
| [dynamics-365-supply-chain-insights](https://github.com/MicrosoftDocs/dynamics-365-supply-chain-insights)               | Supply Chain Insights                             |

### レガシー製品（参考用）

| リポジトリ                                                                        | 製品             | 備考                    |
| --------------------------------------------------------------------------------- | ---------------- | ----------------------- |
| [DynamicsAX2012-technet](https://github.com/MicrosoftDocs/DynamicsAX2012-technet) | Dynamics AX 2012 | TechNet ドキュメント    |
| [DynamicsAX2012-msdn](https://github.com/MicrosoftDocs/DynamicsAX2012-msdn)       | Dynamics AX 2012 | MSDN/開発者ドキュメント |
| [nav-content](https://github.com/MicrosoftDocs/nav-content)                       | Dynamics NAV     | Business Central に移行 |
| [msftdynamicsgpdocs](https://github.com/MicrosoftDocs/msftdynamicsgpdocs)         | Dynamics GP      | Great Plains            |

## 📦 対応製品

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

### その他の製品

- Dynamics 365 Business Central
- Dynamics 365 Fraud Protection
- Dynamics 365 Mixed Reality (Guides, Remote Assist)
- Dynamics 365 Contact Center
- Dynamics 365 Intelligent Order Management
- Dynamics 365 Industry Solutions
- Dynamics 365 Supply Chain Insights

### レガシー製品

- Dynamics AX 2012
- Dynamics NAV
- Dynamics GP

## ⚙️ 設定

| 設定                           | 説明                         | デフォルト |
| ------------------------------ | ---------------------------- | ---------- |
| `d365Update.githubToken`       | GitHub Personal Access Token | ``         |
| `d365Update.autoSync`          | 起動時に自動同期             | `true`     |
| `d365Update.syncIntervalHours` | 自動同期の間隔（時間）       | `24`       |

## 🔧 開発

```bash
# 依存関係のインストール
npm install

# ビルド
npm run build

# MCP Inspector でテスト
npm run inspect

# 配布用パッケージ作成
npm run package
```

## 📝 技術スタック

- **MCP SDK**: `@modelcontextprotocol/sdk`
- **データベース**: SQLite (`better-sqlite3`) + FTS5
- **データソース**: GitHub API (MicrosoftDocs リポジトリ)
- **VS Code API**: 拡張機能連携

## 📄 ライセンス

[CC-BY-NC-4.0](LICENSE)

---

© 2026 yamapan (aktsmm)
