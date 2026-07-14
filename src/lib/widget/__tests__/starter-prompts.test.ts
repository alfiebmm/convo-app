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

test("resolveWidgetStarterPrompts preserves lead_capture and custom_embed action blocks", () => {
  const custom = [
    {
      emoji: "✉️",
      label: "Get in touch",
      prompt: "How do I get in touch?",
      action: {
        type: "lead_capture" as const,
        capture_policy: {
          id: "starter_pill_get_in_touch",
          case_type: "lead" as const,
          required_fields: ["name", "email"],
          optional_fields: ["mobile"],
          privacy_notice:
            "We use your details only to follow up on your enquiry.",
          privacy_policy_url: "https://example.com/privacy",
        },
        field_label_overrides: {
          email: "Work email",
        },
      },
    },
    {
      emoji: "📅",
      label: "Book",
      prompt: "I want to book.",
      action: {
        type: "custom_embed" as const,
        kind: "iframe" as const,
        url: "https://example.com/book",
        height: 640,
        allow: "camera",
      },
    },
  ];

  const resolved = resolveWidgetStarterPrompts({
    forumConfig: {
      starter_prompts: custom,
    },
  });
  assert.deepEqual(resolved, custom);
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

test("starter prompt schema round-trips lead_capture, custom_embed, and booking_form actions", () => {
  const prompts = [
    DEFAULT_STARTER_PROMPTS.find((p) => p.label === "Get in touch"),
    {
      emoji: "🧾",
      label: "Quote",
      prompt: "I want a quote.",
      action: {
        type: "custom_embed" as const,
        kind: "iframe" as const,
        url: "https://example.com/embed",
        allow: "payment",
      },
    },
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
  assert.equal(parsed.data[1].action?.type, "custom_embed");
  assert.equal(parsed.data[1].action?.height, 520);
  assert.equal(parsed.data[2].action?.type, "booking_form");
});

test("starter prompt schema rejects unsafe custom_embed URLs", () => {
  const base = {
    emoji: "🧾",
    label: "Quote",
    prompt: "I want a quote.",
  };

  for (const url of [
    "javascript:alert(1)",
    "data:text/html,hello",
    "http://example.com/embed",
  ]) {
    const parsed = starterPromptsSchema.safeParse([
      {
        ...base,
        action: { type: "custom_embed", kind: "iframe", url },
      },
    ]);
    assert.equal(parsed.success, false);
  }

  const local = starterPromptsSchema.safeParse([
    {
      ...base,
      action: {
        type: "custom_embed",
        kind: "iframe",
        url: "http://localhost:3000/embed",
      },
    },
  ]);
  assert.equal(local.success, true);
});
