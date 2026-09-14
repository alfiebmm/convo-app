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
 * Idempotency guard:
 *   - CON-215/CON-272: migrations that may be re-run in deploy pipelines must
 *     not contain bare duplicate-object DDL.
 *   - 0000-0023 are an immutable applied baseline; enforce this guard from
 *     0024 onward so new/fixed migrations cannot reintroduce the failure mode.
 *
 * Exit codes:
 *   0 — all migrations clean
 *   1 — at least one migration violation detected
 */

import { readdir, readFile } from "fs/promises";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRIZZLE_DIR = resolve(__dirname, "..", "drizzle");
const IDEMPOTENCY_ENFORCEMENT_START = 24;

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

const DUPLICATE_OBJECT_RE = /\bEXCEPTION\s+WHEN\s+duplicate_object\s+THEN\b/i;
const DO_BLOCK_RE = /\bDO\s+\$\$[\s\S]*?END\s+\$\$/gi;

function stripCommentsPreserveLines(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, (match) =>
      match.replace(/[^\n]/g, " ")
    )
    .replace(/--.*$/gm, "");
}

function lineForIndex(sql, index) {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (sql.charCodeAt(i) === 10) line++;
  }
  return line;
}

function migrationNumber(file) {
  const m = /^(\d+)_/.exec(file);
  return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
}

function statementPreview(sql, index) {
  const end = sql.indexOf(";", index);
  const raw = sql.slice(index, end === -1 ? undefined : end + 1);
  return raw.replace(/\s+/g, " ").trim();
}

function hasIfNotExists(statement) {
  return /\bIF\s+NOT\s+EXISTS\b/i.test(statement);
}

function findDuplicateObjectDoRanges(sql) {
  const ranges = [];
  DO_BLOCK_RE.lastIndex = 0;
  let m;
  while ((m = DO_BLOCK_RE.exec(sql)) !== null) {
    if (DUPLICATE_OBJECT_RE.test(m[0])) {
      ranges.push([m.index, m.index + m[0].length]);
    }
  }
  return ranges;
}

function isInDuplicateObjectDo(ranges, index) {
  return ranges.some(([start, end]) => index >= start && index < end);
}

function findIdempotencyViolations(file, sql) {
  if (migrationNumber(file) < IDEMPOTENCY_ENFORCEMENT_START) return [];

  const stripped = stripCommentsPreserveLines(sql);
  const doRanges = findDuplicateObjectDoRanges(stripped);
  const violations = [];

  const checks = [
    {
      name: "CREATE TYPE",
      re: /\bCREATE\s+TYPE\b/gi,
      ok: (_statement, index) => isInDuplicateObjectDo(doRanges, index),
      reason: "wrap CREATE TYPE in DO/EXCEPTION duplicate_object",
    },
    {
      name: "CREATE TABLE",
      re: /\bCREATE\s+TABLE\b/gi,
      ok: (statement) => hasIfNotExists(statement),
      reason: "use CREATE TABLE IF NOT EXISTS",
    },
    {
      name: "ADD COLUMN",
      re: /\bADD\s+COLUMN\b/gi,
      ok: (statement) => hasIfNotExists(statement),
      reason: "use ADD COLUMN IF NOT EXISTS",
    },
    {
      name: "CREATE INDEX",
      re: /\bCREATE\s+(?:UNIQUE\s+)?INDEX\b/gi,
      ok: (statement) => hasIfNotExists(statement),
      reason: "use CREATE INDEX IF NOT EXISTS",
    },
    {
      name: "CREATE POLICY",
      re: /\bCREATE\s+POLICY\b/gi,
      ok: (_statement, index) => isInDuplicateObjectDo(doRanges, index),
      reason: "wrap CREATE POLICY in DO/EXCEPTION duplicate_object",
    },
    {
      name: "ALTER TYPE ADD VALUE",
      re: /\bALTER\s+TYPE\b[\s\S]{0,240}?\bADD\s+VALUE\b/gi,
      ok: () => false,
      reason: "use the CON-215 enum rebuild pattern instead of ALTER TYPE ADD VALUE",
    },
    {
      name: "ALTER TYPE",
      re: /\bALTER\s+TYPE\b/gi,
      ok: (_statement, index) => isInDuplicateObjectDo(doRanges, index),
      reason: "wrap ALTER TYPE in DO/EXCEPTION duplicate_object",
    },
  ];

  for (const check of checks) {
    check.re.lastIndex = 0;
    let m;
    while ((m = check.re.exec(stripped)) !== null) {
      const statement = statementPreview(stripped, m.index);
      if (check.name === "ALTER TYPE" && /\bADD\s+VALUE\b/i.test(statement)) {
        continue;
      }
      if (check.ok(statement, m.index)) continue;
      violations.push({
        file,
        line: lineForIndex(stripped, m.index),
        kind: check.name,
        statement,
        reason: check.reason,
      });
    }
  }

  return violations;
}

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
  const stripped = stripCommentsPreserveLines(sql);
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

let idempotencyViolations = 0;
for (const file of files) {
  const sql = await readFile(join(DRIZZLE_DIR, file), "utf8");
  const fileViolations = findIdempotencyViolations(file, sql);
  for (const violation of fileViolations) {
    console.error(
      `[lint:migrations:idempotency] ${violation.file}:${violation.line} ` +
        `${violation.kind}: ${violation.reason}. Statement: ${violation.statement}`
    );
    idempotencyViolations++;
  }
}

if (violations > 0) {
  console.error(
    `[lint:migrations] FAILED: ${violations} unguarded public.* table(s).`
  );
}

if (idempotencyViolations > 0) {
  console.error(
    `[lint:migrations:idempotency] FAILED: ${idempotencyViolations} ` +
      `non-idempotent DDL statement(s).`
  );
}

if (violations > 0 || idempotencyViolations > 0) {
  process.exit(1);
}

console.log(
  `[lint:migrations] OK — scanned ${files.length} migration(s), ` +
    `${creates.size} public.* table create(s), all have RLS enabled.`
);
console.log(
  `[lint:migrations:idempotency] OK — enforced from migration ` +
    `${String(IDEMPOTENCY_ENFORCEMENT_START).padStart(4, "0")} onward.`
);
