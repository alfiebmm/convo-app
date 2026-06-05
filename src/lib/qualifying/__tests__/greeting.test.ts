/**
 * Tests for the greeting-turn prompt addendum used by /api/chat when
 * the widget fires `triggerGreeting: true` after the qualifying flow
 * completes or is skipped.
 *
 * Run with: `npx tsx --test src/lib/qualifying/__tests__/greeting.test.ts`
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGreetingAddendum } from "../greeting";

test("buildGreetingAddendum (answered): mentions qualifying answers", () => {
  const out = buildGreetingAddendum({ skipped: false });
  assert.match(out, /finished the qualifying questions/);
  assert.match(out, /single short, warm sentence/);
});

test("buildGreetingAddendum (skipped): never references persona", () => {
  const out = buildGreetingAddendum({ skipped: true });
  assert.match(out, /opted not to share details/);
  assert.match(out, /do NOT reference any/i);
  // Skipped branch must not imply we know anything about the visitor.
  assert.doesNotMatch(out, /acknowledges what they told you/);
});

test("buildGreetingAddendum: both branches forbid the 3-part structure", () => {
  for (const skipped of [false, true]) {
    const out = buildGreetingAddendum({ skipped });
    assert.match(out, /NOT follow the 3-part\s+response\s+structure/);
  }
});

test("buildGreetingAddendum: brand voice \u2014 no exclamation marks in the rule", () => {
  for (const skipped of [false, true]) {
    const out = buildGreetingAddendum({ skipped });
    // The rule itself forbids exclamation marks.
    assert.match(out, /Do NOT use\s+exclamation\s+marks/);
    // And the rule body itself stays calm \u2014 no exclamation marks.
    assert.equal(out.includes("!"), false);
  }
});

test("buildGreetingAddendum: both branches cap output at one sentence", () => {
  for (const skipped of [false, true]) {
    const out = buildGreetingAddendum({ skipped });
    assert.match(out, /One short sentence only/);
  }
});

test("buildGreetingAddendum: answered/skipped diverge meaningfully", () => {
  const answered = buildGreetingAddendum({ skipped: false });
  const skipped = buildGreetingAddendum({ skipped: true });
  assert.notEqual(answered, skipped);
});
