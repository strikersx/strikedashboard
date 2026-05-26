// One-off helper to apply Prisma migrations to a Turso DB via @libsql/client
// (Prisma 7's `migrate deploy` bypasses migrate.adapter and always points at
// the datasource.url file: URL, so we execute the migration SQL directly).
//
// Run with:
//   DATABASE_URL=libsql://... DATABASE_AUTH_TOKEN=eyJ... \
//   node scripts/migrate-turso.mjs

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@libsql/client";

const url = process.env.DATABASE_URL;
const authToken = process.env.DATABASE_AUTH_TOKEN;
if (!url) throw new Error("DATABASE_URL is required");
if (!url.startsWith("libsql://") && !url.startsWith("https://")) {
  throw new Error(`DATABASE_URL must be libsql:// or https:// (got ${url})`);
}

const client = createClient({ url, authToken });

// Make sure we record which migrations have been applied (mirror Prisma's
// `_prisma_migrations` table format -- minimal fields only).
await client.execute(`CREATE TABLE IF NOT EXISTS _prisma_migrations (
  id TEXT PRIMARY KEY,
  checksum TEXT NOT NULL,
  finished_at DATETIME,
  migration_name TEXT NOT NULL,
  logs TEXT,
  rolled_back_at DATETIME,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  applied_steps_count INTEGER NOT NULL DEFAULT 0
)`);

const migrationsDir = "prisma/migrations";
const names = readdirSync(migrationsDir)
  .filter((n) => statSync(join(migrationsDir, n)).isDirectory() && n !== "migration_lock.toml")
  .sort();

let applied = 0;
let skipped = 0;
for (const name of names) {
  const sqlPath = join(migrationsDir, name, "migration.sql");
  const sql = readFileSync(sqlPath, "utf8");

  // Already applied?
  const existing = await client.execute({
    sql: "SELECT id FROM _prisma_migrations WHERE migration_name = ?",
    args: [name],
  });
  if (existing.rows.length > 0) {
    skipped++;
    console.log(`  SKIP  ${name}  (already applied)`);
    continue;
  }

  // Strip line comments first, then split on ; (libsql doesn't accept
  // multi-statement SQL). Don't filter the full statement on startsWith("--")
  // -- each Prisma migration CREATE chunk starts with a `-- CreateTable`
  // comment line.
  const stripped = sql
    .split(/\r?\n/)
    .map((line) => (line.trim().startsWith("--") ? "" : line))
    .join("\n");
  const statements = stripped
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const stmt of statements) {
    await client.execute(stmt);
  }

  await client.execute({
    sql: `INSERT INTO _prisma_migrations (id, checksum, migration_name, finished_at, applied_steps_count)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)`,
    args: [name, "0", name, statements.length],
  });
  applied++;
  console.log(`  APPLY ${name}  (${statements.length} statements)`);
}

console.log(`\nDone. applied=${applied} skipped=${skipped}`);
