/**
 * CON-201 — per-slice parse tests.
 *
 * Validates the new `parseForumConfigPerSlice` helper and the
 * `.prefault({})` + field-level defaults wrapping on the root schema.
 *
 * P0 production scenario: AgPages tenant config contains ONLY the
 * authoring slices the dashboard writes (`ai_persona`,
 * `qualifying_questions`, `allowed_topics`, `follow_up`). The old
 * `parseForumConfigSafe` returned DEFAULT_FORUM_CONFIG wholesale because
 * `seo_defaults` was missing, silently wiping their qualifying_questions
 * and voice_description.
 *
 * Run with: npx tsx --test src/lib/forum-config/__tests__/per-slice-parse.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parseForumConfigPerSlice,
  parseForumConfigSafe,
} from "../validate";
import { forumConfigSchema } from "../schema";
import { DEFAULT_FORUM_CONFIG } from "../defaults";

// ─── Root schema relaxation (Option C) ──────────────────────────

test("forumConfigSchema parses {} successfully (CON-201 Option C)", () => {
  const result = forumConfigSchema.safeParse({});
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.ai_persona.tone, "friendly");
    assert.equal(result.data.ai_persona.locale, "en-AU");
    assert.equal(result.data.seo_defaults.schema_org_type, "Article");
    assert.deepEqual(result.data.cta_rules, []);
  }
});

test("forumConfigSchema parses a partial ai_persona slice without tone", () => {
  // Only voice_description provided — tone field default should kick in.
  const result = forumConfigSchema.safeParse({
    ai_persona: { voice_description: "AgPages-style voice" },
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.ai_persona.tone, "friendly");
    assert.equal(
      result.data.ai_persona.voice_description,
      "AgPages-style voice",
    );
  }
});

test("forumConfigSchema parses successfully without seo_defaults present", () => {
  // The AgPages production shape: only the four authoring slices, no
  // seo_defaults. Before CON-201 this failed strict root parse.
  const result = forumConfigSchema.safeParse({
    ai_persona: { tone: "expert", voice_description: "v" },
    qualifying_questions: {
      preset: {
        question: "What can we help with?",
        options: [{ label: "Pricing", value: "pricing" }],
        persona_field: "intent",
      },
      additional: [],
    },
    allowed_topics: ["pricing"],
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.seo_defaults.schema_org_type, "Article");
    assert.equal(result.data.qualifying_questions.preset?.question, "What can we help with?");
  }
});

// ─── parseForumConfigPerSlice (Option A) ──────────────────────

test("parseForumConfigPerSlice: null/undefined → DEFAULT_FORUM_CONFIG", () => {
  assert.deepEqual(parseForumConfigPerSlice(null), DEFAULT_FORUM_CONFIG);
  assert.deepEqual(parseForumConfigPerSlice(undefined), DEFAULT_FORUM_CONFIG);
  assert.deepEqual(parseForumConfigPerSlice("nope"), DEFAULT_FORUM_CONFIG);
  assert.deepEqual(parseForumConfigPerSlice([1, 2]), DEFAULT_FORUM_CONFIG);
});

test("parseForumConfigPerSlice: empty object → every slice = DEFAULT slice", () => {
  // Absent slices should fall back to Convo's rich seeded defaults
  // (not the bare Zod field-level defaults), preserving the existing
  // contract for tenants who haven't written a slice yet.
  const result = parseForumConfigPerSlice({});
  assert.deepEqual(result, DEFAULT_FORUM_CONFIG);
});

test("parseForumConfigPerSlice: qualifying_questions-only config preserves tenant's questions (AC #1, AgPages live bug)", () => {
  const tenantConfig = {
    qualifying_questions: {
      preset: {
        question: "What stage are you at?",
        options: [
          { label: "Just exploring", value: "explore" },
          { label: "Ready to buy", value: "buy" },
        ],
        persona_field: "stage",
      },
      additional: [],
    },
  };
  const result = parseForumConfigPerSlice(tenantConfig);

  // Tenant's questions survive.
  assert.equal(result.qualifying_questions.preset?.question, "What stage are you at?");
  assert.equal(result.qualifying_questions.preset?.options.length, 2);
  assert.equal(result.qualifying_questions.preset?.options[0].value, "explore");

  // Other slices fall back to DEFAULT_FORUM_CONFIG.
  assert.deepEqual(result.ai_persona, DEFAULT_FORUM_CONFIG.ai_persona);
  assert.deepEqual(result.cta_rules, DEFAULT_FORUM_CONFIG.cta_rules);
  assert.deepEqual(result.allowed_topics, DEFAULT_FORUM_CONFIG.allowed_topics);

  // Critically: the GENERIC "I have a question" preset MUST NOT replace
  // the tenant's preset.
  assert.notEqual(
    result.qualifying_questions.preset?.question,
    DEFAULT_FORUM_CONFIG.qualifying_questions.preset?.question,
  );
});

test("parseForumConfigPerSlice: ai_persona-only config preserves voice_description (AC #2, CON-199 fix)", () => {
  const tenantConfig = {
    ai_persona: { tone: "expert", voice_description: "blah" },
  };
  const result = parseForumConfigPerSlice(tenantConfig);

  assert.equal(result.ai_persona.tone, "expert");
  assert.equal(result.ai_persona.voice_description, "blah");
  // Field-level defaults fill missing fields.
  assert.equal(result.ai_persona.locale, "en-AU");
  assert.deepEqual(result.ai_persona.banned_words, []);
});

test("parseForumConfigPerSlice: cta_rules-only config preserves tenant's rules (AC #3)", () => {
  const tenantConfig = {
    cta_rules: [
      {
        tag: "pricing",
        text: "View pricing",
        url: "https://example.org/pricing",
        default: true,
      },
    ],
  };
  const result = parseForumConfigPerSlice(tenantConfig);

  assert.equal(result.cta_rules.length, 1);
  assert.equal(result.cta_rules[0].tag, "pricing");
  assert.equal(result.cta_rules[0].url, "https://example.org/pricing");

  // Other slices fall back to DEFAULT.
  assert.deepEqual(result.ai_persona, DEFAULT_FORUM_CONFIG.ai_persona);
});

test("parseForumConfigPerSlice: fully populated config round-trips (AC #4 — no behaviour change)", () => {
  // Identical to DEFAULT_FORUM_CONFIG should parse to an equal object.
  const result = parseForumConfigPerSlice(DEFAULT_FORUM_CONFIG);
  assert.deepEqual(result, DEFAULT_FORUM_CONFIG);
});

test("parseForumConfigPerSlice: empty config → all slices use defaults (AC #5)", () => {
  const result = parseForumConfigPerSlice({});
  assert.deepEqual(result, DEFAULT_FORUM_CONFIG);
});

test("parseForumConfigPerSlice: malformed slice falls back independently", () => {
  // Tenant config with one bad slice (`cta_rules` is not an array) — that
  // slice falls back to DEFAULT, the others survive.
  const tenantConfig = {
    ai_persona: { tone: "expert", voice_description: "kept" },
    cta_rules: "this is not an array of rules",
  };
  const result = parseForumConfigPerSlice(tenantConfig);

  assert.equal(result.ai_persona.voice_description, "kept");
  assert.deepEqual(result.cta_rules, DEFAULT_FORUM_CONFIG.cta_rules);
});

test("parseForumConfigPerSlice: garbage schema_version normalises to 1", () => {
  const result = parseForumConfigPerSlice({ schema_version: "not a number" });
  assert.equal(result.schema_version, 1);
});

// ─── Backwards compatibility: parseForumConfigSafe still works ──

test("parseForumConfigSafe still falls back to the supplied default on bad root parse", () => {
  // Even though the root schema is now permissive, a flagrantly bad input
  // (a string) should still return the fallback. parseForumConfigSafe
  // keeps its compat semantics.
  const result = parseForumConfigSafe("nope" as unknown, DEFAULT_FORUM_CONFIG);
  assert.deepEqual(result, DEFAULT_FORUM_CONFIG);
});

test("parseForumConfigSafe: empty config now succeeds via .prefault root", () => {
  // CON-201 side-effect: the root schema no longer rejects {}, so
  // parseForumConfigSafe now parses it instead of falling back. Slices
  // populate via field-level defaults; absent slices use the bare schema
  // defaults (NOT DEFAULT_FORUM_CONFIG seed values — that's the whole
  // point of parseForumConfigPerSlice).
  const result = parseForumConfigSafe({}, DEFAULT_FORUM_CONFIG);
  assert.equal(result.ai_persona.tone, "friendly");
  assert.equal(result.ai_persona.voice_description, "");
});
