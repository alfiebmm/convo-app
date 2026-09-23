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
      heading: index === 0 ? "Service pricing guide" : `Planning section ${index}`,
      blocks: [
        { type: "p" as const, text: `${prose(70)} service pricing guide` },
        { type: "p" as const, text: prose(70) },
        { type: "p" as const, text: prose(70) },
        ...(index === 3
          ? [
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
    async insertBlogPost() {
      calls.push("post");
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
    ai: { generatePost: async () => JSON.stringify(validPost()) },
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
});
