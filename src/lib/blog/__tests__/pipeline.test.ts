#!/usr/bin/env node

import { test } from "node:test";
import assert from "node:assert/strict";

import { __testing } from "../pipeline";
import type { DecisionResult } from "../decision";

const CONVERSATION_ID = "22222222-2222-4222-8222-222222222222";

function createDecision(): DecisionResult {
  return {
    action: "create",
    reason: "Low similarity.",
    similar_posts: [],
    primary_keyword: "pharmacists",
    intent: "educational",
    log_id: "decision-log-1",
  };
}

test("runBlogPipeline links a create decision log to the persisted blog post", async () => {
  const linked: Array<{ decisionLogId: string | undefined; blogPostId: string }> = [];
  let createdFor: string | null = null;

  const service = __testing.buildPipelineService({
    findExistingPost: async () => null,
    decide: async () => createDecision(),
    createArticle: async (conversationId) => {
      createdFor = conversationId;
      return "blog-post-1";
    },
    updateArticle: async () => {
      throw new Error("updateArticle should not be called");
    },
    linkDecisionToBlogPost: async (decisionLogId, blogPostId) => {
      linked.push({ decisionLogId, blogPostId });
    },
  });

  const result = await service.runBlogPipeline(CONVERSATION_ID);

  assert.equal(createdFor, CONVERSATION_ID);
  assert.equal(result?.blogPostId, "blog-post-1");
  assert.deepEqual(linked, [
    { decisionLogId: "decision-log-1", blogPostId: "blog-post-1" },
  ]);
});

