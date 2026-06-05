#!/usr/bin/env node

/**
 * Follow-up resolver tests (CON-166, Epic C2).
 *
 * Pure-function unit tests for `resolveAction`. No LLM, no network, no DB.
 * Fixtures cover both Doggo and AgPages seed configs (CON-159) plus
 * synthetic edge cases (priority ordering, sensitivity multipliers,
 * exclude_topics, qualifying-persona override, disabled rules/configs,
 * page_url_pattern, empty conditions).
 *
 * Pattern matches `src/lib/forum-config/__tests__/follow-up.test.ts` and
 * `src/lib/classifier/__tests__/classifier.test.ts` — pure tsx-runnable,
 * no test framework dependency.
 *
 * Run with:  npx tsx src/lib/follow-up/__tests__/resolver.test.ts
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CLASSIFIER_VERSION,
  safeDefaultClassifierOutput,
  type ClassifierOutput,
} from "@/lib/classifier/schema";
import { followUpSchema, type FollowUp } from "@/lib/forum-config/schema";

import {
  applySensitivity,
  resolveAction,
  sortRulesByPriority,
} from "../resolver";
import type {
  ConversationContext,
  ResolvedAction,
} from "../resolver-types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SEEDS_DIR = resolve(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "docs",
  "forum-config-examples",
);

function loadSeed(filename: string): unknown {
  return JSON.parse(readFileSync(resolve(SEEDS_DIR, filename), "utf-8"));
}

const doggoConfig = loadSeed("doggo-follow-up.json");
const agpagesConfig = loadSeed("agpages-follow-up.json");

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`❌ ${name}`);
    console.log(`   Error: ${message}`);
    failed++;
    failures.push(`${name}: ${message}`);
  }
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function assertEq<T>(actual: T, expected: T, msg: string) {
  if (actual !== expected) {
    throw new Error(
      `${msg} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Parsed seed configs (schema-validated → tested resolver only sees valid input)
// ---------------------------------------------------------------------------

const DOGGO: FollowUp = followUpSchema.parse(doggoConfig);
const AGPAGES: FollowUp = followUpSchema.parse(agpagesConfig);

// ---------------------------------------------------------------------------
// Classifier-output helpers (shallow override on top of the safe default)
// ---------------------------------------------------------------------------

type ClassifierOverrides = {
  attributes?: Partial<ClassifierOutput["attributes"]>;
  support_need?: Partial<ClassifierOutput["support_need"]>;
  commercial_intent?: Partial<ClassifierOutput["commercial_intent"]>;
  missing_fields?: ClassifierOutput["missing_fields"];
  direct_human_request?: boolean;
  repeated_loop_count?: number;
  unanswered_confidence?: number;
};

function classifier(overrides: ClassifierOverrides = {}): ClassifierOutput {
  const base = safeDefaultClassifierOutput();
  return {
    ...base,
    ...(overrides.missing_fields !== undefined && { missing_fields: overrides.missing_fields }),
    ...(overrides.direct_human_request !== undefined && {
      direct_human_request: overrides.direct_human_request,
    }),
    ...(overrides.repeated_loop_count !== undefined && {
      repeated_loop_count: overrides.repeated_loop_count,
    }),
    ...(overrides.unanswered_confidence !== undefined && {
      unanswered_confidence: overrides.unanswered_confidence,
    }),
    attributes: { ...base.attributes, ...(overrides.attributes ?? {}) },
    support_need: { ...base.support_need, ...(overrides.support_need ?? {}) },
    commercial_intent: {
      ...base.commercial_intent,
      ...(overrides.commercial_intent ?? {}),
    },
  };
}

const baseContext: ConversationContext = {
  tenantId: "tenant_test",
  conversationId: "conv_test",
};

function ctx(overrides: Partial<ConversationContext> = {}): ConversationContext {
  return { ...baseContext, ...overrides };
}

/**
 * Default classifier baseline used by most fixtures: set
 * `unanswered_confidence` high enough that the catch-all
 * `low_confidence_unanswered` CX rule (threshold 0.0,
 * `unanswered_confidence_lte: 0.4`) does NOT fire. Each test that wants to
 * exercise that rule explicitly lowers `unanswered_confidence`.
 */
const HIGH_ANSWER_CONFIDENCE = 0.95;

// Narrow helper — asserts the resolver returned the action variant we expect.
function expectType<T extends ResolvedAction["type"]>(
  action: ResolvedAction,
  type: T,
): Extract<ResolvedAction, { type: T }> {
  assertEq(action.type, type, `action.type`);
  return action as Extract<ResolvedAction, { type: T }>;
}

// ---------------------------------------------------------------------------
// Unit tests — helpers
// ---------------------------------------------------------------------------

test("applySensitivity: balanced is identity", () => {
  assertEq(applySensitivity(0.7, "balanced"), 0.7, "balanced");
});

test("applySensitivity: conservative raises threshold by 20%", () => {
  const v = applySensitivity(0.5, "conservative");
  assert(Math.abs(v - 0.6) < 1e-9, `expected ≈0.6, got ${v}`);
});

test("applySensitivity: proactive lowers threshold by 20%", () => {
  const v = applySensitivity(0.5, "proactive");
  assert(Math.abs(v - 0.4) < 1e-9, `expected ≈0.4, got ${v}`);
});

test("applySensitivity: conservative caps at 1.0", () => {
  assertEq(applySensitivity(0.95, "conservative"), 1, "cap");
});

test("sortRulesByPriority: high before normal before low, stable within priority", () => {
  // AgPages has high, normal, low priorities — re-use it.
  const sorted = sortRulesByPriority(AGPAGES.rules);
  // First two entries should be the two high-priority rules in array order.
  const highIds = AGPAGES.rules
    .filter((r) => r.priority === "high")
    .map((r) => r.id);
  assertEq(sorted[0]?.id, highIds[0], "first high");
  assertEq(sorted[1]?.id, highIds[1], "second high");
  // Last entry should be the single low-priority rule.
  assertEq(
    sorted[sorted.length - 1]?.id,
    "marketplace_navigation_silent_flag",
    "low last",
  );
});

test("sortRulesByPriority: does not mutate input", () => {
  const before = AGPAGES.rules.map((r) => r.id);
  sortRulesByPriority(AGPAGES.rules);
  const after = AGPAGES.rules.map((r) => r.id);
  assertEq(JSON.stringify(before), JSON.stringify(after), "input unchanged");
});

// ---------------------------------------------------------------------------
// Doggo fixtures (15)
// ---------------------------------------------------------------------------

test("Doggo · buyer pricing/availability → capture_details_then_flag", () => {
  const out = classifier({
    attributes: { persona: "customer", intent: "request_quote", topic: "labrador pricing" },
    commercial_intent: { detected: true, confidence: 0.85 },
    unanswered_confidence: HIGH_ANSWER_CONFIDENCE,
  });
  const action = resolveAction({
    classifierOutput: out,
    followUpConfig: DOGGO,
    conversationContext: ctx(),
  });
  const a = expectType(action, "capture_details_then_flag");
  assertEq(a.rule_id, "buyer_pricing_or_availability", "rule");
  assertEq(a.routing_key, "buyer_demand", "routing_key");
  assertEq(a.capture_policy_id, "buyer_lead", "policy");
  assertEq(a.case_type, "lead", "case_type");
  assertEq(a.evidence.classifier_version, CLASSIFIER_VERSION, "version");
});

test("Doggo · breeder partnership → refer_to_approved_contact_method", () => {
  const out = classifier({
    attributes: { persona: "partner", intent: "become_partner", topic: "litter listing" },
    commercial_intent: { detected: true, confidence: 0.8 },
    unanswered_confidence: HIGH_ANSWER_CONFIDENCE,
  });
  const action = resolveAction({
    classifierOutput: out,
    followUpConfig: DOGGO,
    conversationContext: ctx(),
  });
  const a = expectType(action, "refer_to_approved_contact_method");
  assertEq(a.rule_id, "breeder_listing_interest", "rule");
  assertEq(a.contact_method_id, "breeder_application", "contact");
  assertEq(a.routing_key, "breeder_supply", "routing_key");
});

test("Doggo · direct human request → immediate_escalation (confidence override)", () => {
  // Classifier reports no support need confidence — direct_human_request
  // override pushes the rule confidence to 1.0 so the 0.9 threshold fires.
  const out = classifier({
    attributes: { persona: "customer", intent: "unknown", topic: "speak to human" },
    direct_human_request: true,
    support_need: { detected: true, confidence: 0.3 },
    unanswered_confidence: HIGH_ANSWER_CONFIDENCE,
  });
  const action = resolveAction({
    classifierOutput: out,
    followUpConfig: DOGGO,
    conversationContext: ctx(),
  });
  const a = expectType(action, "immediate_escalation");
  assertEq(a.rule_id, "direct_human_request_cx", "rule");
  assertEq(a.capture_policy_id, "cx_email_only", "policy");
  assertEq(a.confidence, 1, "confidence override");
});

test("Doggo · 3 navigation loops → flag_for_staff_review_without_interrupting_visitor", () => {
  const out = classifier({
    attributes: { persona: "customer", intent: "site_navigation", topic: "browsing listings" },
    repeated_loop_count: 3,
    support_need: { detected: true, confidence: 0.6 },
    unanswered_confidence: HIGH_ANSWER_CONFIDENCE,
  });
  const action = resolveAction({
    classifierOutput: out,
    followUpConfig: DOGGO,
    conversationContext: ctx(),
  });
  const a = expectType(action, "flag_for_staff_review_without_interrupting_visitor");
  assertEq(a.rule_id, "repeated_listing_navigation_silent", "rule");
  assertEq(a.routing_key, "cx_default", "routing_key");
});

test("Doggo · low unanswered_confidence triggers offer_follow_up (CX path)", () => {
  // commercial_intent low → lead rules skipped on threshold.
  // unanswered_confidence_lte 0.4 matches, threshold 0.0 always passes.
  const out = classifier({
    attributes: { persona: "customer", intent: "general_research", topic: "puppy advice" },
    commercial_intent: { detected: false, confidence: 0.1 },
    unanswered_confidence: 0.2,
    support_need: { detected: true, confidence: 0.5 },
  });
  const action = resolveAction({
    classifierOutput: out,
    followUpConfig: DOGGO,
    conversationContext: ctx(),
  });
  const a = expectType(action, "offer_follow_up");
  assertEq(a.rule_id, "low_confidence_unanswered", "rule");
  assertEq(a.capture_policy_id, "cx_email_only", "policy");
});

test("Doggo · conservative sensitivity raises bar, no match where balanced matched", () => {
  // `buyer_pricing_or_availability` threshold 0.75; conservative × 1.2 = 0.9.
  // Classifier confidence 0.8 passes balanced (≥0.75) but not conservative (≥0.9).
  const out = classifier({
    attributes: { persona: "customer", intent: "request_quote", topic: "labrador pricing" },
    commercial_intent: { detected: true, confidence: 0.8 },
    unanswered_confidence: HIGH_ANSWER_CONFIDENCE,
  });
  const balancedAction = resolveAction({
    classifierOutput: out,
    followUpConfig: DOGGO,
    conversationContext: ctx(),
  });
  expectType(balancedAction, "capture_details_then_flag");

  const conservativeAction = resolveAction({
    classifierOutput: out,
    followUpConfig: { ...DOGGO, default_sensitivity: "conservative" },
    conversationContext: ctx(),
  });
  expectType(conservativeAction, "continue_helping");
});

test("Doggo · proactive sensitivity lowers bar, match where balanced did not", () => {
  // threshold 0.75; proactive × 0.8 = 0.6. Confidence 0.65 only passes
  // proactive.
  const out = classifier({
    attributes: { persona: "customer", intent: "request_quote", topic: "labrador pricing" },
    commercial_intent: { detected: true, confidence: 0.65 },
    unanswered_confidence: HIGH_ANSWER_CONFIDENCE,
  });
  const balancedAction = resolveAction({
    classifierOutput: out,
    followUpConfig: DOGGO,
    conversationContext: ctx(),
  });
  expectType(balancedAction, "continue_helping");

  const proactiveAction = resolveAction({
    classifierOutput: out,
    followUpConfig: { ...DOGGO, default_sensitivity: "proactive" },
    conversationContext: ctx(),
  });
  expectType(proactiveAction, "capture_details_then_flag");
});

test("Doggo · disabled top-level config returns continue_helping", () => {
  const out = classifier({
    attributes: { persona: "customer", intent: "request_quote", topic: "labrador pricing" },
    commercial_intent: { detected: true, confidence: 0.99 },
    direct_human_request: true,
  });
  const action = resolveAction({
    classifierOutput: out,
    followUpConfig: { ...DOGGO, enabled: false },
    conversationContext: ctx(),
  });
  expectType(action, "continue_helping");
});

test("Doggo · disabled rule is skipped even if it would otherwise match", () => {
  const out = classifier({
    attributes: { persona: "customer", intent: "request_quote", topic: "labrador pricing" },
    commercial_intent: { detected: true, confidence: 0.95 },
    unanswered_confidence: HIGH_ANSWER_CONFIDENCE,
  });
  // Disable the buyer rule — should fall through to continue_helping
  // (no other lead-rule matches and CX rules need a CX signal).
  const patchedRules = DOGGO.rules.map((r) =>
    r.id === "buyer_pricing_or_availability" ? { ...r, enabled: false } : r,
  );
  const action = resolveAction({
    classifierOutput: out,
    followUpConfig: { ...DOGGO, rules: patchedRules },
    conversationContext: ctx(),
  });
  expectType(action, "continue_helping");
});

test("Doggo · empty rule list → continue_helping", () => {
  const out = classifier({
    attributes: { persona: "customer", intent: "request_quote", topic: "anything" },
    commercial_intent: { detected: true, confidence: 0.99 },
    unanswered_confidence: HIGH_ANSWER_CONFIDENCE,
  });
  const action = resolveAction({
    classifierOutput: out,
    followUpConfig: { ...DOGGO, rules: [] },
    conversationContext: ctx(),
  });
  expectType(action, "continue_helping");
});

test("Doggo · qualifying persona overrides classifier 'unknown' (breeder via CON-94)", () => {
  // Classifier says persona=unknown, but qualifying.persona=breeder → the
  // breeder rule's persona_in still matches.
  const out = classifier({
    attributes: { persona: "unknown", intent: "become_partner", topic: "partnership" },
    commercial_intent: { detected: true, confidence: 0.8 },
    unanswered_confidence: HIGH_ANSWER_CONFIDENCE,
  });
  const action = resolveAction({
    classifierOutput: out,
    followUpConfig: DOGGO,
    conversationContext: ctx({ qualifyingPersona: { persona: "partner" } }),
  });
  const a = expectType(action, "refer_to_approved_contact_method");
  assertEq(a.rule_id, "breeder_listing_interest", "rule");
});

test("Doggo · high-priority direct_human_request wins over normal-priority lead", () => {
  // Both lead and CX rules would match — high-priority direct_human_request
  // must win.
  const out = classifier({
    attributes: { persona: "customer", intent: "request_quote", topic: "puppy pricing" },
    commercial_intent: { detected: true, confidence: 0.95 },
    direct_human_request: true,
    unanswered_confidence: HIGH_ANSWER_CONFIDENCE,
  });
  const action = resolveAction({
    classifierOutput: out,
    followUpConfig: DOGGO,
    conversationContext: ctx(),
  });
  expectType(action, "immediate_escalation");
});

test("Doggo · navigation loop priority=low loses to default low_confidence rule (normal)", () => {
  // Visitor browsing AND low unanswered → both CX rules match.
  // `low_confidence_unanswered` is normal-priority → wins over the low-priority
  // navigation flag.
  const out = classifier({
    attributes: { persona: "customer", intent: "site_navigation", topic: "browsing" },
    repeated_loop_count: 4,
    unanswered_confidence: 0.2,
    support_need: { detected: true, confidence: 0.7 },
  });
  const action = resolveAction({
    classifierOutput: out,
    followUpConfig: DOGGO,
    conversationContext: ctx(),
  });
  const a = expectType(action, "offer_follow_up");
  assertEq(a.rule_id, "low_confidence_unanswered", "rule");
});

test("Doggo · exclude_topics injected synthetically blocks a rule", () => {
  // Note: Doggo seed has no exclude_topics; inject one on the buyer rule and
  // confirm the rule no longer matches when the topic is excluded.
  const patchedRules = DOGGO.rules.map((r) =>
    r.id === "buyer_pricing_or_availability"
      ? { ...r, when: { ...r.when, exclude_topics: ["general_research"] } }
      : r,
  );
  const out = classifier({
    attributes: { persona: "customer", intent: "request_quote", topic: "general_research" },
    commercial_intent: { detected: true, confidence: 0.95 },
    unanswered_confidence: HIGH_ANSWER_CONFIDENCE,
  });
  const action = resolveAction({
    classifierOutput: out,
    followUpConfig: { ...DOGGO, rules: patchedRules },
    conversationContext: ctx(),
  });
  expectType(action, "continue_helping");
});

test("Doggo · just-below threshold → continue_helping", () => {
  // buyer rule threshold 0.75; 0.74 should not match under balanced.
  const out = classifier({
    attributes: { persona: "customer", intent: "request_quote", topic: "labrador" },
    commercial_intent: { detected: true, confidence: 0.74 },
    unanswered_confidence: HIGH_ANSWER_CONFIDENCE,
  });
  const action = resolveAction({
    classifierOutput: out,
    followUpConfig: DOGGO,
    conversationContext: ctx(),
  });
  expectType(action, "continue_helping");
});

// ---------------------------------------------------------------------------
// AgPages fixtures (15)
// ---------------------------------------------------------------------------

test("AgPages · farmer service request → capture_details_then_flag", () => {
  const out = classifier({
    attributes: { persona: "customer", intent: "enquire", topic: "fencing job" },
    commercial_intent: { detected: true, confidence: 0.85 },
    unanswered_confidence: HIGH_ANSWER_CONFIDENCE,
  });
  const action = resolveAction({
    classifierOutput: out,
    followUpConfig: AGPAGES,
    conversationContext: ctx(),
  });
  const a = expectType(action, "capture_details_then_flag");
  assertEq(a.rule_id, "farmer_service_request", "rule");
  assertEq(a.capture_policy_id, "marketplace_demand_lead", "policy");
  assertEq(a.routing_key, "marketplace_demand", "routing_key");
});

test("AgPages · contractor offers availability → refer_to_approved_contact_method", () => {
  const out = classifier({
    attributes: { persona: "supplier", intent: "offer_service", topic: "service area" },
    commercial_intent: { detected: true, confidence: 0.78 },
    unanswered_confidence: HIGH_ANSWER_CONFIDENCE,
  });
  const action = resolveAction({
    classifierOutput: out,
    followUpConfig: AGPAGES,
    conversationContext: ctx(),
  });
  const a = expectType(action, "refer_to_approved_contact_method");
  assertEq(a.rule_id, "contractor_availability_signal", "rule");
  assertEq(a.contact_method_id, "contractor_application", "contact");
});

test("AgPages · direct human request → immediate_escalation", () => {
  const out = classifier({
    attributes: { persona: "customer", intent: "unknown", topic: "human pls" },
    direct_human_request: true,
    unanswered_confidence: HIGH_ANSWER_CONFIDENCE,
  });
  const action = resolveAction({
    classifierOutput: out,
    followUpConfig: AGPAGES,
    conversationContext: ctx(),
  });
  const a = expectType(action, "immediate_escalation");
  assertEq(a.rule_id, "direct_human_request_cx", "rule");
});

test("AgPages · low unanswered confidence → offer_follow_up", () => {
  const out = classifier({
    attributes: { persona: "customer", intent: "general_research", topic: "weed control" },
    unanswered_confidence: 0.2,
    support_need: { detected: true, confidence: 0.4 },
  });
  const action = resolveAction({
    classifierOutput: out,
    followUpConfig: AGPAGES,
    conversationContext: ctx(),
  });
  const a = expectType(action, "offer_follow_up");
  assertEq(a.rule_id, "low_confidence_unanswered", "rule");
});

test("AgPages · frustrated + high urgency → offer_follow_up via frustrated_visitor", () => {
  // High unanswered confidence so the low_confidence catch-all is muted —
  // ensures the frustrated_visitor rule is what fires.
  const out = classifier({
    attributes: {
      persona: "customer",
      intent: "general_research",
      topic: "support",
      sentiment: "frustrated",
      urgency: "high",
    },
    support_need: { detected: true, confidence: 0.8 },
    unanswered_confidence: HIGH_ANSWER_CONFIDENCE,
  });
  const action = resolveAction({
    classifierOutput: out,
    followUpConfig: AGPAGES,
    conversationContext: ctx(),
  });
  const a = expectType(action, "offer_follow_up");
  assertEq(a.rule_id, "frustrated_visitor", "rule");
});

test("AgPages · navigation loop → flag_for_staff_review_without_interrupting_visitor", () => {
  const out = classifier({
    attributes: { persona: "customer", intent: "site_navigation", topic: "browsing" },
    repeated_loop_count: 5,
    support_need: { detected: true, confidence: 0.6 },
    unanswered_confidence: HIGH_ANSWER_CONFIDENCE,
  });
  const action = resolveAction({
    classifierOutput: out,
    followUpConfig: AGPAGES,
    conversationContext: ctx(),
  });
  const a = expectType(action, "flag_for_staff_review_without_interrupting_visitor");
  assertEq(a.rule_id, "marketplace_navigation_silent_flag", "rule");
  assertEq(a.routing_key, "cx_research", "routing_key");
});

test("AgPages · conservative sensitivity raises bar — frustrated_visitor no longer matches", () => {
  // frustrated_visitor threshold 0.65; conservative × 1.2 = 0.78.
  // Confidence 0.70 passes balanced but not conservative.
  const out = classifier({
    attributes: {
      persona: "customer",
      intent: "general_research",
      topic: "support",
      sentiment: "frustrated",
      urgency: "high",
    },
    support_need: { detected: true, confidence: 0.7 },
    unanswered_confidence: HIGH_ANSWER_CONFIDENCE,
  });
  const conservativeAction = resolveAction({
    classifierOutput: out,
    followUpConfig: { ...AGPAGES, default_sensitivity: "conservative" },
    conversationContext: ctx(),
  });
  expectType(conservativeAction, "continue_helping");
});

test("AgPages · proactive sensitivity surfaces near-threshold contractor signal", () => {
  // contractor_availability_signal threshold 0.70; proactive × 0.8 = 0.56.
  // Confidence 0.6 passes only proactive.
  const out = classifier({
    attributes: { persona: "supplier", intent: "offer_service", topic: "availability" },
    commercial_intent: { detected: true, confidence: 0.6 },
    unanswered_confidence: HIGH_ANSWER_CONFIDENCE,
  });
  const balanced = resolveAction({
    classifierOutput: out,
    followUpConfig: AGPAGES,
    conversationContext: ctx(),
  });
  expectType(balanced, "continue_helping");
  const proactive = resolveAction({
    classifierOutput: out,
    followUpConfig: { ...AGPAGES, default_sensitivity: "proactive" },
    conversationContext: ctx(),
  });
  expectType(proactive, "refer_to_approved_contact_method");
});

test("AgPages · priority — direct_human_request beats farmer_service_request", () => {
  const out = classifier({
    attributes: { persona: "customer", intent: "enquire", topic: "fencing" },
    commercial_intent: { detected: true, confidence: 0.95 },
    direct_human_request: true,
    unanswered_confidence: HIGH_ANSWER_CONFIDENCE,
  });
  const action = resolveAction({
    classifierOutput: out,
    followUpConfig: AGPAGES,
    conversationContext: ctx(),
  });
  const a = expectType(action, "immediate_escalation");
  assertEq(a.rule_id, "direct_human_request_cx", "rule");
});

test("AgPages · same-priority array order — direct_human_request_cx wins over frustrated_visitor", () => {
  // Both high-priority CX rules: classifier has direct_human_request AND
  // frustrated/high urgency. direct_human_request_cx appears first in array.
  const out = classifier({
    attributes: {
      persona: "customer",
      intent: "unknown",
      topic: "support",
      sentiment: "frustrated",
      urgency: "high",
    },
    direct_human_request: true,
    support_need: { detected: true, confidence: 0.95 },
    unanswered_confidence: HIGH_ANSWER_CONFIDENCE,
  });
  const action = resolveAction({
    classifierOutput: out,
    followUpConfig: AGPAGES,
    conversationContext: ctx(),
  });
  const a = expectType(action, "immediate_escalation");
  assertEq(a.rule_id, "direct_human_request_cx", "rule");
});

test("AgPages · disabled frustrated_visitor falls through to low_confidence_unanswered", () => {
  const patchedRules = AGPAGES.rules.map((r) =>
    r.id === "frustrated_visitor" ? { ...r, enabled: false } : r,
  );
  const out = classifier({
    attributes: {
      persona: "customer",
      intent: "general_research",
      topic: "support",
      sentiment: "frustrated",
      urgency: "high",
    },
    unanswered_confidence: 0.3,
    support_need: { detected: true, confidence: 0.9 },
  });
  const action = resolveAction({
    classifierOutput: out,
    followUpConfig: { ...AGPAGES, rules: patchedRules },
    conversationContext: ctx(),
  });
  const a = expectType(action, "offer_follow_up");
  assertEq(a.rule_id, "low_confidence_unanswered", "rule");
});

test("AgPages · exclude_topics 'general_research' blocks farmer_service_request", () => {
  // Seed rule already has exclude_topics: ["general_research"].
  const out = classifier({
    attributes: { persona: "customer", intent: "enquire", topic: "general_research" },
    commercial_intent: { detected: true, confidence: 0.95 },
    unanswered_confidence: HIGH_ANSWER_CONFIDENCE,
  });
  const action = resolveAction({
    classifierOutput: out,
    followUpConfig: AGPAGES,
    conversationContext: ctx(),
  });
  expectType(action, "continue_helping");
});

test("AgPages · mixed match — high-priority CX wins over normal-priority lead", () => {
  // direct_human_request (high) + farmer_service_request (normal) both match.
  // High wins.
  const out = classifier({
    attributes: { persona: "customer", intent: "enquire", topic: "fencing" },
    commercial_intent: { detected: true, confidence: 0.95 },
    direct_human_request: true,
    unanswered_confidence: HIGH_ANSWER_CONFIDENCE,
  });
  const action = resolveAction({
    classifierOutput: out,
    followUpConfig: AGPAGES,
    conversationContext: ctx(),
  });
  expectType(action, "immediate_escalation");
});

test("AgPages · qualifying persona 'farmer' overrides classifier 'unknown'", () => {
  const out = classifier({
    attributes: { persona: "unknown", intent: "enquire", topic: "fencing" },
    commercial_intent: { detected: true, confidence: 0.85 },
    unanswered_confidence: HIGH_ANSWER_CONFIDENCE,
  });
  const action = resolveAction({
    classifierOutput: out,
    followUpConfig: AGPAGES,
    conversationContext: ctx({ qualifyingPersona: { persona: "customer" } }),
  });
  const a = expectType(action, "capture_details_then_flag");
  assertEq(a.rule_id, "farmer_service_request", "rule");
});

// ---------------------------------------------------------------------------
// Synthetic edge cases
// ---------------------------------------------------------------------------

test("Empty when:{} rule matches anything at/above threshold (lead)", () => {
  const empty: FollowUp = followUpSchema.parse({
    enabled: true,
    rules: [
      {
        id: "any_lead",
        name: "Any lead",
        case_type: "lead",
        priority: "normal",
        confidence_threshold: 0.5,
        when: {},
        action: "offer_follow_up",
        capture_policy_id: "lead_policy",
        routing_key: "lead_default",
      },
    ],
    capture_policies: [
      {
        id: "lead_policy",
        case_type: "lead",
        required_fields: ["name"],
        privacy_notice: "ok",
        privacy_policy_url: "https://example.com/privacy",
      },
    ],
    destinations: [
      {
        id: "lead_dest",
        case_type: "lead",
        connector: "webhook",
        routing_key: "lead_default",
      },
    ],
  });
  const out = classifier({
    commercial_intent: { detected: true, confidence: 0.6 },
  });
  const action = resolveAction({
    classifierOutput: out,
    followUpConfig: empty,
    conversationContext: ctx(),
  });
  expectType(action, "offer_follow_up");
});

test("page_url_pattern matches → rule fires", () => {
  const cfg: FollowUp = followUpSchema.parse({
    enabled: true,
    rules: [
      {
        id: "pricing_page",
        name: "Pricing page lead",
        case_type: "lead",
        priority: "normal",
        confidence_threshold: 0.0,
        when: { page_url_pattern: "/pricing" },
        action: "offer_follow_up",
        capture_policy_id: "p",
        routing_key: "r",
      },
    ],
    capture_policies: [
      {
        id: "p",
        case_type: "lead",
        required_fields: ["name"],
        privacy_notice: "ok",
        privacy_policy_url: "https://example.com/privacy",
      },
    ],
    destinations: [
      { id: "d", case_type: "lead", connector: "webhook", routing_key: "r" },
    ],
  });
  const out = classifier({ commercial_intent: { detected: true, confidence: 0.5 } });
  const match = resolveAction({
    classifierOutput: out,
    followUpConfig: cfg,
    conversationContext: ctx({ pageUrl: "https://x.com/pricing" }),
  });
  expectType(match, "offer_follow_up");

  const noMatch = resolveAction({
    classifierOutput: out,
    followUpConfig: cfg,
    conversationContext: ctx({ pageUrl: "https://x.com/blog" }),
  });
  expectType(noMatch, "continue_helping");

  const noUrl = resolveAction({
    classifierOutput: out,
    followUpConfig: cfg,
    conversationContext: ctx(),
  });
  expectType(noUrl, "continue_helping");
});

test("location_in is case-insensitive", () => {
  const cfg: FollowUp = followUpSchema.parse({
    enabled: true,
    rules: [
      {
        id: "nsw_lead",
        name: "NSW lead",
        case_type: "lead",
        priority: "normal",
        confidence_threshold: 0.0,
        when: { location_in: ["nsw", "vic"] },
        action: "offer_follow_up",
        capture_policy_id: "p",
        routing_key: "r",
      },
    ],
    capture_policies: [
      {
        id: "p",
        case_type: "lead",
        required_fields: ["name"],
        privacy_notice: "ok",
        privacy_policy_url: "https://example.com/privacy",
      },
    ],
    destinations: [
      { id: "d", case_type: "lead", connector: "webhook", routing_key: "r" },
    ],
  });
  const out = classifier({
    attributes: { location: "NSW" },
    commercial_intent: { detected: true, confidence: 0.5 },
  });
  const action = resolveAction({
    classifierOutput: out,
    followUpConfig: cfg,
    conversationContext: ctx(),
  });
  expectType(action, "offer_follow_up");
});

test("Evidence captures only attributes the rule's when block inspected", () => {
  const out = classifier({
    attributes: { persona: "customer", intent: "request_quote", topic: "labrador" },
    commercial_intent: { detected: true, confidence: 0.9 },
    unanswered_confidence: HIGH_ANSWER_CONFIDENCE,
  });
  const action = resolveAction({
    classifierOutput: out,
    followUpConfig: DOGGO,
    conversationContext: ctx(),
  });
  const a = expectType(action, "capture_details_then_flag");
  // buyer_pricing_or_availability only inspects intent_in
  assertEq(
    Object.keys(a.evidence.matched_attributes).sort().join(","),
    "intent",
    "matched attributes keys",
  );
  assertEq(a.evidence.matched_attributes.intent, "request_quote", "intent");
  assertEq(a.evidence.sensitivity, "balanced", "sensitivity recorded");
});

test("Pure function — repeat call with same input yields identical output", () => {
  const out = classifier({
    attributes: { persona: "customer", intent: "request_quote", topic: "labrador" },
    commercial_intent: { detected: true, confidence: 0.9 },
    unanswered_confidence: HIGH_ANSWER_CONFIDENCE,
  });
  const a = resolveAction({
    classifierOutput: out,
    followUpConfig: DOGGO,
    conversationContext: ctx(),
  });
  const b = resolveAction({
    classifierOutput: out,
    followUpConfig: DOGGO,
    conversationContext: ctx(),
  });
  assertEq(JSON.stringify(a), JSON.stringify(b), "deterministic");
});

test("Inputs are not mutated by resolveAction", () => {
  const out = classifier({
    attributes: { persona: "customer", intent: "enquire", topic: "fencing" },
    commercial_intent: { detected: true, confidence: 0.9 },
    unanswered_confidence: HIGH_ANSWER_CONFIDENCE,
  });
  const beforeRules = JSON.stringify(AGPAGES.rules);
  const beforeOut = JSON.stringify(out);
  resolveAction({
    classifierOutput: out,
    followUpConfig: AGPAGES,
    conversationContext: ctx(),
  });
  assertEq(JSON.stringify(AGPAGES.rules), beforeRules, "rules unchanged");
  assertEq(JSON.stringify(out), beforeOut, "classifier output unchanged");
});

test("safeDefaultClassifierOutput hits the catch-all low_confidence_unanswered rule", () => {
  // safeDefaultClassifierOutput returns `unanswered_confidence: 0`, which
  // satisfies the `unanswered_confidence_lte: 0.4` condition in both seed
  // configs' `low_confidence_unanswered` rule. This is the intentional
  // catch-all behaviour: when the classifier failed, both tenants prefer
  // "offer follow-up" to a silent drop. Documented here so a future change
  // to the seeds (e.g. removing the catch-all) flags this test rather than
  // silently regressing.
  const out = safeDefaultClassifierOutput();
  const doggo = resolveAction({
    classifierOutput: out,
    followUpConfig: DOGGO,
    conversationContext: ctx(),
  });
  const doggoAction = expectType(doggo, "offer_follow_up");
  assertEq(doggoAction.rule_id, "low_confidence_unanswered", "Doggo catch-all");

  const agpages = resolveAction({
    classifierOutput: out,
    followUpConfig: AGPAGES,
    conversationContext: ctx(),
  });
  const agpagesAction = expectType(agpages, "offer_follow_up");
  assertEq(
    agpagesAction.rule_id,
    "low_confidence_unanswered",
    "AgPages catch-all",
  );
});

test("safeDefaultClassifierOutput → continue_helping when low_confidence_unanswered rule is removed", () => {
  const out = safeDefaultClassifierOutput();
  const minimal: FollowUp = {
    ...DOGGO,
    rules: DOGGO.rules.filter((r) => r.id !== "low_confidence_unanswered"),
  };
  const action = resolveAction({
    classifierOutput: out,
    followUpConfig: minimal,
    conversationContext: ctx(),
  });
  expectType(action, "continue_helping");
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log("");
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("");
  console.log("Failures:");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
