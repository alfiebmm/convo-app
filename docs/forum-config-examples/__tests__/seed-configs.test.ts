#!/usr/bin/env node

/**
 * Seed Config Fixture Tests (CON-159, Epic A3)
 *
 * Validates the production-ready example follow_up configs for AgPages and
 * Doggo against the CON-157 schema. Pattern matches
 * src/lib/forum-config/__tests__/follow-up.test.ts — pure tsx-runnable, no
 * test-framework dependency.
 *
 * Asserts:
 *   1. Each fixture parses cleanly through `followUpSchema`.
 *   2. Every rule's `capture_policy_id` resolves to a defined capture policy.
 *   3. Every rule's `contact_method_id` resolves to a defined contact method.
 *   4. Strict dangling-destination rule: every rule's (routing_key, case_type)
 *      pair has at least one matching destination.
 *
 * Run with: npx tsx docs/forum-config-examples/__tests__/seed-configs.test.ts
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { followUpSchema, type FollowUp } from "../../../src/lib/forum-config/schema";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURES_DIR = resolve(__dirname, "..");

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`❌ ${name}`);
    console.log(`   ${msg}`);
    failed++;
    failures.push(`${name}: ${msg}`);
  }
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function loadFixture(filename: string): unknown {
  const path = resolve(FIXTURES_DIR, filename);
  return JSON.parse(readFileSync(path, "utf8"));
}

function assertStrictDanglingDestinations(cfg: FollowUp, label: string) {
  // Build the set of (case_type, routing_key) pairs offered by destinations.
  const destKeys = new Set(
    cfg.destinations.map((d) => `${d.case_type}::${d.routing_key}`),
  );

  // For every rule, its (case_type, routing_key) MUST be in the dest set.
  cfg.rules.forEach((rule) => {
    const key = `${rule.case_type}::${rule.routing_key}`;
    assert(
      destKeys.has(key),
      `${label}: rule "${rule.id}" has routing_key "${rule.routing_key}" ` +
        `(case_type "${rule.case_type}") with no matching destination`,
    );
  });

  // And every destination must be referenced by at least one rule (the
  // schema-level superRefine already checks case_type-only, this is the
  // strict routing-key check from CON-157 / CON-159).
  const ruleKeys = new Set(
    cfg.rules.map((r) => `${r.case_type}::${r.routing_key}`),
  );
  cfg.destinations.forEach((dest) => {
    const key = `${dest.case_type}::${dest.routing_key}`;
    assert(
      ruleKeys.has(key),
      `${label}: destination "${dest.id}" routing_key "${dest.routing_key}" ` +
        `(case_type "${dest.case_type}") is not used by any rule (dangling)`,
    );
  });
}

function assertReferentialIntegrity(cfg: FollowUp, label: string) {
  const policyIds = new Set(cfg.capture_policies.map((p) => p.id));
  const contactIds = new Set(cfg.contact_methods.map((c) => c.id));

  cfg.rules.forEach((rule) => {
    if (rule.capture_policy_id) {
      assert(
        policyIds.has(rule.capture_policy_id),
        `${label}: rule "${rule.id}" references unknown capture_policy_id "${rule.capture_policy_id}"`,
      );
    }
    if (rule.contact_method_id) {
      assert(
        contactIds.has(rule.contact_method_id),
        `${label}: rule "${rule.id}" references unknown contact_method_id "${rule.contact_method_id}"`,
      );
    }
  });
}

// ============================================================
// AgPages fixture
// ============================================================

const agpagesRaw = loadFixture("agpages-follow-up.json");

test("AgPages — fixture parses through followUpSchema", () => {
  const result = followUpSchema.safeParse(agpagesRaw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("\n  ");
    throw new Error(`schema validation failed:\n  ${issues}`);
  }
});

const agpages = followUpSchema.parse(agpagesRaw);

test("AgPages — has expected entity counts", () => {
  assert(
    agpages.contact_methods.length >= 3,
    `expected ≥3 contact methods, got ${agpages.contact_methods.length}`,
  );
  assert(
    agpages.capture_policies.length >= 3,
    `expected ≥3 capture policies, got ${agpages.capture_policies.length}`,
  );
  assert(
    agpages.rules.length >= 6,
    `expected ≥6 rules, got ${agpages.rules.length}`,
  );
  assert(
    agpages.destinations.length >= 2,
    `expected ≥2 destinations, got ${agpages.destinations.length}`,
  );
});

test("AgPages — every rule's capture_policy_id / contact_method_id resolves", () => {
  assertReferentialIntegrity(agpages, "AgPages");
});

test("AgPages — strict dangling-destination compliance (rule↔destination by case_type + routing_key)", () => {
  assertStrictDanglingDestinations(agpages, "AgPages");
});

// ============================================================
// Doggo fixture
// ============================================================

const doggoRaw = loadFixture("doggo-follow-up.json");

test("Doggo — fixture parses through followUpSchema", () => {
  const result = followUpSchema.safeParse(doggoRaw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("\n  ");
    throw new Error(`schema validation failed:\n  ${issues}`);
  }
});

const doggo = followUpSchema.parse(doggoRaw);

test("Doggo — has expected entity counts", () => {
  assert(
    doggo.contact_methods.length >= 2,
    `expected ≥2 contact methods, got ${doggo.contact_methods.length}`,
  );
  assert(
    doggo.capture_policies.length >= 2,
    `expected ≥2 capture policies, got ${doggo.capture_policies.length}`,
  );
  assert(
    doggo.rules.length >= 5,
    `expected ≥5 rules, got ${doggo.rules.length}`,
  );
  assert(
    doggo.destinations.length >= 2,
    `expected ≥2 destinations, got ${doggo.destinations.length}`,
  );
});

test("Doggo — every rule's capture_policy_id / contact_method_id resolves", () => {
  assertReferentialIntegrity(doggo, "Doggo");
});

test("Doggo — strict dangling-destination compliance (rule↔destination by case_type + routing_key)", () => {
  assertStrictDanglingDestinations(doggo, "Doggo");
});

// ============================================================
// Summary
// ============================================================

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("\nFailures:");
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
