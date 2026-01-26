/**
 * VS Code 拡張機能エントリーポイント
 */

import * as vscode from "vscode";

// バージョン情報
const VERSION = "0.1.0";
const EXTENSION_NAME = "D365 UPDATE MCP";

export function activate(context: vscode.ExtensionContext): void {
  console.log(`${EXTENSION_NAME} v${VERSION} activated`);

  // 起動時に Token 設定をチェック
  checkGitHubTokenConfig();

  // 手動同期コマンド
  const syncCommand = vscode.commands.registerCommand(
    "d365-update.syncUpdates",
    async () => {
      const config = vscode.workspace.getConfiguration("d365Update");
      const hasToken = !!config.get<string>("githubToken");

      if (!hasToken) {
        const result = await vscode.window.showWarningMessage(
          "GitHub Token が設定されていません。Rate Limit (60回/時間) に制限されます。",
          "設定を開く",
          "続行",
        );
        if (result === "設定を開く") {
          vscode.commands.executeCommand(
            "workbench.action.openSettings",
            "d365Update.githubToken",
          );
          return;
        }
      }

      vscode.window.showInformationMessage(
        "D365 UPDATE: Syncing updates... Use 'sync_d365_updates' in Copilot Chat.",
      );
    },
  );

  // 設定画面を開くコマンド
  const openSettingsCommand = vscode.commands.registerCommand(
    "d365-update.openSettings",
    () => {
      vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "d365Update",
      );
    },
  );

  // バージョン情報を表示するコマンド
  const showVersionCommand = vscode.commands.registerCommand(
    "d365-update.showVersion",
    () => {
      const config = vscode.workspace.getConfiguration("d365Update");
      const hasToken = !!config.get<string>("githubToken");
      const autoSync = config.get<boolean>("autoSync");
      const syncInterval = config.get<number>("syncIntervalHours");

      vscode.window
        .showInformationMessage(
          `${EXTENSION_NAME} v${VERSION}\n` +
            `GitHub Token: ${hasToken ? "✓ 設定済み" : "✗ 未設定"}\n` +
            `Auto Sync: ${autoSync ? "有効" : "無効"} (${syncInterval}時間ごと)`,
          "設定を開く",
        )
        .then((selection) => {
          if (selection === "設定を開く") {
            vscode.commands.executeCommand(
              "workbench.action.openSettings",
              "d365Update",
            );
          }
        });
    },
  );

  context.subscriptions.push(
    syncCommand,
    openSettingsCommand,
    showVersionCommand,
  );
}

/**
 * GitHub Token の設定状態をチェック
 */
function checkGitHubTokenConfig(): void {
  const config = vscode.workspace.getConfiguration("d365Update");
  const token = config.get<string>("githubToken");

  if (!token) {
    // 初回起動時のみ通知（設定で記憶）
    const hideNotification = config.get<boolean>("hideTokenNotification");
    if (!hideNotification) {
      vscode.window
        .showInformationMessage(
          "D365 UPDATE: GitHub Token を設定すると API Rate Limit が向上します (60 → 5,000回/時間)",
          "設定する",
          "今後表示しない",
        )
        .then((selection) => {
          if (selection === "設定する") {
            vscode.commands.executeCommand(
              "workbench.action.openSettings",
              "d365Update.githubToken",
            );
          } else if (selection === "今後表示しない") {
            config.update("hideTokenNotification", true, true);
          }
        });
    }
  }
}

export function deactivate(): void {
  console.log(`${EXTENSION_NAME} deactivated`);
}
