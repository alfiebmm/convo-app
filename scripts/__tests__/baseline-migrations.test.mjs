#!/usr/bin/env node
/**
 * CON-215: baseline-migrations.mjs tests.
 *
 * No real DB. We mock `pg.Client.query` and assert:
 *   (a) Tracker is created with the exact schema drizzle's migrator expects.
 *   (b) Inserts use the SHA256 hash of the raw .sql file bytes and the
 *       journal `when` value.
 *   (c) NO migration `.sql` body is ever fed to a query. The single most
 *       important safety property of this script.
 *   (d) `--force` skips already-present hashes; vanilla refuses to seed
 *       a non-empty tracker.
 *   (e) `--up-to=N` slices the entry list inclusively.
 */

import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadEntriesToBaseline,
  applyBaseline,
} from "../baseline-migrations.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const DRIZZLE_DIR = resolve(REPO_ROOT, "drizzle");
const EXPECTED_ENTRY_COUNT = JSON.parse(
  readFileSync(resolve(DRIZZLE_DIR, "meta", "_journal.json"), "utf8")
).entries.length;

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`OK ${name}`);
    passed++;
  } catch (err) {
    console.log(`FAIL ${name}`);
    console.log(`  ${err instanceof Error ? err.stack || err.message : err}`);
    failed++;
  }
}

function assert(cond, label) {
  if (!cond) throw new Error(label);
}
function assertEq(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function makeClient({ trackerExists, existingRows = [] } = {}) {
  const calls = [];
  return {
    calls,
    async query(text, params) {
      const sql = typeof text === "string" ? text : text?.text;
      calls.push({ sql, params });
      if (/to_regclass\('drizzle\.__drizzle_migrations'\)/.test(sql)) {
        return { rows: [{ exists: trackerExists }], rowCount: 1 };
      }
      if (/SELECT hash FROM drizzle\.__drizzle_migrations/.test(sql)) {
        return {
          rows: existingRows.map((h) => ({ hash: h })),
          rowCount: existingRows.length,
        };
      }
      // CREATE/INSERT/BEGIN/COMMIT — all just acknowledged.
      return { rows: [], rowCount: 0 };
    },
  };
}

function migrationBytes() {
  // All on-disk migration SQL bodies — the literal strings we must never
  // feed to client.query for execution.
  const files = readdirSync(DRIZZLE_DIR)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort();
  return files.map((f) => ({
    file: f,
    body: readFileSync(resolve(DRIZZLE_DIR, f), "utf8"),
  }));
}

await test("loadEntriesToBaseline: returns all entries with correct hashes", async () => {
  const entries = loadEntriesToBaseline(null);
  assertEq(entries.length, EXPECTED_ENTRY_COUNT, "entry count");
  // Re-hash one migration manually and compare.
  const file = resolve(DRIZZLE_DIR, "0013_con_error_logging.sql");
  const expected = createHash("sha256").update(readFileSync(file)).digest("hex");
  const e13 = entries.find((e) => e.idx === 13);
  assert(e13, "0013 entry present");
  assertEq(e13.hash, expected, "0013 hash");
  // Monotonic
  let last = -Infinity;
  for (const e of entries) {
    assert(e.when > last, `when not monotonic at ${e.tag}`);
    last = e.when;
  }
});

await test("loadEntriesToBaseline: --up-to=5 slices inclusively", async () => {
  const entries = loadEntriesToBaseline(5);
  assertEq(entries.length, 6, "count for up-to=5");
  assertEq(entries[entries.length - 1].idx, 5, "last idx");
});

await test("applyBaseline: creates schema+table and inserts one row per entry", async () => {
  const entries = loadEntriesToBaseline(null);
  const client = makeClient({ trackerExists: false });
  const result = await applyBaseline({ client, entries, force: false });
  assert(result.ok, "should succeed");
  assertEq(result.inserted, EXPECTED_ENTRY_COUNT, "inserted count");
  assertEq(result.skipped, 0, "skipped count");

  // Inspect call order.
  const sqls = client.calls.map((c) => c.sql.trim().replace(/\s+/g, " "));
  assert(sqls[0].startsWith("SELECT to_regclass"), "probe first");
  assert(sqls[1] === "BEGIN", `expected BEGIN, got ${sqls[1]}`);
  assert(/CREATE SCHEMA IF NOT EXISTS "drizzle"/.test(sqls[2]), "create schema");
  assert(
    /CREATE TABLE IF NOT EXISTS "drizzle"\."__drizzle_migrations"/.test(sqls[3]),
    "create table"
  );
  // Next calls are one INSERT per migration entry.
  for (let i = 0; i < EXPECTED_ENTRY_COUNT; i++) {
    const c = client.calls[4 + i];
    assert(
      /INSERT INTO "drizzle"\."__drizzle_migrations"/.test(c.sql),
      `insert ${i}`
    );
    assert(Array.isArray(c.params), `params array ${i}`);
    assertEq(c.params.length, 2, `params length ${i}`);
    assertEq(c.params[0], entries[i].hash, `hash param ${i}`);
    assertEq(c.params[1], entries[i].when, `when param ${i}`);
  }
  assertEq(client.calls[4 + EXPECTED_ENTRY_COUNT].sql, "COMMIT", "final COMMIT");
});

await test("applyBaseline: NEVER executes any migration SQL body", async () => {
  const entries = loadEntriesToBaseline(null);
  const client = makeClient({ trackerExists: false });
  await applyBaseline({ client, entries, force: false });

  const bodies = migrationBytes();
  for (const call of client.calls) {
    for (const { file, body } of bodies) {
      // Sample three distinct lines per migration that we'd recognise if
      // they leaked into a query. Full-body contains-check is also done.
      assert(
        !call.sql.includes(body),
        `migration body for ${file} leaked into query: ${call.sql.slice(0, 80)}…`
      );
      // A few characteristic substrings, just so a partial leak is caught
      // even if drizzle ever changes how it joins statements.
      const fingerprints = [
        body.slice(0, 60),
        body.slice(Math.floor(body.length / 2), Math.floor(body.length / 2) + 60),
      ].filter((s) => s.length > 20);
      for (const fp of fingerprints) {
        assert(
          !call.sql.includes(fp),
          `migration fingerprint from ${file} leaked into query`
        );
      }
    }
  }
});

await test("applyBaseline: refuses non-empty tracker without --force", async () => {
  const entries = loadEntriesToBaseline(null);
  const client = makeClient({
    trackerExists: true,
    existingRows: [entries[0].hash, entries[1].hash],
  });
  const result = await applyBaseline({ client, entries, force: false });
  assert(!result.ok, "should refuse");
  assertEq(result.rowCount, 2, "row count reported");
  // Must NOT have started a transaction or written anything.
  const wrote = client.calls.some(
    (c) => /BEGIN|INSERT|CREATE/.test(c.sql)
  );
  assert(!wrote, "no writes on refusal");
});

await test("applyBaseline: --force skips already-present hashes by hash equality", async () => {
  const entries = loadEntriesToBaseline(null);
  const present = [entries[0].hash, entries[1].hash, entries[5].hash];
  const client = makeClient({ trackerExists: true, existingRows: present });
  const result = await applyBaseline({ client, entries, force: true });
  assert(result.ok, "should succeed");
  assertEq(result.skipped, 3, "skipped");
  assertEq(result.inserted, entries.length - 3, "inserted");

  // The inserted rows must be exactly the entries NOT in `present`.
  const insertedHashes = client.calls
    .filter((c) => /INSERT INTO "drizzle"/.test(c.sql))
    .map((c) => c.params[0]);
  const expected = entries
    .map((e) => e.hash)
    .filter((h) => !present.includes(h));
  assertEq(
    insertedHashes.join(","),
    expected.join(","),
    "insert set matches"
  );
});

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
