#!/usr/bin/env node
/**
 * CON-215: baseline `drizzle.__drizzle_migrations`.
 *
 * The Drizzle migration tracker (`drizzle.__drizzle_migrations`) does NOT
 * exist on prod, because the migration runner was never wired up. Every
 * existing migration file (0000–0013, as of this script's authoring) has
 * already been applied against prod by hand or via ad-hoc pushes.
 *
 * Running `migrate.mjs` against a database with no tracker would attempt to
 * re-apply all 14 migrations. Some are guarded with `IF NOT EXISTS`; some
 * (notably the RLS migrations) are NOT re-run-safe. So we must seed the
 * tracker WITHOUT executing any migration SQL.
 *
 * What this script does:
 *   1. Connects to DATABASE_URL.
 *   2. Verifies (read-only) that the tracker is empty or missing.
 *      If any rows exist, refuses to do anything unless --force is passed.
 *   3. Inside ONE transaction:
 *        - CREATE SCHEMA IF NOT EXISTS drizzle
 *        - CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (...)
 *        - INSERT one row per journal entry with:
 *            hash       = sha256(<raw .sql file contents>)        (hex)
 *            created_at = <journal entry "when">                  (bigint, ms)
 *      The hash matches what `drizzle-orm`'s migrator computes (see
 *      `node_modules/drizzle-orm/migrator.js`). The watermark column is
 *      `created_at` (bigint, ms) — what the migrator reads to decide
 *      "is this newer than the latest applied?".
 *   4. NO migration SQL is executed. The script never reads any
 *      `drizzle/####_*.sql` file as SQL, only as bytes for hashing.
 *
 * Flags:
 *   --dry-run       Print what would be inserted; touch nothing.
 *   --force         Allow seeding even if rows already exist. Existing rows
 *                   are NOT touched; only missing tags (matched by hash)
 *                   are added. Useful if the tracker was partially seeded
 *                   in a previous environment.
 *   --up-to=<idx>   Only baseline through migration idx <idx> (inclusive).
 *                   Use this if some later migrations have NOT been applied
 *                   against the target environment and should run on the
 *                   next `migrate.mjs` invocation.
 *
 * Usage examples:
 *   # Inspect, no writes:
 *   MIGRATE_DRY_RUN=1 DATABASE_URL=... node scripts/baseline-migrations.mjs --dry-run
 *
 *   # Real baseline (one-shot per environment):
 *   DATABASE_URL=... node scripts/baseline-migrations.mjs
 *
 *   # Baseline only 0000–0011, leave 0012/0013 for the runner to apply:
 *   DATABASE_URL=... node scripts/baseline-migrations.mjs --up-to=11
 *
 * Exit codes:
 *   0 — success (including no-op)
 *   1 — refused (rows exist and no --force, or other safety abort)
 *   2 — config/env error
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

function parseArgs(argv) {
  const args = {
    dryRun: false,
    force: false,
    upTo: null,
  };
  for (const raw of argv) {
    if (raw === "--dry-run") args.dryRun = true;
    else if (raw === "--force") args.force = true;
    else if (raw.startsWith("--up-to=")) {
      const n = Number(raw.slice("--up-to=".length));
      if (!Number.isInteger(n) || n < 0) {
        throw new Error(`--up-to expects a non-negative integer, got ${raw}`);
      }
      args.upTo = n;
    } else if (raw === "--help" || raw === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${raw}`);
    }
  }
  return args;
}

export function loadEntriesToBaseline(upTo) {
  if (!existsSync(JOURNAL_PATH)) {
    throw new Error(
      `Missing ${JOURNAL_PATH}. Run \`node scripts/build-journal.mjs\` first.`
    );
  }
  const journal = JSON.parse(readFileSync(JOURNAL_PATH, "utf8"));
  if (!Array.isArray(journal.entries)) {
    throw new Error(`Malformed _journal.json: missing entries[]`);
  }

  const filtered = journal.entries.filter(
    (e) => upTo === null || e.idx <= upTo
  );

  return filtered.map((entry) => {
    const file = resolve(DRIZZLE_DIR, `${entry.tag}.sql`);
    if (!existsSync(file)) {
      throw new Error(`Missing migration file referenced by journal: ${file}`);
    }
    const bytes = readFileSync(file); // raw Buffer — match the migrator
    return {
      idx: entry.idx,
      tag: entry.tag,
      when: entry.when,
      hash: createHash("sha256").update(bytes).digest("hex"),
    };
  });
}

export async function applyBaseline({ client, entries, force }) {
  // Read current state outside the transaction (no schema changes yet).
  const present = await client.query(
    `SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS exists`
  );
  let existingHashes = new Set();
  let rowCount = 0;
  if (present.rows[0].exists) {
    const r = await client.query(
      `SELECT hash FROM drizzle.__drizzle_migrations`
    );
    rowCount = r.rowCount;
    existingHashes = new Set(r.rows.map((row) => row.hash));
  }

  if (rowCount > 0 && !force) {
    return {
      ok: false,
      reason: `tracker_has_${rowCount}_rows`,
      rowCount,
    };
  }

  await client.query("BEGIN");
  await client.query(`CREATE SCHEMA IF NOT EXISTS "drizzle"`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);

  let inserted = 0;
  let skipped = 0;
  for (const e of entries) {
    if (existingHashes.has(e.hash)) {
      skipped++;
      continue;
    }
    await client.query(
      `INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at") VALUES ($1, $2)`,
      [e.hash, e.when]
    );
    inserted++;
  }
  await client.query("COMMIT");
  return { ok: true, inserted, skipped };
}

const HELP = `\
baseline-migrations.mjs — seed drizzle.__drizzle_migrations without running SQL.

Flags:
  --dry-run            Print plan, touch nothing.
  --force              Seed even if existing rows are present (only inserts missing hashes).
  --up-to=<idx>        Baseline only through migration idx <idx> (inclusive).
  -h, --help           Show this help.
`;

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    console.error(HELP);
    process.exit(2);
  }
  if (args.help) {
    console.log(HELP);
    return;
  }

  const url = process.env.DATABASE_URL;
  if (!url && !args.dryRun) {
    console.error("DATABASE_URL is required (unless --dry-run).");
    process.exit(2);
  }

  const entries = loadEntriesToBaseline(args.upTo);
  if (entries.length === 0) {
    console.log("No journal entries to baseline. Done.");
    return;
  }

  console.log(`Plan: baseline ${entries.length} migration(s):`);
  for (const e of entries) {
    console.log(
      `  - ${e.tag}  when=${e.when}  hash=${e.hash.slice(0, 12)}…`
    );
  }

  if (args.dryRun) {
    console.log("--dry-run: not connecting to the database. Done.");
    return;
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  try {
    const result = await applyBaseline({
      client,
      entries,
      force: args.force,
    });
    if (!result.ok) {
      console.error(
        `Refusing to baseline: drizzle.__drizzle_migrations already has ${result.rowCount} row(s).`
      );
      console.error(
        `Pass --force to insert missing entries only (no existing rows are touched).`
      );
      process.exit(1);
    }
    console.log(
      `Baseline complete. Inserted=${result.inserted}, already present (skipped)=${result.skipped}.`
    );
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    console.error("Baseline failed:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main();
}
