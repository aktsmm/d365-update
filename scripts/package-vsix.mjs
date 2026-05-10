#!/usr/bin/env node

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");
const artifactsDir = join(rootDir, "artifacts", "vsix");
const keepCount = 10;

function getPackageMeta() {
  const packageJson = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf-8"));

  return {
    name: packageJson.name,
    version: packageJson.version,
  };
}

function ensureArtifactsDir() {
  mkdirSync(artifactsDir, { recursive: true });
}

function migrateRootVsixArchives() {
  const entries = readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".vsix")) {
      continue;
    }

    const sourcePath = join(rootDir, entry.name);
    const targetPath = join(artifactsDir, entry.name);

    if (existsSync(targetPath)) {
      rmSync(targetPath, { force: true });
    }

    renameSync(sourcePath, targetPath);
  }
}

function pruneOldArchives() {
  const archives = readdirSync(artifactsDir)
    .filter((name) => name.endsWith(".vsix"))
    .map((name) => ({
      name,
      fullPath: join(artifactsDir, name),
      mtimeMs: statSync(join(artifactsDir, name)).mtimeMs,
    }))
    .sort((left, right) => right.mtimeMs - left.mtimeMs);

  for (const archive of archives.slice(keepCount)) {
    rmSync(archive.fullPath, { force: true });
  }
}

function packageVsix(outputPath) {
  const result = spawnSync(
    "npx",
    ["@vscode/vsce", "package", "--out", outputPath],
    {
      cwd: rootDir,
      stdio: "inherit",
      shell: process.platform === "win32",
    },
  );

  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }

  if (result.error) {
    throw result.error;
  }
}

function main() {
  ensureArtifactsDir();
  migrateRootVsixArchives();

  const { name, version } = getPackageMeta();
  const outputPath = join(artifactsDir, `${name}-${version}.vsix`);

  packageVsix(outputPath);
  pruneOldArchives();

  console.log(`VSIX archived at: ${outputPath}`);
}

main();