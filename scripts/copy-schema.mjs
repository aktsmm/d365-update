// スキーマファイルをdist/mcpにコピー
import { copyFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcSchema = join(__dirname, "../src/mcp/database/schema.sql");
const distDir = join(__dirname, "../dist/mcp/database");
const distSchema = join(distDir, "schema.sql");

mkdirSync(distDir, { recursive: true });
copyFileSync(srcSchema, distSchema);

console.log("Schema copied to dist/mcp/database/schema.sql");
