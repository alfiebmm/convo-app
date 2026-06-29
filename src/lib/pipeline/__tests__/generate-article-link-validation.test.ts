import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ArticleLinkPolicyError,
  generateArticle,
  type GeneratedArticle,
} from "../generate-article";
import type { ExtractedTopic } from "../extract-topics";

const TOPIC: ExtractedTopic = {
  primaryTopic: "Dog nutrition",
  subtopics: ["puppy food"],
  userIntent: "educational",
  suggestedArticleType: "blog",
  seoKeywords: ["dog nutrition"],
  confidence: 0.9,
  audience: "general",
  contentCategory: "care guide",
};

const MESSAGES = [
  { role: "user", content: "What should I feed my puppy?" },
  { role: "assistant", content: "A balanced puppy diet matters." },
];

function articleJson(body: string): string {
  return JSON.stringify({
    title: "Dog Nutrition Guide",
    metaDescription: "A practical dog nutrition guide for puppy owners.",
    slug: "dog-nutrition-guide",
    body,
    seoScore: 0.82,
  });
}

test("generateArticle retries when generated body contains a third-party link", async () => {
  const prompts: string[] = [];
  const inserts: Array<{ body: string }> = [];

  const article = await generateArticle(
    "tenant-1",
    "doggo.com.au",
    "topic-1",
    "conversation-1",
    TOPIC,
    MESSAGES,
    {
      createCompletion: async (messages) => {
        prompts.push(messages[messages.length - 1].content);
        return prompts.length === 1
          ? articleJson("See [Wikipedia](https://en.wikipedia.org/wiki/Dog_food).")
          : articleJson("See [our guide](https://doggo.com.au/feeding).");
      },
      insertContent: async (values): Promise<GeneratedArticle> => {
        inserts.push({ body: values.body });
        return {
          id: "content-1",
          title: values.title,
          slug: values.slug,
          metaDescription: values.metaDescription,
          body: values.body,
          seoScore: values.seoScore,
          type: values.type,
          status: values.status,
        };
      },
    },
  );

  assert.equal(prompts.length, 2);
  assert.match(prompts[1], /Only link to https:\/\/doggo\.com\.au/);
  assert.equal(inserts.length, 1);
  assert.equal(article.body, "See [our guide](https://doggo.com.au/feeding).");
});

test("generateArticle throws structured error after retries exhaust", async () => {
  await assert.rejects(
    () =>
      generateArticle(
        "tenant-1",
        "doggo.com.au",
        "topic-1",
        "conversation-1",
        TOPIC,
        MESSAGES,
        {
          createCompletion: async () =>
            articleJson("See [Wikipedia](https://en.wikipedia.org/wiki/Dog_food)."),
          insertContent: async () => {
            throw new Error("insert should not run");
          },
        },
      ),
    (error) => {
      assert.ok(error instanceof ArticleLinkPolicyError);
      assert.equal(error.code, "ARTICLE_LINK_POLICY_VIOLATION");
      assert.equal(error.tenantDomain, "doggo.com.au");
      assert.equal(error.attempts, 2);
      assert.equal(error.findings.length, 1);
      assert.equal(error.findings[0].host, "en.wikipedia.org");
      return true;
    },
  );
});
