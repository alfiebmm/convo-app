import { test } from "node:test";
import assert from "node:assert/strict";

import {
  classifyConversation,
  validateAudience,
  type ClassifiedConversation,
} from "../index";
import type { TenantSeoStrategy } from "../../editorial-brief";

function response(input: Partial<ClassifiedConversation>) {
  return JSON.stringify({
    topic: "Service pricing",
    primaryKeyword: "service pricing guide",
    secondaryKeywords: ["service fees", "service questions"],
    searchIntent: "commercial",
    articleType: "pricing",
    audience: "business owner",
    confidence: 0.86,
    sourceEvidence: [{ role: "user", excerpt: "What do services cost?", turnIndex: 0 }],
    needsReview: false,
    reviewReasons: [],
    ...input,
  });
}

const baseStrategy: TenantSeoStrategy = {
  tenantId: "tenant-1",
  targetKeywords: [],
  priorityServices: [],
  priorityLocations: [],
  targetAudiences: [{ persona: "small business owner" }],
  approvedInternalUrls: [],
  preferredCtas: [],
  avoidTopics: [],
  avoidClaims: [],
  avoidKeywords: [],
};

test("classifies AgPages rates without using the keyword as audience", async () => {
  const classification = await classifyConversation({
    conversationMessages: [
      {
        role: "user",
        content:
          "How do AgPages contractor rates work for annual listings and comparison articles?",
      },
    ],
    deps: {
      createCompletion: async () =>
        response({
          topic: "Annual listing rates",
          primaryKeyword: "AgPages contractor rates",
          secondaryKeywords: ["annual listing rates", "listing comparison"],
          searchIntent: "commercial",
          articleType: "pricing",
          audience: "business owner",
        }),
    },
  });

  assert.notEqual(classification.topic, classification.primaryKeyword);
  assert.match(classification.primaryKeyword, /AgPages contractor rates/);
  assert.notEqual(classification.audience, "AgPages contractor rates");
  assert.notEqual(classification.audience, classification.primaryKeyword);
  assert.notEqual(classification.articleType, "faq");
  assert.notEqual(classification.searchIntent, "faq");
});

test("handles a Doggo-style breed conversation without the old closed categories", async () => {
  const classification = await classifyConversation({
    conversationMessages: [
      {
        role: "user",
        content: "I am comparing a cavoodle for a prospective puppy buyer.",
      },
    ],
    deps: {
      createCompletion: async () =>
        response({
          topic: "Cavoodle suitability",
          primaryKeyword: "cavoodle family suitability",
          searchIntent: "informational",
          articleType: "guide",
          audience: "prospective dog owner",
        }),
    },
  });

  assert.equal(classification.audience, "prospective dog owner");
  assert.equal(classification.articleType, "guide");
});

test("does not force legal services into unrelated tenant vocabulary", async () => {
  const classification = await classifyConversation({
    conversationMessages: [
      {
        role: "user",
        content: "Can you explain unfair dismissal advice for a small employer?",
      },
    ],
    deps: {
      createCompletion: async () =>
        response({
          topic: "Unfair dismissal advice",
          primaryKeyword: "unfair dismissal advice",
          searchIntent: "informational",
          articleType: "explainer",
          audience: "employer",
        }),
    },
  });

  const output = JSON.stringify(classification).toLowerCase();
  for (const forbidden of ["breeder", "buyer", "contractor", "farmer"]) {
    assert.doesNotMatch(output, new RegExp(forbidden));
  }
});

test("works without a tenant strategy", async () => {
  const classification = await classifyConversation({
    conversationMessages: [{ role: "user", content: "What does the service include?" }],
    deps: { createCompletion: async () => response({ audience: "operations manager" }) },
  });

  assert.equal(classification.audience, "operations manager");
  assert.equal(classification.needsReview, false);
});

test("reconciles audience to a configured persona", async () => {
  const classification = await classifyConversation({
    conversationMessages: [{ role: "user", content: "What does the service include?" }],
    tenantSeoStrategy: baseStrategy,
    deps: {
      createCompletion: async () => response({ audience: "small business owners" }),
    },
  });

  assert.equal(classification.audience, "small business owner");
});

test("flags audience values that are keyword phrases", () => {
  const result = validateAudience({
    audience: "service pricing guide",
    primaryKeyword: "service pricing guide",
    tenantSeoStrategy: null,
  });

  assert.equal(result.audience, "unknown");
  assert.equal(result.needsReview, true);
  assert.match(result.reviewReasons.join(" "), /keyword phrase/);
});

test("uses configured default persona when audience is a keyword phrase", () => {
  const result = validateAudience({
    audience: "service pricing guide",
    primaryKeyword: "service pricing guide",
    tenantSeoStrategy: baseStrategy,
  });

  assert.equal(result.audience, "small business owner");
  assert.equal(result.needsReview, true);
});

test("malformed classifier JSON returns a neutral reviewable fallback", async () => {
  const classification = await classifyConversation({
    conversationMessages: [{ role: "user", content: "What does the service include?" }],
    deps: { createCompletion: async () => "not json" },
  });

  assert.equal(classification.articleType, "guide");
  assert.equal(classification.searchIntent, "informational");
  assert.equal(classification.audience, "unknown");
  assert.equal(classification.needsReview, true);
});
