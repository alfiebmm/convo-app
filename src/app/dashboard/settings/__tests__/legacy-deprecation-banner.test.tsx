#!/usr/bin/env node
import {
  anyForumConfigSlicePopulated,
  getLegacyBannerDismissalKey,
  isLegacyBannerDismissed,
  persistLegacyBannerDismissal,
  shouldAutoHideLegacyBanner,
} from "../legacy-deprecation-banner";

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

function assertEq<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function makeStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

// ─── CON-192 baseline ──────────────────────────────────────────

test("banner hides when ai_persona is populated for a persona surface", () => {
  assert(
    shouldAutoHideLegacyBanner("audience-persona", { ai_persona: true }),
    "audience persona should hide",
  );
  assert(
    shouldAutoHideLegacyBanner("widget-prompt", { ai_persona: true }),
    "widget prompt should hide",
  );
});

test("banner hides when allowed_topics is populated for allowed-topics surface", () => {
  assert(
    shouldAutoHideLegacyBanner("allowed-topics", { allowed_topics: true }),
    "allowed topics should hide",
  );
});

test("manual dismiss writes localStorage key and hides on subsequent mount", () => {
  const storage = makeStorage();
  assert(
    !isLegacyBannerDismissed(storage, "tenant-a", "audience-persona"),
    "not dismissed before click",
  );
  persistLegacyBannerDismissal(storage, "tenant-a", "audience-persona");
  assert(
    isLegacyBannerDismissed(storage, "tenant-a", "audience-persona"),
    "dismissed after click",
  );
});

test("migrate success persists the same dismissal key used by reload checks", () => {
  const storage = makeStorage();
  persistLegacyBannerDismissal(storage, "tenant-a", "allowed-topics");
  assertEq(
    storage.getItem(
      getLegacyBannerDismissalKey("tenant-a", "allowed-topics"),
    ),
    "1",
    "dismissal key value",
  );
  assert(
    isLegacyBannerDismissed(storage, "tenant-a", "allowed-topics"),
    "reload check sees migrated surface as dismissed",
  );
});

// ─── CON-197 broadened auto-hide ───────────────────────────────

test("CON-197: any populated slice hides every banner surface", () => {
  // qualifying_questions populated → hide all three surfaces, including
  // allowed-topics where allowed_topics itself is empty.
  assert(
    shouldAutoHideLegacyBanner("widget-prompt", {
      qualifying_questions: true,
    }),
    "widget-prompt hides on qualifying_questions populated",
  );
  assert(
    shouldAutoHideLegacyBanner("audience-persona", {
      qualifying_questions: true,
    }),
    "audience-persona hides on qualifying_questions populated",
  );
  assert(
    shouldAutoHideLegacyBanner("allowed-topics", {
      qualifying_questions: true,
    }),
    "allowed-topics hides on qualifying_questions populated",
  );
});

test("CON-197: follow_up populated hides every banner surface", () => {
  for (const surface of [
    "widget-prompt",
    "audience-persona",
    "allowed-topics",
  ] as const) {
    assert(
      shouldAutoHideLegacyBanner(surface, { follow_up: true }),
      `${surface} hides on follow_up populated`,
    );
  }
});

test("CON-197: no slices populated → banner stays visible", () => {
  for (const surface of [
    "widget-prompt",
    "audience-persona",
    "allowed-topics",
  ] as const) {
    assertEq(
      shouldAutoHideLegacyBanner(surface, {}),
      false,
      `${surface} stays visible when nothing populated`,
    );
    assertEq(
      shouldAutoHideLegacyBanner(surface, undefined),
      false,
      `${surface} stays visible when populated info is undefined`,
    );
  }
});

test("CON-197: anyForumConfigSlicePopulated covers all four authoring slices", () => {
  assertEq(anyForumConfigSlicePopulated(undefined), false, "undefined → false");
  assertEq(anyForumConfigSlicePopulated({}), false, "empty → false");
  assertEq(
    anyForumConfigSlicePopulated({ ai_persona: true }),
    true,
    "ai_persona → true",
  );
  assertEq(
    anyForumConfigSlicePopulated({ qualifying_questions: true }),
    true,
    "qualifying_questions → true",
  );
  assertEq(
    anyForumConfigSlicePopulated({ allowed_topics: true }),
    true,
    "allowed_topics → true",
  );
  assertEq(
    anyForumConfigSlicePopulated({ follow_up: true }),
    true,
    "follow_up → true",
  );
});

// ─── CON-197 manual dismissal persistence paths ────────────────

test("CON-197: localStorage dismissal still works as the V1 fallback", () => {
  // Even with the server-side ui_state path wired in page.tsx, the banner
  // component must continue to honour a localStorage flag set on a previous
  // dismiss so the operator never sees the banner reappear after a refresh
  // if the server write was in flight.
  const storage = makeStorage();
  persistLegacyBannerDismissal(storage, "tenant-b", "audience-persona");
  assert(
    isLegacyBannerDismissed(storage, "tenant-b", "audience-persona"),
    "fallback dismissal persists across reload",
  );
  // Independent surfaces stay independent.
  assert(
    !isLegacyBannerDismissed(storage, "tenant-b", "allowed-topics"),
    "other surfaces are not implicitly dismissed",
  );
});

test("CON-197: dismissal keys are tenant-scoped", () => {
  const storage = makeStorage();
  persistLegacyBannerDismissal(storage, "tenant-a", "audience-persona");
  assert(
    !isLegacyBannerDismissed(storage, "tenant-b", "audience-persona"),
    "tenant b is unaffected by tenant a's dismissal",
  );
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
