#!/usr/bin/env node
/**
 * CON-215: Drizzle migration runner.
 *
 * Invoked once per deploy. Reads `drizzle/meta/_journal.json`, walks the
 * `drizzle/####_*.sql` files in order, and applies any whose `when`
 * watermark is newer than the latest row in `drizzle.__drizzle_migrations`.
 *
 * Driver: this app uses `drizzle-orm/node-postgres` (see
 * `src/lib/db/index.ts`). The matching migrator is
 * `drizzle-orm/node-postgres/migrator`.
 *
 * Env:
 *   DATABASE_URL     (required) — Postgres connection string.
 *   MIGRATE_DRY_RUN  (optional) — if "1"/"true", list the SQL files the
 *                                 runner would apply but execute nothing.
 *                                 Safe to run against prod for inspection.
 *
 * Exit codes:
 *   0 — success (including "nothing to do")
 *   1 — migration failure
 *   2 — config/env error (no DATABASE_URL, no journal, etc.)
 *
 * History:
 *   - Existing 0000–0013 were applied by hand or ad-hoc pushes before this
 *     runner existed. To avoid re-running them, see
 *     `scripts/baseline-migrations.mjs`, which seeds
 *     `drizzle.__drizzle_migrations` so this runner treats them as already
 *     applied. Run the baseline ONCE per environment before this runner
 *     touches that environment for the first time.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const DRIZZLE_DIR = resolve(REPO_ROOT, "drizzle");
const JOURNAL_PATH = resolve(DRIZZLE_DIR, "meta", "_journal.json");

function isTruthy(v) {
  if (!v) return false;
  const s = String(v).toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

function loadJournal() {
  if (!existsSync(JOURNAL_PATH)) {
    throw new Error(
      `Missing ${JOURNAL_PATH}. Run \`node scripts/build-journal.mjs\` first.`
    );
  }
  const raw = readFileSync(JOURNAL_PATH, "utf8");
  const journal = JSON.parse(raw);
  if (!Array.isArray(journal.entries)) {
    throw new Error(`Malformed _journal.json: missing entries[]`);
  }
  return journal;
}

function loadMigrations(journal) {
  return journal.entries.map((entry) => {
    const file = resolve(DRIZZLE_DIR, `${entry.tag}.sql`);
    if (!existsSync(file)) {
      throw new Error(`Missing migration file referenced by journal: ${file}`);
    }
    const sql = readFileSync(file, "utf8");
    return {
      tag: entry.tag,
      when: entry.when,
      hash: createHash("sha256").update(sql).digest("hex"),
      file,
    };
  });
}

async function runDryRun() {
  const journal = loadJournal();
  const migrations = loadMigrations(journal);

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log(
      "DRY RUN (no DATABASE_URL set): assuming an empty drizzle.__drizzle_migrations."
    );
    for (const m of migrations) {
      console.log(`would apply: ${m.tag}  (when=${m.when})`);
    }
    return;
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const exists = await client.query(
      `SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS present`
    );
    let last = null;
    if (exists.rows[0].present) {
      const { rows } = await client.query(
        `SELECT created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1`
      );
      last = rows[0] ? Number(rows[0].created_at) : null;
    }
    console.log(
      `DRY RUN: latest applied watermark = ${last ?? "(none — tracker missing or empty)"}`
    );
    let pending = 0;
    for (const m of migrations) {
      if (last === null || m.when > last) {
        console.log(`would apply: ${m.tag}  (when=${m.when})`);
        pending++;
      } else {
        console.log(`skip:        ${m.tag}  (when=${m.when}) [already applied]`);
      }
    }
    console.log(`DRY RUN: ${pending} migration(s) would be applied.`);
  } finally {
    await client.end();
  }
}

async function runMigrate() {
  // Vercel build guard. Without this, every preview deploy would point its
  // build at whatever DATABASE_URL the preview env carries (often prod or a
  // shared dev DB) and run migrations on it. We only auto-run on
  // production builds; previews are a no-op unless MIGRATE_ALLOW_PREVIEW=1.
  const vercelEnv = process.env.VERCEL_ENV;
  if (
    vercelEnv && vercelEnv !== "production" &&
    !isTruthy(process.env.MIGRATE_ALLOW_PREVIEW)
  ) {
    console.log(
      `Skipping migrations: VERCEL_ENV=${vercelEnv} (set MIGRATE_ALLOW_PREVIEW=1 to override).`
    );
    return;
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required.");
    process.exit(2);
  }

  // Load the journal up front so we fail fast on a config error.
  loadJournal();

  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");

  const pool = new pg.Pool({
    connectionString: url,
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 10_000,
  });
  const db = drizzle(pool);

  console.log(`Running migrations from ${DRIZZLE_DIR} …`);
  const t0 = Date.now();
  try {
    await migrate(db, { migrationsFolder: DRIZZLE_DIR });
    console.log(`Migrations OK in ${Date.now() - t0}ms.`);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

async function main() {
  try {
    if (isTruthy(process.env.MIGRATE_DRY_RUN)) {
      await runDryRun();
      return;
    }
    await runMigrate();
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(2);
  }
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main();
}
