import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildEditorialBrief,
  validateEditorialBriefArticle,
  type TenantSeoStrategy,
} from "../index";

const strategy: TenantSeoStrategy = {
  tenantId: "tenant-1",
  targetKeywords: [
    { keyword: "emergency plumbing", priority: "high" },
    { keyword: "bathroom renovation", priority: "medium" },
  ],
  priorityServices: [{ name: "Leak repairs", url: "https://example.com/leaks" }],
  priorityLocations: [{ name: "Sydney" }],
  targetAudiences: [{ persona: "Homeowners", description: "People managing home maintenance" }],
  approvedInternalUrls: [
    { url: "https://example.com/leaks", label: "Leak repairs", topic: "emergency plumbing" },
  ],
  preferredCtas: [{ label: "Request a quote", url: "https://example.com/contact" }],
  avoidTopics: [],
  avoidClaims: [],
  avoidKeywords: [],
};

test("selects the best-fit tenant keyword and plans modules", () => {
  const brief = buildEditorialBrief({
    tenantId: "tenant-1",
    conversationId: "conversation-1",
    strategy,
    messages: [
      {
        role: "user",
        content: "I need emergency plumbing help for a leak in Sydney.",
      },
    ],
    decision: {
      action: "create",
      primaryKeyword: "urgent plumbing leak",
      intent: "commercial",
      reason: "Useful content signal.",
    },
  });

  assert.equal(brief.selectedPrimaryKeyword, "emergency plumbing");
  assert.equal(brief.noStrongTarget, false);
  assert.ok(brief.requiredModules.includes("internal-links"));
  assert.ok(brief.requiredModules.includes("cta"));
  assert.equal(brief.internalLinkPlan[0].url, "https://example.com/leaks");
});

test("marks noStrongTarget when tenant targets do not fit", () => {
  const brief = buildEditorialBrief({
    tenantId: "tenant-1",
    conversationId: "conversation-1",
    strategy,
    messages: [{ role: "user", content: "How do I choose office chairs?" }],
    decision: {
      action: "create",
      primaryKeyword: "office chair ergonomics",
      intent: "informational",
      reason: "Weak tenant fit.",
    },
  });

  assert.equal(brief.selectedPrimaryKeyword, "office chair ergonomics");
  assert.equal(brief.noStrongTarget, true);
  assert.equal(brief.needsReview, true);
});

test("validates keyword placement, density, CTA, and internal links", () => {
  const brief = buildEditorialBrief({
    tenantId: "tenant-1",
    conversationId: "conversation-1",
    strategy,
    messages: [
      { role: "user", content: "I need emergency plumbing help for a leak." },
    ],
    decision: {
      action: "create",
      primaryKeyword: "emergency plumbing",
      intent: "commercial",
      reason: "Useful content signal.",
    },
  });

  const ok = validateEditorialBriefArticle({
    brief,
    article: {
      title: "Emergency plumbing help for water leaks",
      intro: "Emergency plumbing support can help when a leak needs prompt attention.",
      sections: [{ heading: "Emergency plumbing checklist" }],
      content:
        "Emergency plumbing support can help when a leak needs prompt attention. " +
        "Read more at https://example.com/leaks and Request a quote for help. " +
        Array.from({ length: 120 }, () => "useful").join(" "),
    },
  });

  assert.deepEqual(ok, []);

  const stuffed = validateEditorialBriefArticle({
    brief,
    article: {
      title: "Emergency plumbing help",
      intro: "Emergency plumbing support.",
      sections: [{ heading: "Emergency plumbing checklist" }],
      content: Array.from({ length: 20 }, () => "emergency plumbing").join(" "),
    },
  });

  assert.ok(stuffed.some((issue) => issue.code === "primary_keyword_density"));
});
