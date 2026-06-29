import { test } from "node:test";
import assert from "node:assert/strict";

import { assertForumConfigCompleteness } from "../completeness";

test("assertForumConfigCompleteness returns complete for all four slices", () => {
  assert.deepEqual(
    assertForumConfigCompleteness({
      settings: {
        forumConfig: {
          follow_up: {},
          ai_persona: {},
          qualifying_questions: {},
          allowed_topics: [],
        },
      },
    }),
    { complete: true },
  );
});

test("assertForumConfigCompleteness reports missing slices for partial config", () => {
  assert.deepEqual(
    assertForumConfigCompleteness({
      settings: {
        forumConfig: {
          follow_up: {},
          allowed_topics: [],
        },
      },
    }),
    {
      complete: false,
      missing: ["ai_persona", "qualifying_questions"],
    },
  );
});

test("assertForumConfigCompleteness reports all slices missing when absent", () => {
  assert.deepEqual(assertForumConfigCompleteness({ settings: {} }), {
    complete: false,
    missing: [
      "follow_up",
      "ai_persona",
      "qualifying_questions",
      "allowed_topics",
    ],
  });
});
