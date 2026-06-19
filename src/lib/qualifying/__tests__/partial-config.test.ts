/**
 * CON-201 — qualifying resolver partial-config matrix.
 *
 * Reproduces the live AgPages production bug: tenant's
 * `forumConfig.qualifying_questions` was being silently replaced by the
 * GENERIC "I have a question / I need advice / I'm looking for a service /
 * Just browsing" preset because the strict root parse failed on the missing
 * `seo_defaults` slice and `parseForumConfigSafe` returned
 * DEFAULT_FORUM_CONFIG wholesale.
 *
 * Run with: npx tsx --test src/lib/qualifying/__tests__/partial-config.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { getConfiguredQuestions } from "../resolve";
import { DEFAULT_FORUM_CONFIG } from "@/lib/forum-config/defaults";

// AgPages-style tenant: only the authoring slices the editor writes
// (ai_persona, qualifying_questions, allowed_topics, follow_up). No
// seo_defaults, no cta_rules.
const agPagesLikeConfig = {
  ai_persona: {
    tone: "expert" as const,
    voice_description: "AgPages agronomy voice",
  },
  qualifying_questions: {
    preset: {
      question: "What are you growing?",
      options: [
        { label: "Wheat", value: "wheat" },
        { label: "Canola", value: "canola" },
        { label: "Pulses", value: "pulses" },
      ],
      persona_field: "crop",
    },
    additional: [],
  },
  allowed_topics: ["agronomy", "crop protection"],
};

test("AgPages-style partial config: tenant's qualifying_questions surface, NOT the generic default", () => {
  const settings = { forumConfig: agPagesLikeConfig };
  const questions = getConfiguredQuestions(settings);

  assert.equal(questions.length, 1, "exactly one preset question");
  assert.equal(questions[0].question, "What are you growing?");
  assert.deepEqual(
    questions[0].options.map((o) => o.value),
    ["wheat", "canola", "pulses"],
  );

  // Hard guard against regression: the generic default options must NOT
  // be what the visitor sees.
  const optionValues = questions[0].options.map((o) => o.value);
  for (const generic of ["question", "advice", "service", "browsing"]) {
    assert.ok(
      !optionValues.includes(generic),
      `regression: generic default option "${generic}" leaked through`,
    );
  }
});

test("ai_persona-only config: qualifying flow falls back to default preset", () => {
  const settings = {
    forumConfig: {
      ai_persona: { tone: "friendly" as const, voice_description: "v" },
    },
  };
  const questions = getConfiguredQuestions(settings);
  assert.equal(questions.length, 1);
  assert.equal(
    questions[0].question,
    DEFAULT_FORUM_CONFIG.qualifying_questions.preset?.question,
  );
});

test("empty forumConfig: falls back to default preset", () => {
  const questions = getConfiguredQuestions({ forumConfig: {} });
  assert.equal(questions.length, 1);
  assert.equal(
    questions[0].question,
    DEFAULT_FORUM_CONFIG.qualifying_questions.preset?.question,
  );
});

test("missing forumConfig: falls back to default preset", () => {
  const questions = getConfiguredQuestions({});
  assert.equal(questions.length, 1);
  assert.equal(
    questions[0].question,
    DEFAULT_FORUM_CONFIG.qualifying_questions.preset?.question,
  );
});

test("null settings: falls back to default preset", () => {
  const questions = getConfiguredQuestions(null);
  assert.equal(questions.length, 1);
});

test("fully populated config: questions come through unchanged", () => {
  const settings = { forumConfig: DEFAULT_FORUM_CONFIG };
  const questions = getConfiguredQuestions(settings);
  assert.equal(questions.length, 1);
  assert.equal(
    questions[0].question,
    DEFAULT_FORUM_CONFIG.qualifying_questions.preset?.question,
  );
});

test("qualifying_questions with additional questions: order preserved (preset first)", () => {
  const settings = {
    forumConfig: {
      qualifying_questions: {
        preset: {
          question: "Preset?",
          options: [{ label: "A", value: "a" }],
          persona_field: "p",
        },
        additional: [
          {
            question: "Additional?",
            options: [{ label: "B", value: "b" }],
            persona_field: "a",
          },
        ],
      },
    },
  };
  const questions = getConfiguredQuestions(settings);
  assert.equal(questions.length, 2);
  assert.equal(questions[0].question, "Preset?");
  assert.equal(questions[1].question, "Additional?");
});
