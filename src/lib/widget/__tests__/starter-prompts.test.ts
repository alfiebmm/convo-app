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
import { starterPromptsSchema } from "../../forum-config/schema";
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

test("starter prompt schema accepts legacy chat pills without action", () => {
  const parsed = starterPromptsSchema.safeParse([
    {
      emoji: "💬",
      label: "Ask a question",
      prompt: "I have a question.",
    },
  ]);

  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.equal(parsed.data[0].action, undefined);
});

test("starter prompt schema round-trips lead_capture and booking_form actions", () => {
  const prompts = [
    DEFAULT_STARTER_PROMPTS.find((p) => p.label === "Get in touch"),
    {
      emoji: "📅",
      label: "Book",
      prompt: "I want to book.",
      action: { type: "booking_form" as const },
    },
  ];

  const parsed = starterPromptsSchema.safeParse(prompts);
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.equal(parsed.data[0].action?.type, "lead_capture");
  assert.equal(parsed.data[1].action?.type, "booking_form");
});
