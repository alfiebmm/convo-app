#!/usr/bin/env node
/**
 * CON-215: deterministically (re)build drizzle/meta/_journal.json from the
 * on-disk migration files.
 *
 * Background: this repository carried 14 migrations (0000–0013) without ever
 * running `drizzle-kit generate`, so `drizzle/meta/_journal.json` was never
 * produced. Drizzle's migration runner refuses to start without that file.
 * Going forward, `drizzle-kit generate` will own this file. But for the
 * already-on-disk set we need to write one ourselves.
 *
 * This script:
 *   - Reads every `drizzle/####_*.sql` in lexical order.
 *   - For each file, parses the leading numeric prefix as the `idx`.
 *   - Uses the file's git "added" timestamp (in ms) as `when`. Falls back
 *     to a fixed monotonic step from a base epoch if git history is not
 *     available (offline / shallow clone). The exact value is unimportant —
 *     drizzle only uses it as a per-migration watermark — but it must be
 *     strictly increasing across `idx`.
 *   - Sets `breakpoints: true` (the convention drizzle-kit defaults to).
 *   - Sets `version: "7"` (the current snapshot version this drizzle-kit
 *     emits; see node_modules/drizzle-kit/bin.cjs `snapshotVersion`).
 *
 * Idempotency: running this twice produces byte-identical output as long
 * as the migration files and their git history have not changed.
 *
 * Usage:
 *   node scripts/build-journal.mjs            # write drizzle/meta/_journal.json
 *   node scripts/build-journal.mjs --check    # exit non-zero if file is stale
 *   node scripts/build-journal.mjs --print    # print to stdout, no write
 */

import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const DRIZZLE_DIR = resolve(REPO_ROOT, "drizzle");
const META_DIR = resolve(DRIZZLE_DIR, "meta");
const JOURNAL_PATH = resolve(META_DIR, "_journal.json");

const SNAPSHOT_VERSION = "7";
const DIALECT = "postgresql";

// Fallback base epoch (2026-01-01T00:00:00Z) for environments without
// git history. Step by 1 minute per migration to keep `when` strictly
// monotonic.
const FALLBACK_BASE_MS = Date.parse("2026-01-01T00:00:00Z");
const FALLBACK_STEP_MS = 60_000;

function gitAddedMs(file) {
  try {
    const out = execFileSync(
      "git",
      ["log", "--diff-filter=A", "--follow", "--format=%at", "--", file],
      { cwd: REPO_ROOT, stdio: ["ignore", "pipe", "ignore"] }
    )
      .toString()
      .trim()
      .split("\n")
      .filter(Boolean);
    if (out.length === 0) return null;
    // Earliest "add" entry is last (git log is newest-first).
    const epochSec = Number(out[out.length - 1]);
    if (!Number.isFinite(epochSec)) return null;
    return epochSec * 1000;
  } catch {
    return null;
  }
}

function parseIdx(filename) {
  const m = /^(\d{4})_/.exec(filename);
  if (!m) {
    throw new Error(`Migration filename does not start with NNNN_: ${filename}`);
  }
  return Number(m[1]);
}

function tagFromFilename(filename) {
  return filename.replace(/\.sql$/, "");
}

export async function buildJournal() {
  const all = await readdir(DRIZZLE_DIR);
  const sqlFiles = all
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort();

  if (sqlFiles.length === 0) {
    return { version: SNAPSHOT_VERSION, dialect: DIALECT, entries: [] };
  }

  const entries = [];
  let lastWhen = -Infinity;
  for (const file of sqlFiles) {
    const idx = parseIdx(file);
    const tag = tagFromFilename(file);
    let when = gitAddedMs(`drizzle/${file}`);
    if (when === null) {
      when = FALLBACK_BASE_MS + idx * FALLBACK_STEP_MS;
    }
    if (when <= lastWhen) {
      // Force strictly-monotonic ordering. Drizzle uses `when` as the
      // watermark for "is this migration newer than the latest applied?"
      // so ties or rewinds would break delta application.
      when = lastWhen + 1;
    }
    lastWhen = when;
    entries.push({
      idx,
      version: SNAPSHOT_VERSION,
      when,
      tag,
      breakpoints: true,
    });
  }

  return { version: SNAPSHOT_VERSION, dialect: DIALECT, entries };
}

async function readExisting() {
  try {
    const raw = await readFile(JOURNAL_PATH, "utf8");
    return raw;
  } catch {
    return null;
  }
}

function serialise(journal) {
  return JSON.stringify(journal, null, 2) + "\n";
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const journal = await buildJournal();
  const text = serialise(journal);

  if (args.has("--print")) {
    process.stdout.write(text);
    return;
  }

  if (args.has("--check")) {
    const existing = await readExisting();
    if (existing === text) {
      console.log(`OK ${basename(JOURNAL_PATH)} is up to date.`);
      return;
    }
    console.error(
      `STALE ${basename(JOURNAL_PATH)} is missing or out of date.\n` +
        `Run: node scripts/build-journal.mjs`
    );
    process.exit(1);
  }

  await mkdir(META_DIR, { recursive: true });
  await writeFile(JOURNAL_PATH, text);
  console.log(`Wrote ${JOURNAL_PATH} (${journal.entries.length} entries).`);
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
