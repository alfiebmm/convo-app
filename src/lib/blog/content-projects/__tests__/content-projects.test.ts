import { test } from "node:test";
import assert from "node:assert/strict";

import {
  deriveContentProjectState,
  missingContentProjectArtifacts,
  toContentProjectReadModel,
  type ContentProjectBlogPost,
  type ContentProjectDecisionLog,
  type ContentProjectEditorialBrief,
} from "../index";

const decision: ContentProjectDecisionLog = {
  id: "decision-1",
  tenantId: "tenant-1",
  conversationId: "conversation-1",
  action: "create",
  reason: "Strong customer question.",
  primaryKeyword: "contract spraying rates",
  intent: "commercial",
  metadata: {
    research: {
      provider: "manual",
      relatedQuestions: ["How much does spraying cost?"],
    },
  },
  createdAt: "2026-10-15T00:00:00.000Z",
};

const brief: ContentProjectEditorialBrief = {
  id: "brief-1",
  tenantId: "tenant-1",
  conversationId: "conversation-1",
  selectedPrimaryKeyword: "contract spraying rates",
  needsReview: false,
  noStrongTarget: false,
  requiredModules: ["quick-answer", "cta"],
};

const post: ContentProjectBlogPost = {
  id: "post-1",
  tenantId: "tenant-1",
  threadId: "conversation-1",
  title: "Contract spraying rates guide",
  slug: "contract-spraying-rates-guide",
  status: "in_review",
  metadata: {
    qualityGate: {
      status: "passed",
    },
  },
  topic: "contract spraying rates",
  persona: "farmer",
  lastModified: "2026-10-15T00:10:00.000Z",
};

test("maps a generated review draft to review_ready", () => {
  const project = toContentProjectReadModel({
    tenantId: "tenant-1",
    conversationId: "conversation-1",
    blogPost: post,
    latestDecision: decision,
    editorialBrief: brief,
  });

  assert.equal(project.id, "post-1");
  assert.equal(project.lifecycleState, "review_ready");
  assert.equal(project.primaryKeyword, "contract spraying rates");
  assert.equal(project.needsReview, false);
  assert.deepEqual(project.missingArtifacts, ["publish_export"]);
});

test("uses explicit metadata lifecycle state for future pipeline phases", () => {
  assert.equal(
    deriveContentProjectState({
      blogPost: {
        ...post,
        metadata: {
          contentProject: {
            lifecycleState: "optimization_pass",
          },
        },
      },
      latestDecision: decision,
      editorialBrief: brief,
    }),
    "optimization_pass",
  );
});

test("maps skipped decisions without drafts to skipped", () => {
  const project = toContentProjectReadModel({
    tenantId: "tenant-1",
    latestDecision: {
      ...decision,
      action: "skip-covered",
      reason: "Existing article already covers this.",
    },
  });

  assert.equal(project.lifecycleState, "skipped");
  assert.equal(project.blogPostId, null);
  assert.equal(project.title, "Content project: contract spraying rates");
});

test("maps failed generation and exposes failure reason", () => {
  const project = toContentProjectReadModel({
    tenantId: "tenant-1",
    blogPost: {
      ...post,
      status: "generation_failed",
      metadata: {},
    },
    latestDecision: {
      ...decision,
      action: "failure",
      failureReason: "Required module missing.",
    },
    editorialBrief: brief,
  });

  assert.equal(project.lifecycleState, "failed");
  assert.equal(project.needsReview, true);
  assert.equal(project.failureReason, "Required module missing.");
});

test("reports missing artifacts for early candidates", () => {
  assert.deepEqual(
    missingContentProjectArtifacts({
      latestDecision: null,
      editorialBrief: null,
      blogPost: null,
    }),
    ["decision", "research", "brief", "draft"],
  );
});
