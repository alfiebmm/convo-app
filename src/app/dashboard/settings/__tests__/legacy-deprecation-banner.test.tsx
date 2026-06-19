#!/usr/bin/env node
import {
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

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
