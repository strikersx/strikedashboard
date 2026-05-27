// One-off helper to apply Prisma migrations to a Turso DB via @libsql/client
// (Prisma 7's `migrate deploy` bypasses migrate.adapter and always points at
// the datasource.url file: URL, so we execute the migration SQL directly).
//
// Run with:
//   DATABASE_URL=libsql://... DATABASE_AUTH_TOKEN=eyJ... \
//   node scripts/migrate-turso.mjs [--dry-run] [--verify] [--no-backup]
//
// Flags:
//   --dry-run   Print parsed statements + lint result per migration; do NOT execute.
//   --verify    After apply, re-read _prisma_migrations + sqlite_master to confirm.
//   --no-backup Skip the pre-apply schema dump (default: take the dump).

import { readFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { createClient } from "@libsql/client";

// ─── CLI flags ────────────────────────────────────────────────────────────────

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const VERIFY = args.has("--verify");
const NO_BACKUP = args.has("--no-backup");

// ─── Constants ────────────────────────────────────────────────────────────────

const MIGRATIONS_DIR = "prisma/migrations";
const DIR_NAME_RE = /^\d{14}_[a-z0-9_]+$/;

// Migrations that existed in the repo before PR-D (feat/migrate-turso-safety).
// These are treated as "legacy": idempotency violations produce a WARNING, not
// a gate failure. Any migration whose directory name is NOT in this set must be
// fully idempotent or it will block apply.
const LEGACY_MIGRATIONS = new Set([
  "20260525193738_wa_init",
  "20260526170000_wa_group_member",
  "20260526235313_spotify_token",
  "20260526235828_wa_song_request",
  "20260527000511_wa_class_playlist",
  "20260527001210_wa_blocklists",
  "20260527001823_wa_session_song_fields",
]);

// ─── Gate 1: Directory-name validator ─────────────────────────────────────────

console.log("→ Validating migration directory names…");
const allDirs = readdirSync(MIGRATIONS_DIR).filter(
  (n) =>
    !n.startsWith(".") &&
    n !== "migration_lock.toml" &&
    statSync(join(MIGRATIONS_DIR, n)).isDirectory()
);

const badDirs = allDirs.filter((n) => !DIR_NAME_RE.test(n));
if (badDirs.length > 0) {
  console.error(
    "\n✗ Directory-name validation FAILED. The following migration directories do not match\n" +
      "  the required format \\d{14}_[a-z0-9_]+ :\n\n" +
      badDirs.map((d) => `    prisma/migrations/${d}`).join("\n") +
      "\n\nRename them to match 14-digit timestamp prefix, e.g. 20260528120000_describe_change\n"
  );
  process.exit(1);
}
console.log(`  OK — ${allDirs.length} director${allDirs.length === 1 ? "y" : "ies"} checked.\n`);

// ─── Gate 2: Idempotency linter ───────────────────────────────────────────────

/**
 * Strip SQL line comments and split into individual statements.
 * @param {string} sql
 * @returns {string[]}
 */
function parseStatements(sql) {
  const stripped = sql
    .split(/\r?\n/)
    .map((line) => (line.trim().startsWith("--") ? "" : line))
    .join("\n");
  return stripped
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Lint a single SQL statement for idempotency.
 * Returns null if OK, or a string describing the violation.
 * @param {string} stmt
 * @returns {string|null}
 */
function lintStatement(stmt) {
  const upper = stmt.toUpperCase();

  if (upper.includes("CREATE TABLE") && !upper.includes("IF NOT EXISTS")) {
    return `CREATE TABLE missing IF NOT EXISTS`;
  }
  if (upper.includes("CREATE UNIQUE INDEX") && !upper.includes("IF NOT EXISTS")) {
    return `CREATE UNIQUE INDEX missing IF NOT EXISTS`;
  }
  if (
    upper.includes("CREATE INDEX") &&
    !upper.includes("CREATE UNIQUE INDEX") &&
    !upper.includes("IF NOT EXISTS")
  ) {
    return `CREATE INDEX missing IF NOT EXISTS`;
  }
  if (upper.includes("DROP TABLE") && !upper.includes("IF EXISTS")) {
    return `DROP TABLE missing IF EXISTS`;
  }
  if (upper.includes("DROP INDEX") && !upper.includes("IF EXISTS")) {
    return `DROP INDEX missing IF EXISTS`;
  }

  return null;
}

console.log("→ Linting migrations for idempotency…");
const names = allDirs.sort();
let lintHardFail = false;

for (const name of names) {
  const sqlPath = join(MIGRATIONS_DIR, name, "migration.sql");
  let sql;
  try {
    sql = readFileSync(sqlPath, "utf8");
  } catch {
    console.error(`  ✗ Could not read ${sqlPath}`);
    lintHardFail = true;
    continue;
  }

  const stmts = parseStatements(sql);
  const isLegacy = LEGACY_MIGRATIONS.has(name);
  let migrationOk = true;

  for (const stmt of stmts) {
    const violation = lintStatement(stmt);
    if (violation) {
      const preview = stmt.slice(0, 100).replace(/\s+/g, " ");
      if (isLegacy) {
        console.warn(
          `  WARN  ${name}/migration.sql — ${violation}\n` +
            `        (legacy migration — warning only)\n` +
            `        Statement: ${preview}…\n`
        );
      } else {
        console.error(
          `  ✗ FAIL ${name}/migration.sql — ${violation}\n` +
            `        Statement: ${preview}…\n`
        );
        migrationOk = false;
        lintHardFail = true;
      }
    }
  }

  if (migrationOk && DRY_RUN) {
    console.log(`  OK    ${name}  (${stmts.length} statements parsed)`);
  }
}

if (lintHardFail) {
  console.error(
    "\n✗ Idempotency lint FAILED on new migration(s).\n" +
      "  Add IF NOT EXISTS / IF EXISTS guards before applying.\n"
  );
  process.exit(1);
}

if (!lintHardFail) {
  console.log("  Lint OK — no violations in new migrations.\n");
}

// ─── DRY-RUN early exit ───────────────────────────────────────────────────────

if (DRY_RUN) {
  console.log("--dry-run: no changes made.\n");
  process.exit(0);
}

// ─── Env validation (deferred — not needed for --dry-run) ────────────────────

const url = process.env.DATABASE_URL;
const authToken = process.env.DATABASE_AUTH_TOKEN;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
if (!url.startsWith("libsql://") && !url.startsWith("https://")) {
  console.error(`DATABASE_URL must be libsql:// or https:// (got ${url})`);
  process.exit(1);
}

// ─── Gate 3: Pre-apply schema dump ───────────────────────────────────────────

if (!NO_BACKUP) {
  console.log("→ Taking pre-apply schema dump…");
  try {
    mkdirSync("backups", { recursive: true });
    const dumpOut = execSync("node scripts/turso-dump.mjs", {
      env: process.env,
      encoding: "utf8",
    }).trim();
    console.log(`  Backup written: ${dumpOut}\n`);
  } catch (err) {
    console.error(
      "\n✗ Pre-apply schema dump FAILED. Refusing to apply migrations.\n" +
        "  Use --no-backup to skip (not recommended in production).\n" +
        `  Error: ${err.message}\n`
    );
    process.exit(1);
  }
} else {
  console.log("→ --no-backup: skipping pre-apply dump.\n");
}

// ─── Connect and ensure tracking table ───────────────────────────────────────

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

// ─── Apply migrations ─────────────────────────────────────────────────────────

let applied = 0;
let skipped = 0;
/** @type {string[]} */
const appliedNames = [];

for (const name of names) {
  const sqlPath = join(MIGRATIONS_DIR, name, "migration.sql");
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
  const statements = parseStatements(sql);
  for (const stmt of statements) {
    await client.execute(stmt);
  }

  await client.execute({
    sql: `INSERT INTO _prisma_migrations (id, checksum, migration_name, finished_at, applied_steps_count)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)`,
    args: [name, "0", name, statements.length],
  });
  applied++;
  appliedNames.push(name);
  console.log(`  APPLY ${name}  (${statements.length} statements)`);
}

console.log(`\nDone. applied=${applied} skipped=${skipped}`);

// ─── --verify: post-apply confirmation ────────────────────────────────────────

if (VERIFY) {
  console.log("\n→ Verifying applied migrations…");
  let verifyFailed = false;

  // 1. Check _prisma_migrations rows
  const rows = await client.execute(
    "SELECT migration_name, applied_steps_count, finished_at FROM _prisma_migrations ORDER BY migration_name"
  );
  const appliedMap = new Map(
    rows.rows.map((r) => [
      String(r["migration_name"]),
      { steps: Number(r["applied_steps_count"]), finished: r["finished_at"] },
    ])
  );

  for (const name of names) {
    const entry = appliedMap.get(name);
    if (!entry) {
      console.error(`  ✗ MISSING in _prisma_migrations: ${name}`);
      verifyFailed = true;
    } else if (entry.steps === 0) {
      console.error(`  ✗ applied_steps_count=0 for ${name} — partial apply?`);
      verifyFailed = true;
    } else if (!entry.finished) {
      console.error(`  ✗ finished_at is NULL for ${name}`);
      verifyFailed = true;
    } else {
      console.log(`  OK    ${name}  (steps=${entry.steps})`);
    }
  }

  // 2. Check sqlite_master for tables created by migrations
  const masterRows = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  );
  const existingTables = new Set(masterRows.rows.map((r) => String(r["name"])));

  for (const name of names) {
    const sqlPath = join(MIGRATIONS_DIR, name, "migration.sql");
    const sql = readFileSync(sqlPath, "utf8");
    const stmts = parseStatements(sql);
    for (const stmt of stmts) {
      // Extract table name from CREATE TABLE [IF NOT EXISTS] "TableName"
      const match = stmt.match(
        /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`]?(\w+)["'`]?/i
      );
      if (match) {
        const tableName = match[1];
        if (!existingTables.has(tableName)) {
          console.error(
            `  ✗ Table "${tableName}" (from ${name}) NOT found in sqlite_master`
          );
          verifyFailed = true;
        } else {
          console.log(`  OK    table "${tableName}" exists`);
        }
      }
    }
  }

  if (verifyFailed) {
    console.error("\n✗ Verification FAILED — see errors above.\n");
    process.exit(1);
  } else {
    console.log("\n✓ Verification passed.\n");
  }
}
