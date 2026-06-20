#!/usr/bin/env node
/**
 * CON-192 — transform-legacy unit tests.
 *
 * tsx-runnable script, matches the repo's no-framework test convention.
 *
 *   npx tsx src/lib/forum-config/__tests__/transform-legacy.test.ts
 */
import {
  buildLegacyDraft,
  hasLegacySignal,
  isForumConfigEmpty,
  mergeLegacyIntoForumConfig,
} from "../transform-legacy";

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
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}

// ─── buildLegacyDraft ────────────────────────────────────────

test("buildLegacyDraft: empty settings → empty draft", () => {
  const d = buildLegacyDraft({});
  assertEq(d.ai_persona.voice_description, "", "voice empty");
  assertEq(d.welcome.copy, "", "welcome empty");
  assertEq(d.allowed_topics, [], "topics empty");
  assertEq(d.ai_persona.tone, "professional", "tone default");
  assertEq(d.ai_persona.locale, "en-AU", "locale default");
});

test("buildLegacyDraft: null / undefined / non-object → empty draft", () => {
  assertEq(buildLegacyDraft(null).ai_persona.voice_description, "", "null");
  assertEq(buildLegacyDraft(undefined).ai_persona.voice_description, "", "undef");
  assertEq(buildLegacyDraft("nope").ai_persona.voice_description, "", "string");
  assertEq(buildLegacyDraft(42).ai_persona.voice_description, "", "number");
});

test("buildLegacyDraft: widget.systemPrompt wins over audience persona", () => {
  const d = buildLegacyDraft({
    widget: { systemPrompt: "WIDGET PROMPT" },
    guardrails: { audiences: [{ persona: "AUDIENCE PROMPT" }] },
  });
  assertEq(d.ai_persona.voice_description, "WIDGET PROMPT", "widget wins");
});

test("buildLegacyDraft: falls back to first audience persona when widget empty", () => {
  const d = buildLegacyDraft({
    guardrails: { audiences: [{ persona: "Barry the farmer expert" }] },
  });
  assertEq(d.ai_persona.voice_description, "Barry the farmer expert", "fallback");
});

test("buildLegacyDraft: skips empty audience personas and picks first non-empty", () => {
  const d = buildLegacyDraft({
    guardrails: {
      audiences: [{ persona: "" }, { persona: "  " }, { persona: "Contractor" }],
    },
  });
  assertEq(d.ai_persona.voice_description, "Contractor", "skip-empty");
});

test("buildLegacyDraft: falls back to settings.persona then settings.systemPrompt", () => {
  const d1 = buildLegacyDraft({ persona: "Settings persona" });
  assertEq(d1.ai_persona.voice_description, "Settings persona", "persona");
  const d2 = buildLegacyDraft({ systemPrompt: "Settings systemPrompt" });
  assertEq(d2.ai_persona.voice_description, "Settings systemPrompt", "systemPrompt");
});

test("buildLegacyDraft: trims whitespace", () => {
  const d = buildLegacyDraft({ widget: { systemPrompt: "   hello   " } });
  assertEq(d.ai_persona.voice_description, "hello", "trim");
});

test("buildLegacyDraft: merges topics structured-first, deduped", () => {
  const d = buildLegacyDraft({
    guardrails: { topicBoundaries: { allow: ["farming", "irrigation"] } },
    widget: { allowedTopics: "irrigation, contractors, soil" },
  });
  assertEq(d.allowed_topics, ["farming", "irrigation", "contractors", "soil"], "merge");
});

test("buildLegacyDraft: topics case-insensitive dedupe", () => {
  const d = buildLegacyDraft({
    guardrails: { topicBoundaries: { allow: ["Farming"] } },
    widget: { allowedTopics: "farming, Soil" },
  });
  assertEq(d.allowed_topics, ["Farming", "Soil"], "ci-dedupe");
});

test("buildLegacyDraft: widget.allowedTopics as array also accepted", () => {
  const d = buildLegacyDraft({
    widget: { allowedTopics: ["a", "b", "c"] },
  });
  assertEq(d.allowed_topics, ["a", "b", "c"], "array form");
});

test("buildLegacyDraft: copies legacy widget welcome message", () => {
  const d = buildLegacyDraft({
    widget: { welcomeMessage: "  Welcome to Doggo  " },
  });
  assertEq(d.welcome.copy, "Welcome to Doggo", "welcome copy");
  assertEq(d.welcome.enabled, true, "welcome enabled");
  assertEq(d.welcome.show_with_questions, false, "default show_with_questions");
});

test("buildLegacyDraft: malformed audiences array ignored without throwing", () => {
  const d = buildLegacyDraft({
    guardrails: { audiences: "not an array" as unknown as never },
  });
  assertEq(d.ai_persona.voice_description, "", "no throw");
});

// ─── hasLegacySignal ─────────────────────────────────────────

test("hasLegacySignal: empty settings → false", () => {
  assert(!hasLegacySignal({}), "empty");
  assert(!hasLegacySignal(null), "null");
});

test("hasLegacySignal: voice only → true", () => {
  assert(hasLegacySignal({ widget: { systemPrompt: "hello" } }), "voice");
});

test("hasLegacySignal: topics only → true", () => {
  assert(
    hasLegacySignal({
      guardrails: { topicBoundaries: { allow: ["topic"] } },
    }),
    "topics",
  );
});

test("hasLegacySignal: widget.allowedTopics legacy string → true", () => {
  assert(hasLegacySignal({ widget: { allowedTopics: "a,b" } }), "string topics");
});

test("hasLegacySignal: welcome only → true", () => {
  assert(hasLegacySignal({ widget: { welcomeMessage: "hello" } }), "welcome");
});

// ─── isForumConfigEmpty ──────────────────────────────────────

test("isForumConfigEmpty: undefined / null → empty", () => {
  assert(isForumConfigEmpty(undefined), "undef");
  assert(isForumConfigEmpty(null), "null");
  assert(isForumConfigEmpty({}), "empty obj");
});

test("isForumConfigEmpty: only default tone/locale → still empty", () => {
  assert(
    isForumConfigEmpty({
      ai_persona: {
        tone: "friendly",
        locale: "en-AU",
        banned_words: [],
        voice_description: "",
      },
    }),
    "defaults only",
  );
});

test("isForumConfigEmpty: voice_description set → NOT empty", () => {
  assert(
    !isForumConfigEmpty({
      ai_persona: { voice_description: "I'm a friendly bot" },
    }),
    "voice set",
  );
});

test("isForumConfigEmpty: banned_words set → NOT empty", () => {
  assert(
    !isForumConfigEmpty({
      ai_persona: { banned_words: ["foo"] },
    }),
    "banned",
  );
});

test("isForumConfigEmpty: allowed_topics set → NOT empty", () => {
  assert(!isForumConfigEmpty({ allowed_topics: ["x"] }), "topics");
});

test("isForumConfigEmpty: welcome copy set → NOT empty", () => {
  assert(!isForumConfigEmpty({ welcome: { copy: "hello" } }), "welcome");
});

test("isForumConfigEmpty: qualifying_questions.preset set → NOT empty", () => {
  assert(
    !isForumConfigEmpty({
      qualifying_questions: {
        preset: { question: "Q", options: [], persona_field: "f" },
      },
    }),
    "preset",
  );
});

test("isForumConfigEmpty: qualifying additional set → NOT empty", () => {
  assert(
    !isForumConfigEmpty({
      qualifying_questions: {
        additional: [{ question: "Q", options: [], persona_field: "f" }],
      },
    }),
    "additional",
  );
});

test("isForumConfigEmpty: follow_up set → NOT empty", () => {
  assert(
    !isForumConfigEmpty({ follow_up: { rules: [] } }),
    "follow_up",
  );
});

// ─── mergeLegacyIntoForumConfig ──────────────────────────────

test("mergeLegacyIntoForumConfig: empty existing → returns legacy slices", () => {
  const legacy = {
    ai_persona: {
      tone: "professional" as const,
      locale: "en-AU",
      banned_words: [],
      voice_description: "Barry",
    },
    welcome: {
      copy: "Welcome",
      enabled: true,
      show_with_questions: false,
    },
    allowed_topics: ["farming"],
  };
  const merged = mergeLegacyIntoForumConfig({}, legacy);
  const persona = merged.ai_persona as Record<string, unknown>;
  assertEq(persona.voice_description, "Barry", "voice");
  const welcome = merged.welcome as Record<string, unknown>;
  assertEq(welcome.copy, "Welcome", "welcome");
  assertEq(merged.allowed_topics, ["farming"], "topics");
});

test("mergeLegacyIntoForumConfig: existing voice preserved (no clobber)", () => {
  const legacy = {
    ai_persona: {
      tone: "professional" as const,
      locale: "en-AU",
      banned_words: [],
      voice_description: "LEGACY",
    },
    welcome: {
      copy: "",
      enabled: true,
      show_with_questions: false,
    },
    allowed_topics: [],
  };
  const merged = mergeLegacyIntoForumConfig(
    { ai_persona: { voice_description: "EXISTING" } },
    legacy,
  );
  const persona = merged.ai_persona as Record<string, unknown>;
  assertEq(persona.voice_description, "EXISTING", "no clobber");
});

test("mergeLegacyIntoForumConfig: topics unioned, existing-first, deduped", () => {
  const legacy = {
    ai_persona: {
      tone: "professional" as const,
      locale: "en-AU",
      banned_words: [],
      voice_description: "",
    },
    welcome: {
      copy: "",
      enabled: true,
      show_with_questions: false,
    },
    allowed_topics: ["farming", "irrigation"],
  };
  const merged = mergeLegacyIntoForumConfig(
    { allowed_topics: ["irrigation", "soil"] },
    legacy,
  );
  assertEq(merged.allowed_topics, ["irrigation", "soil", "farming"], "union");
});

test("mergeLegacyIntoForumConfig: preserves unrelated forumConfig slices", () => {
  const legacy = {
    ai_persona: {
      tone: "professional" as const,
      locale: "en-AU",
      banned_words: [],
      voice_description: "Barry",
    },
    welcome: {
      copy: "",
      enabled: true,
      show_with_questions: false,
    },
    allowed_topics: [],
  };
  const existing = {
    cta_rules: [{ tag: "x", text: "y", url: "https://a", default: true }],
    schema_version: 1,
  };
  const merged = mergeLegacyIntoForumConfig(existing, legacy);
  assertEq(merged.cta_rules, existing.cta_rules, "cta preserved");
  assertEq(merged.schema_version, 1, "version preserved");
});

test("mergeLegacyIntoForumConfig: existing welcome preserved", () => {
  const legacy = {
    ai_persona: {
      tone: "professional" as const,
      locale: "en-AU",
      banned_words: [],
      voice_description: "",
    },
    welcome: {
      copy: "LEGACY",
      enabled: true,
      show_with_questions: false,
    },
    allowed_topics: [],
  };
  const merged = mergeLegacyIntoForumConfig(
    { welcome: { copy: "EXISTING", enabled: true, show_with_questions: true } },
    legacy,
  );
  const welcome = merged.welcome as Record<string, unknown>;
  assertEq(welcome.copy, "EXISTING", "no clobber");
  assertEq(welcome.show_with_questions, true, "override preserved");
});

// ─── Summary ─────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
