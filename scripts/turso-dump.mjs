// Pre-apply schema dump helper for migrate-turso.mjs.
//
// Writes a dump of sqlite_master DDL to backups/{ts}-{commit}.sql.
// Exits 0 on success, printing the output path to stdout.
// Exits non-zero on connect or query failure with a clear stderr message.
//
// Run with:
//   DATABASE_URL=libsql://... DATABASE_AUTH_TOKEN=eyJ... \
//   node scripts/turso-dump.mjs

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { createClient } from "@libsql/client";

const url = process.env.DATABASE_URL;
const authToken = process.env.DATABASE_AUTH_TOKEN;

if (!url) {
  console.error("turso-dump: DATABASE_URL is required");
  process.exit(1);
}
if (!url.startsWith("libsql://") && !url.startsWith("https://")) {
  console.error(`turso-dump: DATABASE_URL must be libsql:// or https:// (got ${url})`);
  process.exit(1);
}

// Build filename: {ts}-{commit}.sql
const ts = new Date().toISOString().replace(/[:.]/g, "-");
let commit = "unknown";
try {
  commit = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
} catch {
  // not a git repo or git not available — use "unknown"
}

const filename = `${ts}-${commit}.sql`;
const backupsDir = "backups";
mkdirSync(backupsDir, { recursive: true });
const outPath = join(backupsDir, filename);

let client;
try {
  client = createClient({ url, authToken });
} catch (err) {
  console.error(`turso-dump: Failed to create client — ${err.message}`);
  process.exit(1);
}

let rows;
try {
  const result = await client.execute(
    "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type, name"
  );
  rows = result.rows;
} catch (err) {
  console.error(`turso-dump: Query failed — ${err.message}`);
  process.exit(1);
}

const header = [
  `-- Turso schema dump`,
  `-- Generated: ${new Date().toISOString()}`,
  `-- Commit:    ${commit}`,
  `-- Source:    ${url}`,
  ``,
].join("\n");

const body = rows
  .map((r) => `-- ${String(r["type"])}: ${String(r["name"])}\n${String(r["sql"])};`)
  .join("\n\n");

try {
  writeFileSync(outPath, header + body + "\n");
} catch (err) {
  console.error(`turso-dump: Failed to write file ${outPath} — ${err.message}`);
  process.exit(1);
}

// Print path to stdout so the caller can log it
process.stdout.write(outPath + "\n");
process.exit(0);
