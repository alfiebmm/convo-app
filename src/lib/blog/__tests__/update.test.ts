import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

import { __testing as pipelineTesting } from "../pipeline";
import { __testing as updateTesting } from "../update";
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
  validate: (params: { brand: Record<string, unknown>; post: BlogPostJson }) => [];
};

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const CONVERSATION_ID = "22222222-2222-4222-8222-222222222222";
const TARGET_ID = "33333333-3333-4333-8333-333333333333";
const KEYWORD = "pharmacists";
const NOW = new Date("2026-08-18T03:04:05.000Z");
const CANONICAL_URL = "https://chemist2u.com.au/blog/how-pharmacists-support-care";
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

type SeoValidationLog = {
  action: "create" | "update";
  reason: string;
  targetBlogPostId?: string;
  metadata: Record<string, unknown>;
};

function decision(): DecisionResult {
  return {
    action: "update",
    reason: "High similarity.",
    similar_posts: [{ blog_post_id: TARGET_ID, score: 0.92 }],
    primary_keyword: KEYWORD,
    intent: "educational",
    target_blog_post_id: TARGET_ID,
  };
}

function proseWords(count: number, prefix: string): string {
  const words = [
    "pharmacists",
    "explain",
    "medicine",
    "timing",
    "safety",
    "questions",
    "patient",
    "notes",
    "review",
    "routine",
    "dose",
    "side",
    "effects",
    "clear",
    "records",
    "family",
    "support",
    "practical",
    "advice",
    "follow",
    "up",
  ];

  return Array.from(
    { length: count },
    (_value, index) => `${prefix}${index}-${words[index % words.length]}`
  ).join(" ");
}

function richParagraphs(sectionIndex: number) {
  return [0, 1, 2].map((paragraphIndex) => ({
    type: "p" as const,
    text: proseWords(45, `s${sectionIndex}p${paragraphIndex}`),
  }));
}

function validPost(overrides: Partial<BlogPostJson> = {}): BlogPostJson {
  const post = structuredClone(postFixture) as BlogPostJson;
  const postRecord = post as unknown as Record<string, unknown>;

  post.meta.reviewer = null as unknown as string | undefined;
  post.seo = {
    metaTitle: "How pharmacists support ongoing care across Australia",
    metaDescription:
      "Learn how pharmacists support ongoing care, medicine reviews, side effect checks and practical health questions, with clear advice on when to contact a GP.",
    canonicalUrl: null as unknown as string,
    ogImage: null as unknown as string,
    authoredAt: null as unknown as string,
    modifiedAt: null as unknown as string,
    authorName: null as unknown as string,
    keywords: [KEYWORD, "medicine reviews"],
  };
  post.related = post.related?.map((related) => ({
    ...related,
    thumbUrl: related.thumbUrl ?? (null as unknown as string),
    category: related.category ?? (null as unknown as string),
  }));
  post.slug = "how-pharmacists-support-care";
  post.title = "How pharmacists support ongoing care";
  post.intro =
    "Pharmacists help with ongoing care by answering medicine questions, checking interactions, explaining side effects, and helping people understand when a GP should be involved.";
  post.sections = post.sections.map((section, index) => ({
    ...section,
    blocks: richParagraphs(index),
  }));
  post.sections[0].heading = "How pharmacists support ongoing care";
  post.sections[post.sections.length - 1].blocks.push({
    type: "cta",
    heading: "Wrong heading",
    body: "Wrong body",
    linkUrl: "https://wrong.example/path",
    linkLabel: "Wrong label",
  });
  postRecord.stats ??= null;
  postRecord.related ??= null;
  return { ...post, ...overrides };
}

function validBrand(): Record<string, unknown> {
  const brand = structuredClone(brandFixture) as Record<string, unknown>;
  (brand.fonts as Record<string, unknown>).headings ??= null;
  (brand.fonts as Record<string, unknown>).googleUrl ??= null;
  (brand.logo as Record<string, unknown>).height ??= null;
  (brand.site as Record<string, unknown>).hubLabel ??= null;
  (brand.site as Record<string, unknown>).loginUrl ??= null;
  (brand.site as Record<string, unknown>).orderUrl ??= null;
  (brand.site as Record<string, unknown>).orderLabel ??= null;
  return brand;
}

function makeTarget() {
  const metadata = validPost({
    seo: {
      ...validPost().seo,
      canonicalUrl: CANONICAL_URL,
      modifiedAt: "2026-07-01T00:00:00.000Z",
    },
  });
  return {
    id: TARGET_ID,
    tenantId: TENANT_ID,
    title: metadata.title,
    slug: metadata.slug,
    content: "<html><body>Original rendered article</body></html>",
    metadata,
    status: "published",
    lastModified: new Date("2026-07-01T00:00:00.000Z"),
  };
}

function makeService(responses: BlogPostJson[]) {
  const inserts: InsertedPost[] = [];
  const seoValidationLogs: SeoValidationLog[] = [];
  const existingSlugs = new Set(["how-pharmacists-support-care"]);
  const target = makeTarget();
  const service = updateTesting.buildUpdateService({
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
            settings: { brandJson: validBrand(), blog: { cta: CTA } },
          },
          messages: [
            {
              role: "user",
              content:
                "Can pharmacists help with medicine side effects, older medicines, and new scripts after hospital discharge?",
              createdAt: new Date("2026-08-18T00:00:00.000Z"),
            },
          ],
        };
      },
      async loadTargetBlogPost(blogPostId) {
        assert.equal(blogPostId, TARGET_ID);
        return target;
      },
      async slugExists(_tenantId, slug) {
        return existingSlugs.has(slug);
      },
      async insertBlogPost(values) {
        inserts.push(values);
        existingSlugs.add(values.slug);
        return { id: `post-${inserts.length}` };
      },
      async insertSeoValidationLog(input) {
        seoValidationLogs.push(input);
        return { id: `seo-log-${seoValidationLogs.length}` };
      },
    },
    ai: {
      async generatePost() {
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
    now: () => NOW,
  });
  return { service, inserts, target, seoValidationLogs };
}

test("update decisions route to updateArticle", async () => {
  const updateDecision = decision();
  let updated = false;
  let created = false;
  const service = pipelineTesting.buildPipelineService({
    findExistingPost: async () => null,
    decide: async () => updateDecision,
    createArticle: async () => {
      created = true;
      return "created";
    },
    updateArticle: async (_conversationId, routedDecision) => {
      assert.equal(routedDecision, updateDecision);
      updated = true;
      return "updated";
    },
  });
  const result = await service.runBlogPipeline(CONVERSATION_ID);
  assert.equal(result?.blogPostId, "updated");
  assert.equal(updated, true);
  assert.equal(created, false);
});

test("revision preserves seo.canonicalUrl from target", async () => {
  const { service, inserts, seoValidationLogs } = makeService([validPost()]);
  await service.updateArticle(CONVERSATION_ID, decision());
  const metadata = inserts[0].metadata as BlogPostJson & { update_of?: string };
  assert.equal(metadata.seo?.canonicalUrl, CANONICAL_URL);
  assert.equal(metadata.update_of, TARGET_ID);
  assert.equal(seoValidationLogs.length, 1);
  assert.equal(seoValidationLogs[0].action, "update");
  assert.equal(seoValidationLogs[0].targetBlogPostId, TARGET_ID);
  assert.equal(seoValidationLogs[0].metadata.phase, "seo_validation");
});

test("revision updates seo.modifiedAt", async () => {
  const { service, inserts } = makeService([validPost()]);
  await service.updateArticle(CONVERSATION_ID, decision());
  assert.equal((inserts[0].metadata as BlogPostJson).seo?.modifiedAt, NOW.toISOString());
});

test("update failure creates failed row without mutating target", async () => {
  const bad = validPost({
    intro:
      "Pharmacists delve into ongoing care by answering medicine questions and helping people understand side effects.",
  });
  const { service, inserts, target } = makeService([bad, bad, bad, bad]);
  const targetBefore = structuredClone(target);
  await service.updateArticle(CONVERSATION_ID, decision());
  assert.deepEqual(target, targetBefore);
  assert.equal(inserts[0].status, "generation_failed");
  assert.equal(inserts[0].metadata.update_of, TARGET_ID);
  assert.match(
    String((inserts[0].metadata.generation_failure as Record<string, unknown>).reason),
    /Banned term found/
  );
});
