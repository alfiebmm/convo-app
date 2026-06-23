#!/usr/bin/env node
/**
 * CON-215: CI guard against migration / journal drift.
 *
 * Fails if `drizzle/*.sql` and `drizzle/meta/_journal.json` disagree.
 *
 * Specifically:
 *   1. Every `drizzle/####_*.sql` file has a corresponding entry in
 *      `drizzle/meta/_journal.json` (matched by `tag`).
 *   2. Every journal entry has a corresponding SQL file on disk.
 *   3. Journal entries are in monotonically increasing `when` order, and
 *      `idx` is strictly increasing.
 *   4. (--strict only) The currently-on-disk journal is byte-equal to what
 *      `scripts/build-journal.mjs` would deterministically produce. Useful
 *      for verifying the seeded journal locally; not enforced in CI because
 *      `drizzle-kit generate` legitimately writes a wall-clock `when` value
 *      that won't match the git-added timestamp our builder uses.
 *
 * Exit codes:
 *   0 — clean
 *   1 — drift detected (with a clear remediation message)
 */

import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildJournal } from "./build-journal.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const DRIZZLE_DIR = resolve(REPO_ROOT, "drizzle");
const JOURNAL_PATH = resolve(DRIZZLE_DIR, "meta", "_journal.json");

function fail(msg) {
  console.error(`migration drift: ${msg}`);
  console.error(
    `\nRemediation: re-run \`node scripts/build-journal.mjs\` and commit the result, ` +
      `or use \`npx drizzle-kit generate\` if adding a new migration.`
  );
  process.exit(1);
}

async function main() {
  if (!existsSync(JOURNAL_PATH)) {
    fail(`${JOURNAL_PATH} is missing.`);
  }

  const allFiles = await readdir(DRIZZLE_DIR);
  const sqlFiles = allFiles
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort();
  const tagsOnDisk = new Set(sqlFiles.map((f) => f.replace(/\.sql$/, "")));

  const journalRaw = await readFile(JOURNAL_PATH, "utf8");
  let journal;
  try {
    journal = JSON.parse(journalRaw);
  } catch (err) {
    fail(`${JOURNAL_PATH} is not valid JSON: ${err.message}`);
  }
  if (!Array.isArray(journal.entries)) {
    fail(`${JOURNAL_PATH} missing entries[]`);
  }

  // (1) SQL file → journal entry
  const tagsInJournal = new Set(journal.entries.map((e) => e.tag));
  for (const tag of tagsOnDisk) {
    if (!tagsInJournal.has(tag)) {
      fail(`Migration file drizzle/${tag}.sql has no journal entry.`);
    }
  }
  // (2) Journal entry → SQL file
  for (const tag of tagsInJournal) {
    if (!tagsOnDisk.has(tag)) {
      fail(`Journal entry "${tag}" has no matching drizzle/${tag}.sql file.`);
    }
  }

  // (3) Monotonic ordering
  let lastWhen = -Infinity;
  let lastIdx = -1;
  for (const e of journal.entries) {
    if (e.idx <= lastIdx) {
      fail(`Journal entry idx ${e.idx} (${e.tag}) is not strictly > previous ${lastIdx}.`);
    }
    if (e.when <= lastWhen) {
      fail(
        `Journal entry "${e.tag}" has when=${e.when}, ` +
          `not strictly > previous ${lastWhen}.`
      );
    }
    lastIdx = e.idx;
    lastWhen = e.when;
  }

  // (4) Strict-mode deterministic-rebuild check.
  if (process.argv.includes("--strict")) {
    const rebuilt = await buildJournal();
    const expected = JSON.stringify(rebuilt, null, 2) + "\n";
    if (journalRaw !== expected) {
      console.error("Journal does not match deterministic rebuild output.");
      console.error("--- diff hint (first divergence) ---");
      let i = 0;
      while (
        i < expected.length &&
        i < journalRaw.length &&
        expected[i] === journalRaw[i]
      )
        i++;
      const ctx = (s) =>
        JSON.stringify(s.slice(Math.max(0, i - 30), i + 60));
      console.error(`offset ${i}`);
      console.error(`on disk: …${ctx(journalRaw)}`);
      console.error(`rebuilt: …${ctx(expected)}`);
      fail("Journal file is out of date.");
    }
  }

  console.log(
    `OK ${journal.entries.length} migrations, journal entries match disk, ordering is monotonic.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
