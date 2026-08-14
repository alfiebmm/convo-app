import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

import { __testing } from "../create";
import type { DecisionResult } from "../decision";
import type { BlogPostJson } from "../writing-rules";
import brandFixture from "../schemas/brand.example.chemist2u.json";
import postFixture from "../schemas/post.example.chemist2u.json";

const require = createRequire(import.meta.url);
const { render } = require("../template-pack/renderer.js") as {
  render: (params: {
    brand: Record<string, unknown>;
    post: BlogPostJson;
    stylesPath: string;
    templatePath: string;
  }) => string;
};
const { validate } = require("../template-pack/validate.js") as {
  validate: (params: {
    brand: Record<string, unknown>;
    post: BlogPostJson;
  }) => Array<{
    file: string;
    errors: Array<{ instancePath?: string; message?: string; params?: unknown }>;
  }>;
};

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const CONVERSATION_ID = "22222222-2222-4222-8222-222222222222";
const KEYWORD = "pharmacists";
const CTA = {
  heading: "Book a pharmacy consult",
  body: "Talk to a registered pharmacist about medicine questions.",
  linkUrl: "https://chemist2u.com.au/consult/",
  linkLabel: "Book a consult",
};

type InsertedPost = {
  tenantId: string;
  threadId: string;
  title: string;
  slug: string;
  content: string;
  metadata: Record<string, unknown>;
  status: "draft" | "generation_failed" | "update_pending";
  persona: string | null;
  topic: string | null;
};

function decision(): DecisionResult {
  return {
    action: "create",
    reason: "Low similarity.",
    similar_posts: [],
    primary_keyword: KEYWORD,
    intent: "educational",
  };
}

function validPost(overrides: Partial<BlogPostJson> = {}): BlogPostJson {
  const post = structuredClone(postFixture) as BlogPostJson;
  post.seo = {
    metaDescription:
      "Learn how pharmacists support ongoing care, medicine reviews, side effect checks and practical health questions in Australia.",
    keywords: [KEYWORD, "medicine reviews"],
  };
  post.title = "How pharmacists support ongoing care";
  post.intro =
    "Pharmacists help with ongoing care by answering medicine questions, checking interactions, explaining side effects, and helping people understand when a GP should be involved.";
  post.sections[0].heading = "How pharmacists support ongoing care";
  post.sections[post.sections.length - 1].blocks.push({
    type: "cta",
    heading: "Wrong heading",
    body: "Wrong body",
    linkUrl: "https://wrong.example/path",
    linkLabel: "Wrong label",
  });

  return {
    ...post,
    ...overrides,
  };
}

function makeService(responses: BlogPostJson[]) {
  const inserts: InsertedPost[] = [];
  const prompts: string[] = [];
  const existingSlugs = new Set<string>();

  const service = __testing.buildCreateService({
    store: {
      async loadConversation(conversationId) {
        assert.equal(conversationId, CONVERSATION_ID);
        return {
          conversation: { id: CONVERSATION_ID, tenantId: TENANT_ID },
          tenant: {
            id: TENANT_ID,
            name: "Chemist2U",
            slug: "chemist2u",
            domain: "chemist2u.com.au",
            settings: {
              brandJson: brandFixture,
              blog: { cta: CTA },
            },
          },
          messages: [
            {
              role: "user",
              content:
                "Can pharmacists help with medicine side effects and ongoing medication questions?",
              createdAt: new Date("2026-07-31T00:00:00.000Z"),
            },
            {
              role: "assistant",
              content:
                "Yes. We discussed medicine reviews, interactions, side effects, and when to see a GP.",
              createdAt: new Date("2026-07-31T00:01:00.000Z"),
            },
          ],
        };
      },
      async slugExists(_tenantId, slug) {
        return existingSlugs.has(slug);
      },
      async insertBlogPost(values) {
        inserts.push(values);
        existingSlugs.add(values.slug);
        return { id: `post-${inserts.length}` };
      },
    },
    ai: {
      async generatePost(params) {
        prompts.push(params.userPrompt);
        const next = responses.shift();
        if (!next) throw new Error("mock response queue exhausted");
        return JSON.stringify(next);
      },
    },
    validate,
    render: ({ brand, post }) =>
      render({
        brand,
        post,
        stylesPath: path.join(process.cwd(), "src/lib/blog/template-pack/_tokenised.css"),
        templatePath: path.join(process.cwd(), "src/lib/blog/template-pack/template.html"),
      }),
    sleep: async () => {},
  });

  return { service, inserts, prompts };
}

test("createArticle renders HTML and persists full post metadata", async () => {
  const { service, inserts } = makeService([validPost()]);

  const id = await service.createArticle(CONVERSATION_ID, decision());

  assert.equal(id, "post-1");
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0].status, "draft");
  assert.equal(inserts[0].title, "How pharmacists support ongoing care");
  assert.match(inserts[0].content, /<html/);
  assert.match(inserts[0].content, /<meta name="description"/);
  assert.equal((inserts[0].metadata as BlogPostJson).title, inserts[0].title);
  assert.equal(inserts[0].persona, KEYWORD);
  assert.equal(inserts[0].topic, "educational");
});

test("schema validation retries once with schema errors", async () => {
  const invalid = validPost({ toc: ["Only one item"] });
  const { service, inserts, prompts } = makeService([invalid, validPost()]);

  await service.createArticle(CONVERSATION_ID, decision());

  assert.equal(inserts[0].status, "draft");
  assert.equal(prompts.length, 2);
  assert.match(prompts[1], /post\.json failed schema validation/);
});

test("banned words retry once and then persist a clean draft", async () => {
  const bad = validPost({
    intro:
      "Pharmacists delve into ongoing care by answering medicine questions and helping people understand side effects.",
  });
  const { service, inserts, prompts } = makeService([bad, validPost()]);

  await service.createArticle(CONVERSATION_ID, decision());

  assert.equal(inserts[0].status, "draft");
  assert.equal(prompts.length, 2);
  assert.match(prompts[1], /Banned term found: delve/);
});

test("banned words fail after the retry and mark generation_failed", async () => {
  const bad = validPost({
    intro:
      "Pharmacists delve into ongoing care by answering medicine questions and helping people understand side effects.",
  });
  const { service, inserts } = makeService([bad, bad]);

  await service.createArticle(CONVERSATION_ID, decision());

  assert.equal(inserts.length, 1);
  assert.equal(inserts[0].status, "generation_failed");
  assert.match(
    String(
      (
        inserts[0].metadata.generation_failure as Record<string, unknown>
      ).reason
    ),
    /Banned term found/
  );
});

test("em dashes are stripped from rendered content and metadata", async () => {
  const withDash = validPost({
    dek: "A guide to pharmacists — and the care they support.",
  });
  const { service, inserts } = makeService([withDash]);

  await service.createArticle(CONVERSATION_ID, decision());

  assert.doesNotMatch(inserts[0].content, /[—–]/);
  assert.doesNotMatch((inserts[0].metadata as BlogPostJson).dek, /[—–]/);
});

test("primary keyword placement failure retries once", async () => {
  const bad = validPost({ title: "Ongoing medicine support in Australia" });
  const { service, inserts, prompts } = makeService([bad, validPost()]);

  await service.createArticle(CONVERSATION_ID, decision());

  assert.equal(inserts[0].status, "draft");
  assert.equal(prompts.length, 2);
  assert.match(prompts[1], /missing from title/);
});

test("CTA blocks are overridden from tenant config", async () => {
  const { service, inserts } = makeService([validPost()]);

  await service.createArticle(CONVERSATION_ID, decision());

  const metadata = inserts[0].metadata as BlogPostJson;
  const ctaBlock = metadata.sections
    .flatMap((section) => section.blocks)
    .find((block) => block.type === "cta");

  assert.ok(ctaBlock);
  assert.equal(ctaBlock.linkUrl, CTA.linkUrl);
  assert.equal(ctaBlock.linkLabel, CTA.linkLabel);
  assert.match(inserts[0].content, /https:\/\/chemist2u\.com\.au\/consult\//);
  assert.match(inserts[0].content, /Book a consult/);
});

test("Australian English violations retry once", async () => {
  const bad = validPost({
    intro:
      "Pharmacists help with ongoing care by answering medicine questions, checking color labels, and explaining side effects.",
  });
  const { service, inserts, prompts } = makeService([bad, validPost()]);

  await service.createArticle(CONVERSATION_ID, decision());

  assert.equal(inserts[0].status, "draft");
  assert.equal(prompts.length, 2);
  assert.match(prompts[1], /US spelling found: color/);
});
