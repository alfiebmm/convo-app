/**
 * Tests for the qualifying-question resolver (CON-94).
 *
 * Run with: `npx tsx --test src/lib/qualifying/__tests__/resolve.test.ts`
 *
 * Uses Node's built-in test runner (no jest dependency needed).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getConfiguredQuestions,
  getNextQuestion,
  isQualifyingComplete,
  formatPersonaForPrompt,
} from "../resolve";
import type { ConversationQualifying } from "../types";

test("getConfiguredQuestions returns defaults when settings empty", () => {
  const qs = getConfiguredQuestions({});
  // Defaults ship a single preset question with 4 options.
  assert.equal(qs.length, 1);
  assert.equal(qs[0].field, "visitor_intent");
  assert.equal(qs[0].options.length, 4);
});

test("getConfiguredQuestions returns ordered preset + additional", () => {
  const settings = {
    forumConfig: {
      schema_version: 1,
      ai_persona: {
        tone: "professional",
        locale: "en-AU",
        banned_words: [],
        voice_description: "",
      },
      cta_rules: [],
      qualifying_questions: {
        preset: {
          question: "Are you a farmer or contractor?",
          options: [
            { label: "Farmer", value: "farmer" },
            { label: "Contractor", value: "contractor" },
          ],
          persona_field: "role",
        },
        additional: [
          {
            question: "Property size?",
            options: [
              { label: "Small", value: "small" },
              { label: "Large", value: "large" },
            ],
            persona_field: "property_size",
          },
        ],
      },
      allowed_topics: [],
      exclusion_list: [],
      seo_defaults: {
        title_template: "{topic}",
        meta_template: "{topic}",
        schema_org_type: "Article",
      },
    },
  };
  const qs = getConfiguredQuestions(settings);
  assert.equal(qs.length, 2);
  assert.equal(qs[0].field, "role");
  assert.equal(qs[1].field, "property_size");
});

test("getNextQuestion returns first unanswered question", () => {
  const configured = [
    { field: "role", question: "Q1", options: [{ label: "A", value: "a" }] },
    { field: "size", question: "Q2", options: [{ label: "B", value: "b" }] },
  ];
  const state: ConversationQualifying = {
    answers: [
      {
        field: "role",
        value: "a",
        question: "Q1",
        answeredAt: "2026-05-31T00:00:00Z",
      },
    ],
    persona: { role: "a" },
  };
  const next = getNextQuestion(configured, state);
  assert.equal(next?.field, "size");
});

test("getNextQuestion returns null when all answered", () => {
  const configured = [
    { field: "role", question: "Q1", options: [{ label: "A", value: "a" }] },
  ];
  const state: ConversationQualifying = {
    answers: [
      {
        field: "role",
        value: "a",
        question: "Q1",
        answeredAt: "2026-05-31T00:00:00Z",
      },
    ],
    persona: { role: "a" },
  };
  assert.equal(getNextQuestion(configured, state), null);
});

test("getNextQuestion returns null when flow skipped", () => {
  const configured = [
    { field: "role", question: "Q1", options: [{ label: "A", value: "a" }] },
  ];
  const state: ConversationQualifying = {
    answers: [],
    persona: {},
    skipped: true,
  };
  assert.equal(getNextQuestion(configured, state), null);
});

test("getNextQuestion returns first question when no state", () => {
  const configured = [
    { field: "role", question: "Q1", options: [{ label: "A", value: "a" }] },
  ];
  const next = getNextQuestion(configured, null);
  assert.equal(next?.field, "role");
});

test("isQualifyingComplete: true when no questions configured", () => {
  assert.equal(isQualifyingComplete([], null), true);
});

test("isQualifyingComplete: true when skipped", () => {
  const configured = [
    { field: "role", question: "Q1", options: [{ label: "A", value: "a" }] },
  ];
  assert.equal(
    isQualifyingComplete(configured, {
      answers: [],
      persona: {},
      skipped: true,
    }),
    true
  );
});

test("isQualifyingComplete: false when questions remain", () => {
  const configured = [
    { field: "role", question: "Q1", options: [{ label: "A", value: "a" }] },
  ];
  assert.equal(isQualifyingComplete(configured, null), false);
});

test("formatPersonaForPrompt returns empty when no answers", () => {
  assert.equal(formatPersonaForPrompt(null), "");
  assert.equal(formatPersonaForPrompt({ answers: [], persona: {} }), "");
});

test("formatPersonaForPrompt builds structured section from persona", () => {
  const result = formatPersonaForPrompt({
    answers: [],
    persona: { role: "farmer", property_size: "large" },
  });
  assert.ok(result.includes("# Visitor Context"));
  assert.ok(result.includes("role: farmer"));
  assert.ok(result.includes("property_size: large"));
  // Critical: must instruct the model not to re-ask.
  assert.ok(result.toLowerCase().includes("not re-ask"));
});
