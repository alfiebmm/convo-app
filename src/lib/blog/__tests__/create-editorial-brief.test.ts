import { test } from "node:test";
import assert from "node:assert/strict";

import { __testing, type BlogCreateStore } from "../create";
import type { DecisionResult } from "../decision";
import type { BlogPostJson } from "../writing-rules";
import type {
  ArticleSeoFields,
  EditorialBrief,
  TenantSeoStrategy,
} from "@/lib/pipeline/editorial-brief";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const CONVERSATION_ID = "22222222-2222-4222-8222-222222222222";

function prose(count: number) {
  return Array.from({ length: count }, (_, index) => `useful${index}`).join(" ");
}

function validPost(): BlogPostJson {
  return {
    slug: "service-pricing-guide",
    category: "Guide",
    title: "Service pricing guide for common questions",
    dek: "A practical guide to service pricing.",
    meta: { updated: "2026-09-23", readMinutes: 5 },
    seo: {
      metaTitle: "Service pricing guide for common questions",
      metaDescription:
        "Use this service pricing guide to understand options, common questions, and practical next steps before requesting support.",
    },
    hero: { url: "https://example.com/hero.jpg", alt: "Service pricing guide" },
    toc: ["Service pricing guide", "What affects pricing", "Next steps"],
    intro:
      "This service pricing guide explains common factors, useful questions, and practical next steps for people comparing support options.",
    sections: Array.from({ length: 4 }, (_, index) => ({
      heading:
        index === 0
          ? "Service pricing guide"
          : index === 1
            ? "Quote drivers for service pricing"
            : `Planning section ${index}`,
      blocks: [
        ...(index === 0
          ? [
              {
                type: "quickAnswer" as const,
                heading: "Quick answer",
                body:
                  "Use this service pricing guide to scope the request. Verified rate ranges are not available in this source.",
              },
            ]
          : []),
        { type: "p" as const, text: `${prose(70)} service pricing guide` },
        { type: "p" as const, text: prose(70) },
        { type: "p" as const, text: prose(70) },
        ...(index === 1
          ? [
              {
                type: "ul" as const,
                items: ["Scope", "Timing", "Support needs"],
              },
            ]
          : []),
        ...(index === 2
          ? [
              {
                type: "noRateDataFallback" as const,
                text:
                  "We do not yet have verified rate data for this service. Use the CTA to request a quote for the exact job scope.",
              },
            ]
          : []),
        ...(index === 3
          ? [
              {
                type: "checklist" as const,
                items: ["Share the scope", "Confirm timing", "Ask what is included"],
              },
              {
                type: "cta" as const,
                heading: "Request support",
                body: "Ask the team for advice.",
                linkUrl: "https://example.com/contact",
                linkLabel: "Request support",
              },
            ]
          : []),
      ],
    })),
    faqs: [
      { q: "What affects pricing?", a: "Scope, timing, and support needs." },
      { q: "Can I ask questions first?", a: "Yes, ask for advice before choosing." },
      { q: "What should I prepare?", a: "Prepare goals, constraints, and timing." },
    ],
  };
}

test("createArticle persists an editorial brief before the draft and writes SEO sidecar fields", async () => {
  const calls: string[] = [];
  const strategy: TenantSeoStrategy = {
    tenantId: TENANT_ID,
    targetKeywords: [{ keyword: "service pricing guide", priority: "high" }],
    priorityServices: [],
    priorityLocations: [],
    targetAudiences: [{ persona: "Decision makers" }],
    approvedInternalUrls: [],
    preferredCtas: [{ label: "Request support", url: "https://example.com/contact" }],
    avoidTopics: [],
    avoidClaims: [],
    avoidKeywords: [],
  };
  const saved: { brief: EditorialBrief | null; seo: ArticleSeoFields | null } = {
    brief: null,
    seo: null,
  };
  let savedMetadata: Record<string, unknown> | null = null;

  const store: BlogCreateStore = {
    async loadConversation() {
      return {
        conversation: { id: CONVERSATION_ID, tenantId: TENANT_ID },
        tenant: {
          id: TENANT_ID,
          name: "Example Business",
          slug: "example",
          domain: "example.com",
          settings: {
            brandJson: {
              name: "Example Business",
              cta: {
                heading: "Request support",
                body: "Ask the team for advice.",
                linkUrl: "https://example.com/contact",
                linkLabel: "Request support",
              },
            },
            blog: {
              cta: {
                heading: "Request support",
                body: "Ask the team for advice.",
                linkUrl: "https://example.com/contact",
                linkLabel: "Request support",
              },
            },
          },
        },
        messages: [
          {
            role: "user",
            content: "Can you explain your service pricing guide before I enquire?",
            createdAt: new Date("2026-09-23T00:00:00.000Z"),
          },
        ],
      };
    },
    async slugExists() {
      return false;
    },
    async insertBlogPost(values) {
      calls.push("post");
      savedMetadata = values.metadata;
      return { id: "post-1" };
    },
    async loadTenantSeoStrategy() {
      return strategy;
    },
    async insertEditorialBrief(brief) {
      calls.push("brief");
      saved.brief = brief;
      return { id: "brief-1" };
    },
    async linkEditorialBriefToBlogPost() {
      calls.push("brief-link");
    },
    async upsertBlogPostSeo(_blogPostId, fields) {
      calls.push("seo");
      saved.seo = fields;
    },
  };

  const service = __testing.buildCreateService({
    store,
    ai: {
      classifyConversation: async () => ({
        topic: "Service pricing",
        primaryKeyword: "service pricing guide",
        secondaryKeywords: ["service fees", "service questions"],
        searchIntent: "commercial",
        articleType: "pricing",
        audience: "Decision makers",
        confidence: 0.9,
        sourceEvidence: [
          {
            role: "user",
            excerpt: "Can you explain your service pricing guide before I enquire?",
            turnIndex: 0,
          },
        ],
        needsReview: false,
        reviewReasons: [],
      }),
      generatePost: async () => JSON.stringify(validPost()),
    },
    render: () => "<article>Rendered</article>",
    renderSemantic: () => "<article>Rendered</article>",
    validate: () => [],
    sleep: async () => undefined,
  });
  const decision: DecisionResult = {
    action: "create",
    reason: "Low similarity.",
    similar_posts: [],
    primary_keyword: "service pricing guide",
    intent: "commercial",
  };

  const postId = await service.createArticle(CONVERSATION_ID, decision);

  assert.equal(postId, "post-1");
  assert.deepEqual(calls, ["brief", "post", "brief-link", "seo"]);
  assert.equal(saved.brief?.selectedPrimaryKeyword, "service pricing guide");
  assert.equal(saved.seo?.primaryKeyword, "service pricing guide");
  assert.deepEqual(saved.seo?.secondaryKeywords, ["service fees", "service questions"]);
  assert.equal(saved.seo?.searchIntent, "commercial");
  assert.equal(saved.seo?.targetAudience, "Decision makers");
  assert.equal(saved.seo?.articleType, "pricing");
  assert.ok(savedMetadata);
  const metadata = savedMetadata as Record<string, unknown>;
  assert.equal(metadata.topic, "Service pricing");
  assert.equal(metadata.primaryKeyword, "service pricing guide");
  assert.equal(metadata.audience, "Decision makers");
  assert.equal(metadata.articleType, "pricing");
  assert.equal(metadata.searchIntent, "commercial");
});
