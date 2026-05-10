import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("MCP entrypoint packaging", () => {
  it("keeps the MCP runtime path aligned on .mjs across package, extension, and VS Code configs", () => {
    const packageJsonPath = join(process.cwd(), "package.json");
    const extensionSourcePath = join(process.cwd(), "src", "extension.ts");
    const launchConfigPath = join(process.cwd(), ".vscode", "launch.json");
    const tasksConfigPath = join(process.cwd(), ".vscode", "tasks.json");

    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
      contributes?: {
        mcpServers?: {
          [key: string]: {
            args?: string[];
          };
        };
      };
      scripts?: Record<string, string>;
    };
    const extensionSource = readFileSync(extensionSourcePath, "utf-8");
    const launchConfig = readFileSync(launchConfigPath, "utf-8");
    const tasksConfig = readFileSync(tasksConfigPath, "utf-8");

    expect(
      packageJson.contributes?.mcpServers?.["d365-update"]?.args?.[0],
    ).toBe("${extensionPath}/dist/mcp/index.mjs");
    expect(packageJson.scripts?.["build:mcp"]).toContain(
      "outfile=dist/mcp/index.mjs",
    );
    expect(extensionSource).toContain('"dist", "mcp", "index.mjs"');
    expect(launchConfig).toContain("dist/mcp/index.mjs");
    expect(tasksConfig).toContain("dist/mcp/index.mjs");

    expect(packageJson.scripts?.["build:mcp"]).not.toContain("outfile=dist/mcp/index.js");
    expect(extensionSource).not.toContain('"dist", "mcp", "index.js"');
    expect(launchConfig).not.toContain("dist/mcp/index.js");
    expect(tasksConfig).not.toContain("dist/mcp/index.js");
  });
});
