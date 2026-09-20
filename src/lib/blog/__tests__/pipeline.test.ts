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
  const linked: Array<{
    decisionLogId: string | undefined;
    action: DecisionResult["action"];
    blogPostId: string;
  }> = [];
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
    recordPipelineOutcome: async (decisionLogId, decision, blogPostId) => {
      linked.push({ decisionLogId, action: decision.action, blogPostId });
    },
  });

  const result = await service.runBlogPipeline(CONVERSATION_ID);

  assert.equal(createdFor, CONVERSATION_ID);
  assert.equal(result?.blogPostId, "blog-post-1");
  assert.deepEqual(linked, [
    { decisionLogId: "decision-log-1", action: "create", blogPostId: "blog-post-1" },
  ]);
});

test("runBlogPipeline does not generate a draft for skip-covered decisions", async () => {
  const decision: DecisionResult = {
    action: "skip-covered",
    reason: "covered_by_existing_healthy_no_new_signal",
    similar_posts: [],
    primary_keyword: "pharmacists",
    intent: "educational",
    target_blog_post_id: "existing-post-1",
    log_id: "decision-log-1",
  };

  const service = __testing.buildPipelineService({
    findExistingPost: async () => null,
    decide: async () => decision,
    createArticle: async () => {
      throw new Error("createArticle should not be called");
    },
    updateArticle: async () => {
      throw new Error("updateArticle should not be called");
    },
    recordPipelineOutcome: async () => {
      throw new Error("recordPipelineOutcome should not be called");
    },
  });

  const result = await service.runBlogPipeline(CONVERSATION_ID);

  assert.equal(result?.blogPostId, null);
  assert.equal(result?.decision.action, "skip-covered");
});
