#!/usr/bin/env node

/**
 * Follow-up re-evaluation lifecycle tests (CON-167, Epic C3).
 *
 * Verifies the orchestration layer that wires the classifier (CON-165) +
 * deterministic resolver (CON-166) into `/api/chat`. The classifier is
 * stubbed via the `classifierFn` injection point on `runReEvaluation`;
 * the resolver is the real CON-166 implementation invoked against Doggo +
 * AgPages seed configs.
 *
 * Coverage:
 *   - Greeting / acknowledgement bypass (hi, hello, thanks, ok, cool, emoji)
 *   - Substantive message triggers classifier + resolver
 *   - `enabled: false` short-circuits BEFORE classifier (no LLM call)
 *   - Classifier degraded (`ok:false`) still produces a definitive action
 *   - `actionRequiresWidget` + `buildCaseEvent` coverage of every variant
 *   - Multi-turn fixture (no match → match)
 *   - Belt-and-braces try/catch around an injected throwing classifier
 *
 * Pattern matches `src/lib/follow-up/__tests__/resolver.test.ts` and
 * `src/lib/classifier/__tests__/classifier.test.ts` — pure tsx-runnable,
 * no test-framework dependency.
 *
 * Run with:  npx tsx src/lib/follow-up/__tests__/lifecycle.test.ts
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { ClassifierTenantConfig } from "@/lib/classifier";
import type { ClassifierMessage } from "@/lib/classifier/prompt";
import {
  CLASSIFIER_VERSION,
  safeDefaultClassifierOutput,
  type ClassifierOutput,
} from "@/lib/classifier/schema";
import { followUpSchema, type FollowUp } from "@/lib/forum-config/schema";

import {
  actionRequiresCasePersistence,
  actionRequiresWidget,
  buildCaseEvent,
  looksLikeGreeting,
  runReEvaluation,
  type CaseSseCapturePolicy,
} from "../lifecycle";
import type { ConversationContext, ResolvedAction } from "../resolver-types";

// CON-170 / D2a — fixture for the inlined capture_policy now required on
// the SSE `case` event for actions that carry a capture_policy_id. Mirrors
// the shape of the tenant config's `capture_policies[].` entries.
const FAKE_CAPTURE_POLICY: CaseSseCapturePolicy = {
  id: "cp1",
  case_type: "cx_support",
  required_fields: ["name", "email"],
  optional_fields: ["mobile", "postcode"],
  privacy_notice: "We use your details only to follow up on this enquiry.",
  privacy_policy_url: "https://example.com/privacy",
};

const FAKE_CASE_ID = "00000000-0000-4000-8000-000000000001";

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

const DOGGO: FollowUp = followUpSchema.parse(loadSeed("doggo-follow-up.json"));

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const failures: string[] = [];

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
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
// Fixtures
// ---------------------------------------------------------------------------

type ClassifierOverrides = {
  attributes?: Partial<ClassifierOutput["attributes"]>;
  support_need?: Partial<ClassifierOutput["support_need"]>;
  commercial_intent?: Partial<ClassifierOutput["commercial_intent"]>;
  unanswered_confidence?: number;
};

function classifierOut(
  overrides: ClassifierOverrides = {},
): ClassifierOutput {
  const base = safeDefaultClassifierOutput();
  return {
    ...base,
    ...(overrides.unanswered_confidence !== undefined && {
      unanswered_confidence: overrides.unanswered_confidence,
    }),
    attributes: { ...base.attributes, ...(overrides.attributes ?? {}) },
    support_need: {
      ...base.support_need,
      ...(overrides.support_need ?? {}),
    },
    commercial_intent: {
      ...base.commercial_intent,
      ...(overrides.commercial_intent ?? {}),
    },
  };
}

const TENANT_CONFIG: ClassifierTenantConfig = {
  ai_persona: {
    tone: "friendly",
    locale: "en-AU",
    banned_words: [],
    voice_description: "",
  },
  qualifying_questions: { additional: [] },
  allowed_topics: ["puppies", "breeders", "training"],
};

function ctx(
  overrides: Partial<ConversationContext> = {},
): ConversationContext {
  return {
    tenantId: "tenant_test",
    conversationId: "conv_test",
    ...overrides,
  };
}

function historyOf(visitorMsg: string, assistantMsg = "ok"): ClassifierMessage[] {
  return [
    { role: "user", content: visitorMsg },
    { role: "assistant", content: assistantMsg },
  ];
}

/**
 * Builds a stub `classifierFn` that returns the given output and records
 * invocation count + last-seen tenantId. Mirrors the real
 * `classifyConversation` signature.
 */
function stubClassifier(output: ClassifierOutput) {
  const calls: Array<{ tenantId: string; conversationId: string }> = [];
  const fn = async (input: {
    tenantId: string;
    conversationId: string;
  }) => {
    calls.push({ tenantId: input.tenantId, conversationId: input.conversationId });
    return {
      output,
      ok: true as const,
    };
  };
  return { fn, calls };
}

// ---------------------------------------------------------------------------
// Tests — greeting bypass
// ---------------------------------------------------------------------------

const greetingCases: ReadonlyArray<{ input: string; expected: boolean }> = [
  { input: "hi", expected: true },
  { input: "Hello", expected: true },
  { input: "hello there", expected: true },
  { input: "thanks", expected: true },
  { input: "thanks!", expected: true },
  { input: "thx", expected: true },
  { input: "ok", expected: true },
  { input: "OK!", expected: true },
  { input: "cool", expected: true },
  { input: "yeah", expected: true },
  { input: "no", expected: true },
  { input: "👍", expected: true },
  { input: "🙏 thanks", expected: true },
  { input: "", expected: true },
  { input: "   ", expected: true },
  // Substantive — should NOT be flagged as greeting
  {
    input: "How much does a labrador puppy cost in Sydney?",
    expected: false,
  },
  {
    input: "Do you do puppy training classes for golden retrievers?",
    expected: false,
  },
  // Edge: starts with "hi" as a real word
  {
    input: "history of the breed please",
    expected: false,
  },
];

async function runAllTests() {
for (const c of greetingCases) {
  await test(`looksLikeGreeting(${JSON.stringify(c.input)}) → ${c.expected}`, () => {
    assertEq(looksLikeGreeting(c.input), c.expected, "predicate");
  });
}

// ---------------------------------------------------------------------------
// Tests — actionRequiresWidget + buildCaseEvent (covers every variant)
// ---------------------------------------------------------------------------

const fakeEvidence = {
  matched_attributes: { persona: "customer" },
  rule_conditions: {},
  classifier_version: CLASSIFIER_VERSION,
  classifier_confidence: { support_need: 0.5, commercial_intent: 0.5 },
  sensitivity: "balanced" as const,
};

// CON-172 / D4: `refer_to_approved_contact_method` was previously a noop
// for the widget. It NOW renders a widget surface (inline contact-method
// card) and persists a case row + audit event. Moved into widgetActions
// below.
const noopActions: ReadonlyArray<ResolvedAction> = [
  { type: "continue_helping" },
  { type: "clarify_then_recheck" },
  {
    type: "flag_for_staff_review_without_interrupting_visitor",
    rule_id: "r1",
    routing_key: "rk",
    case_type: "cx_support",
    confidence: 0.9,
    evidence: fakeEvidence,
  },
];

const widgetActions: ReadonlyArray<ResolvedAction> = [
  {
    type: "offer_follow_up",
    capture_policy_id: "cp1",
    rule_id: "r1",
    routing_key: "rk",
    case_type: "lead",
    confidence: 0.8,
    evidence: fakeEvidence,
  },
  {
    type: "capture_details_then_flag",
    capture_policy_id: "cp1",
    rule_id: "r1",
    routing_key: "rk",
    case_type: "cx_support",
    confidence: 0.85,
    evidence: fakeEvidence,
  },
  {
    type: "immediate_escalation",
    capture_policy_id: "cp1",
    rule_id: "r1",
    routing_key: "rk",
    case_type: "cx_support",
    confidence: 0.95,
    evidence: fakeEvidence,
  },
  // CON-172 / D4 — refer is a widget-rendering action now.
  {
    type: "refer_to_approved_contact_method",
    contact_method_id: "cm1",
    rule_id: "r1",
    routing_key: "rk",
    case_type: "cx_support",
    confidence: 0.9,
    evidence: fakeEvidence,
  },
];

for (const a of noopActions) {
  await test(`actionRequiresWidget(${a.type}) → false`, () => {
    assertEq(actionRequiresWidget(a), false, "no widget");
    assertEq(
      buildCaseEvent(a, {
        caseId: FAKE_CASE_ID,
        capturePolicy: FAKE_CAPTURE_POLICY,
      }),
      null,
      "no event",
    );
  });
}

for (const a of widgetActions) {
  await test(`actionRequiresWidget(${a.type}) → true + event shape`, () => {
    assertEq(actionRequiresWidget(a), true, "widget required");
    const evt = buildCaseEvent(a, {
      caseId: FAKE_CASE_ID,
      capturePolicy: FAKE_CAPTURE_POLICY,
    });
    assert(evt !== null, "event built");
    assertEq(evt.type, "case", "type");
    assertEq(evt.case.action, a.type, "action discriminator");
    // CON-170 / D2a — case_id is mandatory on every widget event.
    assertEq(evt.case.case_id, FAKE_CASE_ID, "case_id propagated");
    if ("rule_id" in a) {
      assertEq(evt.case.rule_id, a.rule_id, "rule_id");
      assertEq(evt.case.routing_key, a.routing_key, "routing_key");
      assertEq(evt.case.case_type, a.case_type, "case_type");
      assertEq(evt.case.confidence, a.confidence, "confidence");
    }
    if (a.type === "offer_follow_up" || a.type === "capture_details_then_flag") {
      assertEq(evt.case.capture_policy_id, a.capture_policy_id, "capture_policy_id");
      // CON-170 / D2a — capture_policy must be inlined for these variants.
      assert(
        evt.case.capture_policy !== undefined,
        "capture_policy inlined",
      );
      assertEq(
        evt.case.capture_policy.id,
        FAKE_CAPTURE_POLICY.id,
        "capture_policy.id",
      );
      assertEq(
        evt.case.capture_policy.privacy_policy_url,
        FAKE_CAPTURE_POLICY.privacy_policy_url,
        "capture_policy.privacy_policy_url",
      );
    }
    // Evidence MUST NOT leak to widget
    assert(!("evidence" in evt.case), "evidence must not leak to widget");
  });
}

await test("immediate_escalation with both capture + contact method propagates both", () => {
  const action: ResolvedAction = {
    type: "immediate_escalation",
    capture_policy_id: "cp1",
    contact_method_id: "cm1",
    rule_id: "r1",
    routing_key: "rk",
    case_type: "cx_support",
    confidence: 0.95,
    evidence: fakeEvidence,
  };
  const evt = buildCaseEvent(action, {
    caseId: FAKE_CASE_ID,
    capturePolicy: FAKE_CAPTURE_POLICY,
  });
  assert(evt !== null, "event built");
  assertEq(evt.case.case_id, FAKE_CASE_ID, "case_id");
  assertEq(evt.case.capture_policy_id, "cp1", "policy");
  assert(
    evt.case.capture_policy !== undefined,
    "capture_policy inlined",
  );
  assertEq(evt.case.contact_method_id, "cm1", "contact");
});

await test("immediate_escalation without optional ids omits those fields", () => {
  const action: ResolvedAction = {
    type: "immediate_escalation",
    rule_id: "r1",
    routing_key: "rk",
    case_type: "cx_support",
    confidence: 0.95,
    evidence: fakeEvidence,
  };
  // No capture_policy_id on the action → caller should omit capturePolicy too.
  const evt = buildCaseEvent(action, { caseId: FAKE_CASE_ID });
  assert(evt !== null, "event built");
  assertEq(evt.case.case_id, FAKE_CASE_ID, "case_id still required");
  assert(
    !("capture_policy_id" in evt.case),
    "capture_policy_id should be absent",
  );
  assert(
    !("capture_policy" in evt.case),
    "capture_policy should be absent when action has no policy id",
  );
  assert(
    !("contact_method_id" in evt.case),
    "contact_method_id should be absent",
  );
});

// CON-170 / D2a — actionRequiresCasePersistence covers every variant.
await test("actionRequiresCasePersistence covers every variant correctly", () => {
  // Persisting variants (widget + silent flag).
  for (const a of widgetActions) {
    assertEq(
      actionRequiresCasePersistence(a),
      true,
      `${a.type} should persist`,
    );
  }
  const silentFlag: ResolvedAction = {
    type: "flag_for_staff_review_without_interrupting_visitor",
    rule_id: "r1",
    routing_key: "rk",
    case_type: "cx_support",
    confidence: 0.9,
    evidence: fakeEvidence,
  };
  assertEq(
    actionRequiresCasePersistence(silentFlag),
    true,
    "silent flag persists (PRD invariant: case may exist without contact)",
  );

  // Non-persisting variants. CON-172 / D4: refer_to_approved_contact_method
  // is NO LONGER in this list — it now persists a case row so the staff
  // inbox has audit visibility of out-of-chat referrals.
  const nonPersist: ResolvedAction[] = [
    { type: "continue_helping" },
    { type: "clarify_then_recheck" },
  ];
  for (const a of nonPersist) {
    assertEq(
      actionRequiresCasePersistence(a),
      false,
      `${a.type} should NOT persist`,
    );
  }
});

// CON-169 (Epic D1): the `case` SSE event must surface the rule-configured
// visitor-facing title when `action: "offer_follow_up"` carries it. Widget
// owns the fallback when omitted.
await test("offer_follow_up with offer_title → buildCaseEvent includes it", () => {
  const action: ResolvedAction = {
    type: "offer_follow_up",
    capture_policy_id: "cp1",
    rule_id: "r1",
    routing_key: "rk",
    case_type: "cx_support",
    confidence: 0.8,
    evidence: fakeEvidence,
    offer_title: "Would you like our team to follow up?",
  };
  const evt = buildCaseEvent(action, {
    caseId: FAKE_CASE_ID,
    capturePolicy: FAKE_CAPTURE_POLICY,
  });
  assert(evt !== null, "event built");
  assertEq(
    evt.case.offer_title,
    "Would you like our team to follow up?",
    "offer_title forwarded",
  );
});

await test("offer_follow_up WITHOUT offer_title → buildCaseEvent omits the field", () => {
  const action: ResolvedAction = {
    type: "offer_follow_up",
    capture_policy_id: "cp1",
    rule_id: "r1",
    routing_key: "rk",
    case_type: "cx_support",
    confidence: 0.8,
    evidence: fakeEvidence,
  };
  const evt = buildCaseEvent(action, {
    caseId: FAKE_CASE_ID,
    capturePolicy: FAKE_CAPTURE_POLICY,
  });
  assert(evt !== null, "event built");
  assert(
    !("offer_title" in evt.case),
    "offer_title absent when action omitted it",
  );
});

// ---------------------------------------------------------------------------
// CON-172 / D4 — refer_to_approved_contact_method buildCaseEvent shape
// ---------------------------------------------------------------------------

const FAKE_CONTACT_METHOD_EMAIL = {
  id: "cm-support-email",
  type: "email" as const,
  label: "Email the support team",
  value: "support@example.test",
  url: undefined,
};

const FAKE_CONTACT_METHOD_URL = {
  id: "cm-callback-form",
  type: "url" as const,
  label: "Book a callback",
  value: undefined,
  url: "https://example.test/callback",
};

await test(
  "refer_to_approved_contact_method WITH inlined method → event carries contact_method + id",
  () => {
    const action: ResolvedAction = {
      type: "refer_to_approved_contact_method",
      contact_method_id: "cm-support-email",
      rule_id: "r-refer",
      routing_key: "rk-support",
      case_type: "cx_support",
      confidence: 0.87,
      evidence: fakeEvidence,
    };
    const evt = buildCaseEvent(action, {
      caseId: FAKE_CASE_ID,
      contactMethod: FAKE_CONTACT_METHOD_EMAIL,
    });
    assert(evt !== null, "event built");
    assertEq(evt.case.action, "refer_to_approved_contact_method", "action");
    assertEq(evt.case.case_id, FAKE_CASE_ID, "case_id");
    assertEq(evt.case.rule_id, "r-refer", "rule_id");
    assertEq(evt.case.routing_key, "rk-support", "routing_key");
    assertEq(evt.case.case_type, "cx_support", "case_type");
    assertEq(evt.case.confidence, 0.87, "confidence");
    assertEq(
      evt.case.contact_method_id,
      "cm-support-email",
      "contact_method_id",
    );
    assert(
      evt.case.contact_method !== undefined,
      "contact_method inlined",
    );
    assertEq(
      evt.case.contact_method!.value,
      "support@example.test",
      "contact_method.value preserved",
    );
    // Evidence MUST NOT leak to the widget surface.
    assert(
      !("evidence" in evt.case),
      "evidence must not leak to widget",
    );
  },
);

await test(
  "refer_to_approved_contact_method WITHOUT inlined method → event still carries id (graceful fallback)",
  () => {
    const action: ResolvedAction = {
      type: "refer_to_approved_contact_method",
      contact_method_id: "cm-missing",
      rule_id: "r-refer",
      routing_key: "rk-support",
      case_type: "cx_support",
      confidence: 0.87,
      evidence: fakeEvidence,
    };
    const evt = buildCaseEvent(action, { caseId: FAKE_CASE_ID });
    assert(evt !== null, "event built");
    assertEq(evt.case.contact_method_id, "cm-missing", "id propagated");
    assert(
      !("contact_method" in evt.case),
      "contact_method omitted when not resolved",
    );
  },
);

await test(
  "refer_to_approved_contact_method supports url-type contact methods",
  () => {
    const action: ResolvedAction = {
      type: "refer_to_approved_contact_method",
      contact_method_id: "cm-callback-form",
      rule_id: "r-refer",
      routing_key: "rk-callback",
      case_type: "cx_support",
      confidence: 0.9,
      evidence: fakeEvidence,
    };
    const evt = buildCaseEvent(action, {
      caseId: FAKE_CASE_ID,
      contactMethod: FAKE_CONTACT_METHOD_URL,
    });
    assert(evt !== null, "event built");
    assert(
      evt.case.contact_method !== undefined,
      "contact_method inlined",
    );
    assertEq(evt.case.contact_method!.type, "url", "type");
    assertEq(
      evt.case.contact_method!.url,
      "https://example.test/callback",
      "url preserved",
    );
  },
);

// ---------------------------------------------------------------------------
// Tests — runReEvaluation orchestration
// ---------------------------------------------------------------------------

await test("greeting message → returns null, classifier NOT called", async () => {
  const stub = stubClassifier(classifierOut());
  const result = await runReEvaluation({
    tenantId: "t1",
    conversationId: "c1",
    visitorMessage: "hi",
    history: historyOf("hi"),
    followUpConfig: DOGGO,
    tenantConfig: TENANT_CONFIG,
    conversationContext: ctx(),
    classifierFn: stub.fn,
  });
  assertEq(result, null, "result null");
  assertEq(stub.calls.length, 0, "classifier never invoked");
});

await test("substantive message → classifier called, resolver returns action", async () => {
  const stub = stubClassifier(
    classifierOut({
      attributes: { persona: "customer", intent: "request_quote", topic: "labrador" },
      commercial_intent: { detected: true, confidence: 0.9 },
      unanswered_confidence: 0.95,
    }),
  );
  const result = await runReEvaluation({
    tenantId: "t1",
    conversationId: "c1",
    visitorMessage: "How much for a labrador puppy?",
    history: historyOf("How much for a labrador puppy?"),
    followUpConfig: DOGGO,
    tenantConfig: TENANT_CONFIG,
    conversationContext: ctx(),
    classifierFn: stub.fn,
  });
  assert(result !== null, "result not null");
  assertEq(stub.calls.length, 1, "classifier invoked once");
  assertEq(stub.calls[0].tenantId, "t1", "tenant scoped");
  // Doggo's buyer_pricing rule should match
  assertEq(result.action.type, "capture_details_then_flag", "action resolved");
});

await test("enabled:false → short-circuits BEFORE classifier (no LLM call)", async () => {
  const stub = stubClassifier(classifierOut());
  const disabledConfig: FollowUp = { ...DOGGO, enabled: false };
  const result = await runReEvaluation({
    tenantId: "t1",
    conversationId: "c1",
    visitorMessage: "How much for a labrador puppy?",
    history: historyOf("How much for a labrador puppy?"),
    followUpConfig: disabledConfig,
    tenantConfig: TENANT_CONFIG,
    conversationContext: ctx(),
    classifierFn: stub.fn,
  });
  assertEq(result, null, "result null");
  assertEq(stub.calls.length, 0, "classifier never invoked — cost saving");
});

await test("classifier degraded (ok:false) still produces definitive action", async () => {
  // Simulate classifier returning the safe default with ok:false.
  const degradedFn = async () => ({
    output: safeDefaultClassifierOutput(),
    ok: false as const,
    degradedReason: "openai_error" as const,
  });
  const result = await runReEvaluation({
    tenantId: "t1",
    conversationId: "c1",
    visitorMessage: "Some real question about puppies",
    history: historyOf("Some real question about puppies"),
    followUpConfig: DOGGO,
    tenantConfig: TENANT_CONFIG,
    conversationContext: ctx(),
    classifierFn: degradedFn,
  });
  assert(result !== null, "result not null");
  assertEq(result.classifierResult.ok, false, "classifier flagged degraded");
  // Safe default has unanswered_confidence: 0 which trips the
  // low_confidence_unanswered rule on Doggo (threshold 0.0).
  assertEq(result.action.type, "offer_follow_up", "fallback rule matches");
});

await test("substantive message, resolver returns continue_helping → buildCaseEvent null", async () => {
  // Empty rules → resolver returns continue_helping.
  const emptyConfig: FollowUp = { ...DOGGO, rules: [] };
  const stub = stubClassifier(
    classifierOut({ unanswered_confidence: 0.95 }),
  );
  const result = await runReEvaluation({
    tenantId: "t1",
    conversationId: "c1",
    visitorMessage: "tell me about training",
    history: historyOf("tell me about training"),
    followUpConfig: emptyConfig,
    tenantConfig: TENANT_CONFIG,
    conversationContext: ctx(),
    classifierFn: stub.fn,
  });
  assert(result !== null, "result not null");
  assertEq(result.action.type, "continue_helping", "no rule matched");
  assertEq(
    buildCaseEvent(result.action, { caseId: FAKE_CASE_ID }),
    null,
    "no widget event",
  );
});

await test("classifier throws → runReEvaluation returns null, does not propagate", async () => {
  const throwingFn = async () => {
    throw new Error("boom — classifier exploded");
  };
  // Suppress the expected console.error noise from the belt-and-braces catch.
  const origErr = console.error;
  console.error = () => {};
  try {
    const result = await runReEvaluation({
      tenantId: "t1",
      conversationId: "c1",
      visitorMessage: "Real substantive question about puppies?",
      history: historyOf("Real substantive question about puppies?"),
      followUpConfig: DOGGO,
      tenantConfig: TENANT_CONFIG,
      conversationContext: ctx(),
      classifierFn: throwingFn,
    });
    assertEq(result, null, "result null on caught throw");
  } finally {
    console.error = origErr;
  }
});

await test("multi-turn: turn 1 no-match config → null action, turn 2 match → action", async () => {
  // Turn 1: empty rules → continue_helping (no widget event)
  const emptyConfig: FollowUp = { ...DOGGO, rules: [] };
  const stubT1 = stubClassifier(classifierOut({ unanswered_confidence: 0.95 }));
  const t1 = await runReEvaluation({
    tenantId: "t1",
    conversationId: "c1",
    visitorMessage: "tell me a bit about the breed",
    history: historyOf("tell me a bit about the breed"),
    followUpConfig: emptyConfig,
    tenantConfig: TENANT_CONFIG,
    conversationContext: ctx(),
    classifierFn: stubT1.fn,
  });
  assert(t1 !== null, "turn 1 returns result");
  assertEq(t1.action.type, "continue_helping", "turn 1 no match");
  assertEq(
    buildCaseEvent(t1.action, { caseId: FAKE_CASE_ID }),
    null,
    "turn 1 no widget event",
  );

  // Turn 2: real Doggo config + buyer intent → capture_details_then_flag
  const stubT2 = stubClassifier(
    classifierOut({
      attributes: { persona: "customer", intent: "request_quote", topic: "labrador" },
      commercial_intent: { detected: true, confidence: 0.9 },
      unanswered_confidence: 0.95,
    }),
  );
  const t2 = await runReEvaluation({
    tenantId: "t1",
    conversationId: "c1",
    visitorMessage: "I want to buy a labrador, how much?",
    history: [
      { role: "user", content: "tell me a bit about the breed" },
      { role: "assistant", content: "Here is some breed info..." },
      { role: "user", content: "I want to buy a labrador, how much?" },
      { role: "assistant", content: "Prices vary..." },
    ],
    followUpConfig: DOGGO,
    tenantConfig: TENANT_CONFIG,
    conversationContext: ctx(),
    classifierFn: stubT2.fn,
  });
  assert(t2 !== null, "turn 2 returns result");
  assertEq(t2.action.type, "capture_details_then_flag", "turn 2 matches");
  const evt = buildCaseEvent(t2.action, {
    caseId: FAKE_CASE_ID,
    capturePolicy: FAKE_CAPTURE_POLICY,
  });
  assert(evt !== null, "turn 2 emits widget event");
  assertEq(evt.case.action, "capture_details_then_flag", "event action");
  assertEq(evt.case.case_id, FAKE_CASE_ID, "case_id present on widget event");
  assert(
    evt.case.capture_policy !== undefined,
    "capture_policy inlined on widget event",
  );
});

await test("tenant scoping: conversationContext.tenantId flows through, no cross-leak", async () => {
  // Two parallel runs with different tenants must not see each other's data.
  const stubA = stubClassifier(classifierOut({ unanswered_confidence: 0.95 }));
  const stubB = stubClassifier(classifierOut({ unanswered_confidence: 0.95 }));
  await runReEvaluation({
    tenantId: "tenant_A",
    conversationId: "conv_A",
    visitorMessage: "real question about labradors",
    history: historyOf("real question about labradors"),
    followUpConfig: DOGGO,
    tenantConfig: TENANT_CONFIG,
    conversationContext: ctx({ tenantId: "tenant_A", conversationId: "conv_A" }),
    classifierFn: stubA.fn,
  });
  await runReEvaluation({
    tenantId: "tenant_B",
    conversationId: "conv_B",
    visitorMessage: "different real question about training",
    history: historyOf("different real question about training"),
    followUpConfig: DOGGO,
    tenantConfig: TENANT_CONFIG,
    conversationContext: ctx({ tenantId: "tenant_B", conversationId: "conv_B" }),
    classifierFn: stubB.fn,
  });
  assertEq(stubA.calls[0].tenantId, "tenant_A", "tenant A");
  assertEq(stubB.calls[0].tenantId, "tenant_B", "tenant B");
  assertEq(stubA.calls.length, 1, "A invoked once");
  assertEq(stubB.calls.length, 1, "B invoked once");
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

}

runAllTests().then(() => {
  console.log("");
  console.log("=".repeat(60));
  console.log(`Tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("");
    console.log("Failures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
});
