/**
 * CON-252 — starter_prompts defaults tests.
 *
 * Layer 1: the `.prefault` cascade on `forumConfigSchema.starter_prompts`
 * populates DEFAULT_STARTER_PROMPTS when the slice is absent from the
 * source object. Existing tenants (Doggo, AgPages) whose settings blob
 * has no `starter_prompts` field will see the defaults render on the
 * closed-bubble widget surface without any DB backfill.
 *
 * Layer 2 (tenant.ts createTenant seeder) is covered separately.
 *
 * Run with:
 *   npx tsx --test src/lib/forum-config/__tests__/starter-prompts.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  forumConfigSchema,
  pillActionCustomEmbedSchema,
  starterPromptsSchema,
  starterPromptSchema,
} from "../schema";
import { DEFAULT_STARTER_PROMPTS, DEFAULT_FORUM_CONFIG } from "../defaults";
import { parseForumConfigPerSlice } from "../validate";

// ─── Default array shape ────────────────────────────────────────

test("DEFAULT_STARTER_PROMPTS contains three well-formed entries", () => {
  assert.equal(DEFAULT_STARTER_PROMPTS.length, 3);
  for (const p of DEFAULT_STARTER_PROMPTS) {
    assert.ok(p.emoji.length >= 1);
    assert.ok(p.label.length >= 1);
    assert.ok(p.prompt.length >= 1);
    // Each entry parses through the per-item schema cleanly.
    const parsed = starterPromptSchema.safeParse(p);
    assert.equal(parsed.success, true);
  }
});

test("DEFAULT_STARTER_PROMPTS opener set matches the CON-252 spec", () => {
  const labels = DEFAULT_STARTER_PROMPTS.map((p) => p.label);
  assert.deepEqual(labels, ["Ask a question", "Get help", "Get in touch"]);
});

// ─── Layer 1: `.prefault` cascade ───────────────────────────────

test("forumConfigSchema parses {} and populates starter_prompts with defaults", () => {
  const result = forumConfigSchema.safeParse({});
  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data.starter_prompts, DEFAULT_STARTER_PROMPTS);
  }
});

test("forumConfigSchema parses forumConfig with an unrelated slice and still fills starter_prompts", () => {
  const result = forumConfigSchema.safeParse({
    ai_persona: { voice_description: "AgPages voice" },
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data.starter_prompts, DEFAULT_STARTER_PROMPTS);
  }
});

test("forumConfigSchema respects an explicit starter_prompts override", () => {
  const custom = [
    { emoji: "🐾", label: "Book a walk", prompt: "I want to book a dog walk." },
  ];
  const result = forumConfigSchema.safeParse({ starter_prompts: custom });
  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data.starter_prompts, custom);
  }
});

test("forumConfigSchema respects an explicit empty starter_prompts array", () => {
  // Tenant deliberately turning off pills should NOT trip the prefault.
  const result = forumConfigSchema.safeParse({ starter_prompts: [] });
  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data.starter_prompts, []);
  }
});

// ─── Validator symmetry ─────────────────────────────────────────

test("parseForumConfigPerSlice returns DEFAULT_STARTER_PROMPTS when the slice is absent", () => {
  const result = parseForumConfigPerSlice({
    ai_persona: { voice_description: "AgPages voice" },
  });
  assert.deepEqual(result.starter_prompts, DEFAULT_STARTER_PROMPTS);
});

test("parseForumConfigPerSlice preserves a valid custom starter_prompts slice", () => {
  const custom = [
    { emoji: "🐾", label: "Book a walk", prompt: "I want to book a dog walk." },
    { emoji: "📅", label: "Availability", prompt: "When are you available?" },
  ];
  const result = parseForumConfigPerSlice({ starter_prompts: custom });
  assert.deepEqual(result.starter_prompts, custom);
});

test("parseForumConfigPerSlice falls back to defaults on invalid starter_prompts", () => {
  // A malformed entry (missing `prompt`) should reject the slice as a whole
  // and fall back to DEFAULT_STARTER_PROMPTS rather than nuking the config.
  const result = parseForumConfigPerSlice({
    starter_prompts: [{ emoji: "❓", label: "Broken" } as unknown],
  });
  assert.deepEqual(result.starter_prompts, DEFAULT_STARTER_PROMPTS);
});

// ─── starterPromptsSchema direct ────────────────────────────────

test("starterPromptsSchema enforces the max-4 cap", () => {
  const five = Array.from({ length: 5 }, (_, i) => ({
    emoji: "💬",
    label: `Prompt ${i}`,
    prompt: `Prompt body ${i}`,
  }));
  const result = starterPromptsSchema.safeParse(five);
  assert.equal(result.success, false);
});

test("starterPromptsSchema rejects entries with empty fields", () => {
  const bad = [{ emoji: "", label: "x", prompt: "y" }];
  const result = starterPromptsSchema.safeParse(bad);
  assert.equal(result.success, false);
});

test("pillActionCustomEmbedSchema defaults height and validates bounds", () => {
  const parsed = pillActionCustomEmbedSchema.safeParse({
    type: "custom_embed",
    kind: "iframe",
    url: "https://example.com/form",
  });
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.equal(parsed.data.height, 520);

  assert.equal(
    pillActionCustomEmbedSchema.safeParse({
      type: "custom_embed",
      kind: "iframe",
      url: "https://example.com/form",
      height: 239,
    }).success,
    false,
  );
  assert.equal(
    pillActionCustomEmbedSchema.safeParse({
      type: "custom_embed",
      kind: "iframe",
      url: "https://example.com/form",
      height: 901,
    }).success,
    false,
  );
});

test("pillActionCustomEmbedSchema rejects non-https URLs except localhost dev", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,hello",
    "http://example.com/form",
  ]) {
    assert.equal(
      pillActionCustomEmbedSchema.safeParse({
        type: "custom_embed",
        kind: "iframe",
        url,
      }).success,
      false,
    );
  }

  assert.equal(
    pillActionCustomEmbedSchema.safeParse({
      type: "custom_embed",
      kind: "iframe",
      url: "http://127.0.0.1:3000/form",
    }).success,
    true,
  );
});

// ─── DEFAULT_FORUM_CONFIG parity ────────────────────────────────

test("DEFAULT_FORUM_CONFIG.starter_prompts matches DEFAULT_STARTER_PROMPTS", () => {
  assert.deepEqual(
    DEFAULT_FORUM_CONFIG.starter_prompts,
    DEFAULT_STARTER_PROMPTS,
  );
});
