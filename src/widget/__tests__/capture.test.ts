#!/usr/bin/env node

/**
 * Widget capture-flow unit tests (CON-170 / D2b, Epic D2).
 *
 * Pure tsx-runnable. Exercises the deterministic pieces of
 * `src/widget/capture.ts` — the validator + the `shouldRunCaptureForAction`
 * predicate. DOM rendering is covered by the e2e smoke (Doggo dashboard
 * widget) once D2b is deployed; we don't ship JSDOM into this repo.
 *
 * Run with:
 *   npx tsx src/widget/__tests__/capture.test.ts
 */

import {
  shouldRunCaptureForAction,
  validateClientField,
} from "../capture";

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
// shouldRunCaptureForAction
// ---------------------------------------------------------------------------

test("shouldRunCaptureForAction matches D2 action set", () => {
  assert(
    shouldRunCaptureForAction("offer_follow_up"),
    "offer_follow_up should chain capture on Yes",
  );
  assert(
    shouldRunCaptureForAction("capture_details_then_flag"),
    "capture_details_then_flag must run capture",
  );
  assert(
    shouldRunCaptureForAction("immediate_escalation"),
    "immediate_escalation runs capture when policy attached",
  );
});

test("shouldRunCaptureForAction excludes silent / non-widget actions", () => {
  assert(
    !shouldRunCaptureForAction("continue_helping"),
    "continue_helping is silent",
  );
  assert(
    !shouldRunCaptureForAction("clarify_then_recheck"),
    "clarify_then_recheck is silent",
  );
  assert(
    !shouldRunCaptureForAction(
      "flag_for_staff_review_without_interrupting_visitor",
    ),
    "silent flag is silent",
  );
  assert(
    !shouldRunCaptureForAction("refer_to_approved_contact_method"),
    "refer is assistant-message-only at V1",
  );
});

// ---------------------------------------------------------------------------
// validateClientField — mirrors server's validateCaptureField
// ---------------------------------------------------------------------------

test("validateClientField: name trims and accepts", () => {
  const r = validateClientField("name", "  Blake  ");
  assert(r.ok && r.value === "Blake", "trimmed Blake");
});

test("validateClientField: empty rejected", () => {
  const r = validateClientField("name", "   ");
  assert(!r.ok, "should reject");
});

test("validateClientField: email lowercases", () => {
  const r = validateClientField("email", "Test@Example.Com");
  assert(r.ok && r.value === "test@example.com", "lowercased");
});

test("validateClientField: malformed email rejected with friendly copy", () => {
  const r = validateClientField("email", "no-at-symbol");
  assert(!r.ok, "should reject");
  if (!r.ok) {
    // Brand voice: no exclamation marks, sentence case.
    assert(
      !r.reason.includes("!"),
      `error should not contain exclamation marks: ${r.reason}`,
    );
  }
});

test("validateClientField: mobile strips separators", () => {
  const r = validateClientField("mobile", "0400-123-456");
  assert(r.ok, "should accept");
});

test("validateClientField: mobile rejects too-short", () => {
  const r = validateClientField("mobile", "12");
  assert(!r.ok, "should reject");
});

test("validateClientField: postcode AU 4-digit ok", () => {
  const r = validateClientField("postcode", "2000");
  assert(r.ok && r.value === "2000", "ok");
});

test("validateClientField: postcode garbage rejected", () => {
  const r = validateClientField("postcode", "??????");
  assert(!r.ok, "should reject");
});

test("validateClientField: custom field accepted as-is", () => {
  const r = validateClientField("property_size", "5 acres");
  assert(r.ok && r.value === "5 acres", "ok");
});

test("validateClientField: 5KB value rejected", () => {
  const big = "x".repeat(5000);
  const r = validateClientField("free_text_note", big);
  assert(!r.ok, "should reject");
});

// ---------------------------------------------------------------------------
// Australian English / brand voice spot-checks
// ---------------------------------------------------------------------------

test("error copy: no exclamation marks in any rejection reason", () => {
  const samples: Array<[string, string]> = [
    ["email", "x"],
    ["mobile", "x"],
    ["postcode", "??"],
    ["name", ""],
  ];
  for (const [field, val] of samples) {
    const r = validateClientField(field, val);
    if (!r.ok) {
      assertEq(
        r.reason.includes("!"),
        false,
        `${field}: reason must be exclamation-free`,
      );
    }
  }
});

console.log("");
if (failed === 0) {
  console.log(`✅ All ${passed} tests passed.`);
  process.exit(0);
} else {
  console.log(`❌ ${failed}/${passed + failed} tests failed.`);
  for (const f of failures) console.log(`   - ${f}`);
  process.exit(1);
}
