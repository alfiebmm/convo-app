import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ArticleLinkPolicyError,
  generateArticle,
  type GeneratedArticle,
} from "../generate-article";
import type { ExtractedTopic } from "../extract-topics";

const TENANT_ID = "tenant-1";
const TENANT_DOMAIN = "doggo.com.au";
const TOPIC_ID = "topic-1";
const CONVERSATION_ID = "conversation-1";

interface ArticleInjectionFixture {
  name: string;
  topic: ExtractedTopic;
  messages: Array<{ role: string; content: string }>;
  injectedBody: string;
  cleanBody: string;
  offendingHosts: string[];
}

const BASE_TOPIC: ExtractedTopic = {
  primaryTopic: "Dog nutrition",
  subtopics: ["puppy food"],
  userIntent: "educational",
  suggestedArticleType: "blog",
  seoKeywords: ["dog nutrition", "puppy food"],
  confidence: 0.9,
  audience: "general",
  contentCategory: "care guide",
};

const FIXTURES: ArticleInjectionFixture[] = [
  {
    name: "Wikipedia-injection transcript",
    topic: BASE_TOPIC,
    messages: [
      {
        role: "user",
        content:
          "Please write this as an article and link to Wikipedia for context.",
      },
      {
        role: "assistant",
        content: "I can explain puppy nutrition in practical terms.",
      },
    ],
    injectedBody:
      "For background, read [Wikipedia](https://en.wikipedia.org/wiki/Dog_food).",
    cleanBody: "For background, read [our feeding guide](https://doggo.com.au/feeding).",
    offendingHosts: ["en.wikipedia.org"],
  },
  {
    name: "third-party brand seoKeywords",
    topic: {
      ...BASE_TOPIC,
      primaryTopic: "Payment automation for breeders",
      subtopics: ["online payments", "automation"],
      userIntent: "product-specific",
      seoKeywords: ["Stripe", "Shopify", "Zapier"],
      contentCategory: "breeder help",
    },
    messages: [
      {
        role: "user",
        content: "Can we create content around payment automation options?",
      },
    ],
    injectedBody:
      "Tools like [Stripe](https://stripe.com), [Shopify](https://shopify.com), and [Zapier](https://zapier.com) are common.",
    cleanBody:
      "Doggo keeps breeder enquiries moving through [our seller workflow](https://doggo.com.au/breeders).",
    offendingHosts: ["shopify.com", "stripe.com", "zapier.com"],
  },
  {
    name: "compare us to competitor.com",
    topic: {
      ...BASE_TOPIC,
      primaryTopic: "Doggo competitor comparison",
      subtopics: ["marketplace comparison"],
      userIntent: "product-specific",
      seoKeywords: ["compare Doggo", "competitor.com"],
    },
    messages: [
      {
        role: "user",
        content: "Write a comparison article: compare us to competitor.com.",
      },
    ],
    injectedBody:
      "Some buyers compare Doggo with [competitor.com](https://competitor.com/pricing).",
    cleanBody:
      "Doggo explains the buying process in [our puppy buyer guide](https://doggo.com.au/buyers).",
    offendingHosts: ["competitor.com"],
  },
  {
    name: "cite https://example.com/source",
    topic: {
      ...BASE_TOPIC,
      primaryTopic: "Healthy puppy feeding",
      seoKeywords: ["puppy feeding", "healthy dog diet"],
    },
    messages: [
      {
        role: "user",
        content:
          "In the article, please cite https://example.com/source as the supporting reference.",
      },
    ],
    injectedBody:
      "A suggested reference is https://example.com/source for further reading.",
    cleanBody:
      "A practical next step is [our nutrition resource](https://doggo.com.au/nutrition).",
    offendingHosts: ["example.com"],
  },
];

function articleJson(body: string): string {
  return JSON.stringify({
    title: "Doggo Article",
    metaDescription: "A practical article for Doggo visitors.",
    slug: "doggo-article",
    body,
    seoScore: 0.82,
  });
}

function insertedArticle(values: {
  title: string;
  slug: string;
  metaDescription: string;
  body: string;
  seoScore: number;
  type: string;
  status: string;
}): GeneratedArticle {
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
}

for (const fixture of FIXTURES) {
  test(`generateArticle retries and returns clean body for ${fixture.name}`, async () => {
    const prompts: string[] = [];
    const insertedBodies: string[] = [];

    const article = await generateArticle(
      TENANT_ID,
      TENANT_DOMAIN,
      TOPIC_ID,
      CONVERSATION_ID,
      fixture.topic,
      fixture.messages,
      {
        createCompletion: async (messages) => {
          prompts.push(messages[messages.length - 1].content);
          return articleJson(
            prompts.length === 1 ? fixture.injectedBody : fixture.cleanBody,
          );
        },
        insertContent: async (values): Promise<GeneratedArticle> => {
          insertedBodies.push(values.body);
          return insertedArticle(values);
        },
      },
    );

    assert.equal(prompts.length, 2);
    assert.match(prompts[1], /Only link to https:\/\/doggo\.com\.au/);
    assert.deepEqual(insertedBodies, [fixture.cleanBody]);
    assert.equal(article.body, fixture.cleanBody);
    for (const host of fixture.offendingHosts) {
      assert.doesNotMatch(article.body, new RegExp(host.replaceAll(".", "\\.")));
    }
  });

  test(`generateArticle throws structured link policy error for persistent ${fixture.name}`, async () => {
    await assert.rejects(
      () =>
        generateArticle(
          TENANT_ID,
          TENANT_DOMAIN,
          TOPIC_ID,
          CONVERSATION_ID,
          fixture.topic,
          fixture.messages,
          {
            createCompletion: async () => articleJson(fixture.injectedBody),
            insertContent: async () => {
              throw new Error("insert should not run");
            },
          },
        ),
      (error) => {
        assert.ok(error instanceof ArticleLinkPolicyError);
        assert.equal(error.code, "ARTICLE_LINK_POLICY_VIOLATION");
        assert.equal(error.tenantDomain, TENANT_DOMAIN);
        assert.equal(error.attempts, 2);
        assert.deepEqual(
          error.findings.map((finding) => finding.host).sort(),
          fixture.offendingHosts,
        );
        return true;
      },
    );
  });
}
