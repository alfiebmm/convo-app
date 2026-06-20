#!/usr/bin/env node
/**
 * CON-207 — widget welcome default UX rule.
 *
 * Run with:
 *   npx tsx src/lib/widget/__tests__/welcome.test.ts
 */
import {
  hasStoredQualifyingQuestions,
  resolvePublicWelcomeConfig,
  shouldShowWelcomeOnOpen,
} from "../welcome";

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

test("resolvePublicWelcomeConfig prefers forumConfig.welcome over widget fallback", () => {
  const welcome = resolvePublicWelcomeConfig(
    {
      forumConfig: {
        welcome: {
          copy: "Forum welcome",
          enabled: true,
          show_with_questions: false,
        },
      },
    },
    { welcomeMessage: "Legacy welcome" },
  );
  assertEq(welcome.copy, "Forum welcome", "copy");
});

test("resolvePublicWelcomeConfig falls back to widget welcomeMessage", () => {
  const welcome = resolvePublicWelcomeConfig({}, { welcomeMessage: "Legacy welcome" });
  assertEq(welcome.copy, "Legacy welcome", "copy");
  assertEq(welcome.enabled, true, "enabled");
});

test("qualifying questions count as populated only when stored by tenant", () => {
  assert(!hasStoredQualifyingQuestions({ forumConfig: {} }), "empty");
  assert(
    hasStoredQualifyingQuestions({
      forumConfig: {
        qualifying_questions: {
          preset: {
            question: "What do you need?",
            options: [{ label: "Advice", value: "advice" }],
            persona_field: "intent",
          },
          additional: [],
        },
      },
    }),
    "preset",
  );
});

test("welcome shows when there are no stored qualifying questions", () => {
  assert(
    shouldShowWelcomeOnOpen(
      { copy: "Hi", enabled: true, show_with_questions: false },
      false,
    ),
    "show welcome",
  );
});

test("welcome is suppressed by qualifying questions by default", () => {
  assert(
    !shouldShowWelcomeOnOpen(
      { copy: "Hi", enabled: true, show_with_questions: false },
      true,
    ),
    "suppress welcome",
  );
});

test("show_with_questions override shows both", () => {
  assert(
    shouldShowWelcomeOnOpen(
      { copy: "Hi", enabled: true, show_with_questions: true },
      true,
    ),
    "show both",
  );
});

test("disabled welcome never shows", () => {
  assert(
    !shouldShowWelcomeOnOpen(
      { copy: "Hi", enabled: false, show_with_questions: true },
      false,
    ),
    "disabled",
  );
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
