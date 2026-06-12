#!/usr/bin/env node
/**
 * CON-185 (CI guard): scan drizzle/*.sql migrations for any `CREATE TABLE`
 * statement that does not have a matching `ENABLE ROW LEVEL SECURITY` on the
 * same table in the same migration file.
 *
 * This is the lint that would have caught CON-184 before it shipped: four
 * tables added in 0002/0004 without RLS, then patched up later in 0005. With
 * this guard, the same drift fails CI instead.
 *
 * Rules:
 *   - Only flags tables created in the `public` schema (or unqualified, which
 *     defaults to public). Tables in `auth.*`, `storage.*`, `extensions.*`,
 *     etc. are Supabase-managed and out of scope.
 *   - Allows `CREATE TABLE IF NOT EXISTS` (still a create).
 *   - Cumulative across migrations: a CREATE TABLE in 0002 whose RLS gets
 *     enabled in 0005 is clean. The lint flags any public.* table that has
 *     a CREATE TABLE somewhere in drizzle/*.sql with NO matching
 *     `ALTER TABLE <name> ENABLE ROW LEVEL SECURITY` anywhere in the file
 *     set. This is the right semantics: historical drift that was already
 *     fixed (like CON-184) does not block CI, but new drift does.
 *
 * Allow-list: add table names to ALLOW_LIST below with a justification.
 *
 * Exit codes:
 *   0 — all migrations clean
 *   1 — at least one CREATE TABLE without RLS detected
 */

import { readdir, readFile } from "fs/promises";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRIZZLE_DIR = resolve(__dirname, "..", "drizzle");

// Tables that intentionally do not have RLS in their creating migration.
// Add with a code-comment justification when extending.
const ALLOW_LIST = new Set([
  // (empty — none today)
]);

// Match `CREATE TABLE [IF NOT EXISTS] [schema.]"?name"?` (Postgres flavour).
// Captures the (optional) schema and the table name. Drizzle's emitted SQL
// double-quotes identifiers; the regex handles quoted and unquoted forms.
const CREATE_RE =
  /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:"?(?<schema>[a-zA-Z_][\w]*)"?\.)?"?(?<name>[a-zA-Z_][\w]*)"?\s*\(/gi;

// Match `ALTER TABLE [schema.]name ENABLE ROW LEVEL SECURITY`.
const ENABLE_RE =
  /ALTER\s+TABLE\s+(?:"?(?<schema>[a-zA-Z_][\w]*)"?\.)?"?(?<name>[a-zA-Z_][\w]*)"?\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi;

function findCreates(sql) {
  const out = [];
  CREATE_RE.lastIndex = 0;
  let m;
  while ((m = CREATE_RE.exec(sql)) !== null) {
    const schema = m.groups.schema || "public";
    if (schema !== "public") continue; // out of scope (auth.*, storage.*, etc.)
    out.push(m.groups.name);
  }
  return out;
}

function findEnables(sql) {
  const out = new Set();
  ENABLE_RE.lastIndex = 0;
  let m;
  while ((m = ENABLE_RE.exec(sql)) !== null) {
    const schema = m.groups.schema || "public";
    if (schema !== "public") continue;
    out.add(m.groups.name);
  }
  return out;
}

const files = (await readdir(DRIZZLE_DIR))
  .filter((f) => f.endsWith(".sql"))
  .sort();

// Collect all creates (with originating file) and all enables across the
// whole drizzle/*.sql set.
const creates = new Map(); // name -> originating file
const enables = new Set(); // names
for (const file of files) {
  const sql = await readFile(join(DRIZZLE_DIR, file), "utf8");
  // Strip block comments so we don't catch examples in /* ... */ blocks.
  const stripped = sql.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const name of findCreates(stripped)) {
    if (!creates.has(name)) creates.set(name, file);
  }
  for (const name of findEnables(stripped)) {
    enables.add(name);
  }
}

let violations = 0;
for (const [name, originFile] of creates) {
  if (enables.has(name)) continue;
  if (ALLOW_LIST.has(name)) continue;
  console.error(
    `[lint:migrations] public.${name} (created in ${originFile}) has no ` +
      `ALTER TABLE ${name} ENABLE ROW LEVEL SECURITY anywhere in drizzle/. ` +
      `Add the RLS enable in a migration, or add '${name}' to the ALLOW_LIST ` +
      `in scripts/lint-migrations.mjs with a code-comment justification.`
  );
  violations++;
}

if (violations > 0) {
  console.error(
    `[lint:migrations] FAILED: ${violations} unguarded public.* table(s).`
  );
  process.exit(1);
}

console.log(
  `[lint:migrations] OK — scanned ${files.length} migration(s), ` +
    `${creates.size} public.* table create(s), all have RLS enabled.`
);
