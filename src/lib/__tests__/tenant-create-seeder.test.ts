/**
 * CON-252 — `createTenant` starter_prompts seeder tests.
 *
 * `createTenant` (src/lib/tenant.ts) must materialise
 * `DEFAULT_STARTER_PROMPTS` into `settings.forumConfig.starter_prompts`
 * at row-insert time so the value round-trips through the DB (not just
 * the `.prefault` cascade on read).
 *
 * Full DB integration is out of scope for unit tests — Convo's other
 * tenant-related suites use a source-inspection pattern for the same
 * reason (see src/lib/__tests__/tenant-isolation-regression.test.ts).
 * We mirror that pattern here: read src/lib/tenant.ts and assert on the
 * shape of the insert values.
 *
 * Run with:
 *   npx tsx --test src/lib/__tests__/tenant-create-seeder.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { DEFAULT_STARTER_PROMPTS } from "../forum-config/defaults";

const tenantSource = readFileSync(
  join(process.cwd(), "src/lib/tenant.ts"),
  "utf8",
);

test("createTenant imports DEFAULT_STARTER_PROMPTS from forum-config/defaults", () => {
  assert.match(
    tenantSource,
    /import\s+\{\s*DEFAULT_STARTER_PROMPTS\s*\}\s+from\s+["']\.\/forum-config\/defaults["']/,
    "tenant.ts must import DEFAULT_STARTER_PROMPTS",
  );
});

test("createTenant writes settings.forumConfig.starter_prompts on insert", () => {
  // Insert must pass a `settings` object with a `forumConfig` object that
  // sets `starter_prompts`. Regex is intentionally loose across whitespace
  // and property ordering.
  assert.match(
    tenantSource,
    /settings\s*:\s*initialSettings/,
    "insert values must reference the seeded settings object",
  );
  assert.match(
    tenantSource,
    /forumConfig\s*:\s*\{[\s\S]*?starter_prompts\s*:\s*DEFAULT_STARTER_PROMPTS/,
    "seeded settings must set forumConfig.starter_prompts to DEFAULT_STARTER_PROMPTS",
  );
});

test("DEFAULT_STARTER_PROMPTS is stable and non-empty (sanity)", () => {
  assert.ok(
    DEFAULT_STARTER_PROMPTS.length > 0,
    "DEFAULT_STARTER_PROMPTS must not be empty — createTenant would seed nothing",
  );
  assert.ok(
    DEFAULT_STARTER_PROMPTS.length <= 4,
    "DEFAULT_STARTER_PROMPTS must respect the max-4 cap",
  );
});
