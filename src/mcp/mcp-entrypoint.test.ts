import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("MCP entrypoint packaging", () => {
  it("registers the MCP server with an .mjs entrypoint", () => {
    const packageJsonPath = join(process.cwd(), "package.json");
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

    expect(
      packageJson.contributes?.mcpServers?.["d365-update"]?.args?.[0],
    ).toBe("${extensionPath}/dist/mcp/index.mjs");
    expect(packageJson.scripts?.["build:mcp"]).toContain(
      "outfile=dist/mcp/index.mjs",
    );
  });
});
