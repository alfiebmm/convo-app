#!/usr/bin/env node
/**
 * Tests for the forum-config dashboard panels (CON-191).
 *
 * Repo convention: pure tsx-runnable, no DOM test framework. Panels are
 * thin orchestrators over `@/lib/forum-config/schema` — so we test the
 * contract those panels rely on:
 *
 *   - panel pre-save validation mirrors the server-side Zod parse
 *   - panel default-normalisation produces a schema-valid object
 *
 * Run with:
 *   npx tsx src/app/dashboard/settings/forum-config/__tests__/panels.test.ts
 */
import {
  aiPersonaSchema,
  welcomeSchema,
  qualifyingQuestionsSchema,
  allowedTopicsSchema,
  followUpSchema,
} from "../../../../../lib/forum-config/schema";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`OK ${name}`);
    passed++;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`FAIL ${name}`);
    console.log(`  ${message}`);
    failed++;
  }
}

function assert(cond: unknown, label: string) {
  if (!cond) throw new Error(label);
}

// ─── Persona ──────────────────────────────────────────────

test("persona default shape is schema-valid", () => {
  const defaults = {
    tone: "friendly",
    locale: "en-AU",
    banned_words: [],
    voice_description: "",
  };
  const r = aiPersonaSchema.safeParse(defaults);
  assert(r.success, "defaults parse");
});

test("persona rejects unknown tone (mirrors server)", () => {
  const r = aiPersonaSchema.safeParse({
    tone: "robotic",
    locale: "en-AU",
    banned_words: [],
    voice_description: "x",
  });
  assert(!r.success, "should reject");
});

// ─── Welcome ──────────────────────────────────────────────

test("welcome default shape is schema-valid", () => {
  const r = welcomeSchema.safeParse({
    copy: "Hi there, how can I help you today?",
    enabled: true,
    show_with_questions: false,
  });
  assert(r.success, "welcome defaults parse");
});

test("welcome empty {} normalises with defaults", () => {
  const r = welcomeSchema.safeParse({});
  assert(r.success, "empty parses");
  if (r.success) {
    assert(r.data.enabled === true, "enabled default");
    assert(r.data.show_with_questions === false, "show_with_questions default");
  }
});

// ─── Qualifying ───────────────────────────────────────────

test("qualifying empty {} is schema-valid (preset optional, additional default [])", () => {
  const r = qualifyingQuestionsSchema.safeParse({});
  assert(r.success, "empty parses");
  if (r.success) {
    assert(r.data.additional.length === 0, "additional default");
  }
});

test("qualifying enforces additional max 4", () => {
  const q = {
    question: "Q",
    options: [{ label: "L", value: "v" }],
    persona_field: "f",
  };
  const r = qualifyingQuestionsSchema.safeParse({
    additional: [q, q, q, q, q],
  });
  assert(!r.success, "should reject 5 additional");
});

// ─── Allowed topics ───────────────────────────────────────

test("allowed topics accepts string array", () => {
  const r = allowedTopicsSchema.safeParse(["a", "b"]);
  assert(r.success, "string array parses");
});

test("allowed topics rejects non-string element", () => {
  const r = allowedTopicsSchema.safeParse(["a", 42]);
  assert(!r.success, "should reject mixed array");
});

// ─── Follow up ────────────────────────────────────────────

test("follow-up empty {} normalises with defaults", () => {
  const r = followUpSchema.safeParse({});
  assert(r.success, "empty parses to defaults");
  if (r.success) {
    assert(r.data.enabled === true, "enabled default");
    assert(r.data.default_sensitivity === "balanced", "sensitivity default");
    assert(r.data.rules.length === 0, "rules default empty");
  }
});

test("follow-up rejects rule with action=offer_follow_up missing capture_policy_id", () => {
  const r = followUpSchema.safeParse({
    capture_policies: [
      {
        id: "lead_basic",
        case_type: "lead",
        required_fields: ["name"],
        optional_fields: [],
        privacy_notice: "We use this to contact you.",
        privacy_policy_url: "https://example.com/privacy",
      },
    ],
    rules: [
      {
        id: "r1",
        name: "R1",
        case_type: "lead",
        action: "offer_follow_up",
        routing_key: "leads",
        // capture_policy_id intentionally missing
      },
    ],
  });
  assert(!r.success, "missing capture_policy_id should fail");
});

test("follow-up valid wiring: rule references existing capture_policy by id", () => {
  const r = followUpSchema.safeParse({
    capture_policies: [
      {
        id: "lead_basic",
        case_type: "lead",
        required_fields: ["name"],
        optional_fields: [],
        privacy_notice: "We use this to contact you.",
        privacy_policy_url: "https://example.com/privacy",
      },
    ],
    rules: [
      {
        id: "r1",
        name: "R1",
        case_type: "lead",
        action: "offer_follow_up",
        capture_policy_id: "lead_basic",
        routing_key: "leads",
      },
    ],
    destinations: [
      {
        id: "d1",
        case_type: "lead",
        connector: "webhook",
        routing_key: "leads",
        config: { url: "https://example.com/hook" },
      },
    ],
  });
  assert(r.success, "valid wiring should parse");
});

test("follow-up rejects destination case_type with no matching rule", () => {
  const r = followUpSchema.safeParse({
    rules: [
      {
        id: "r1",
        name: "R1",
        case_type: "lead",
        action: "continue_helping",
        routing_key: "leads",
      },
    ],
    destinations: [
      {
        id: "d1",
        case_type: "cx_support", // no rule for this case_type
        connector: "webhook",
        routing_key: "support",
        config: {},
      },
    ],
  });
  assert(!r.success, "should reject dangling destination case_type");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
