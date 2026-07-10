/**
 * CON-253 — widget-config starter prompt fallback.
 *
 * Legacy tenants created before CON-252 can have
 * settings.forumConfig.starter_prompts = []. The public widget config
 * should treat that as unset and return DEFAULT_STARTER_PROMPTS so the
 * closed-bubble pills render without a DB backfill.
 *
 * Run with:
 *   npx tsx --test src/lib/widget/__tests__/starter-prompts.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_STARTER_PROMPTS } from "../../forum-config/defaults";
import { resolveWidgetStarterPrompts } from "../starter-prompts";

test("resolveWidgetStarterPrompts falls back when starter_prompts is missing", () => {
  assert.deepEqual(
    resolveWidgetStarterPrompts({ forumConfig: {} }),
    DEFAULT_STARTER_PROMPTS,
  );
});

test("resolveWidgetStarterPrompts falls back when starter_prompts is empty", () => {
  assert.deepEqual(
    resolveWidgetStarterPrompts({
      forumConfig: {
        starter_prompts: [],
      },
    }),
    DEFAULT_STARTER_PROMPTS,
  );
});

test("resolveWidgetStarterPrompts preserves a non-empty custom slice", () => {
  const custom = [
    {
      emoji: "🐾",
      label: "Book a walk",
      prompt: "I want to book a dog walk.",
    },
  ];

  assert.deepEqual(
    resolveWidgetStarterPrompts({
      forumConfig: {
        starter_prompts: custom,
      },
    }),
    custom,
  );
});
