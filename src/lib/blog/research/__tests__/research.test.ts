import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildManualResearchArtifact,
  createManualResearchProvider,
  runBlogResearch,
  type ResearchArtifact,
} from "../index";

test("manual research builds a deterministic local artifact", () => {
  const artifact = buildManualResearchArtifact(
    {
      tenantId: "tenant-1",
      conversationId: "conversation-1",
      primaryKeyword: "contract spraying rates",
      secondaryKeywords: ["spraying cost per hectare", "boom spraying quote"],
      searchIntent: "commercial",
      topic: "spraying rates",
      audience: "farmers",
    },
    { now: "2026-10-15T00:00:00.000Z" },
  );

  assert.equal(artifact.provider, "manual");
  assert.equal(artifact.queriedAt, "2026-10-15T00:00:00.000Z");
  assert.equal(artifact.primaryKeyword, "contract spraying rates");
  assert.equal(artifact.keywordOpportunities.length, 3);
  assert.equal(artifact.keywordOpportunities[0].source, "conversation");
  assert.ok(artifact.relatedQuestions.some((question) => question.includes("contract spraying rates")));
  assert.ok(artifact.contentGaps.some((gap) => gap.includes("source conversation")));
});

test("manual research falls back to topic when primary keyword is missing", () => {
  const artifact = buildManualResearchArtifact({
    tenantId: "tenant-1",
    conversationId: "conversation-1",
    topic: "farm fencing quotes",
  });

  assert.equal(artifact.primaryKeyword, "farm fencing quotes");
  assert.equal(artifact.keywordOpportunities[0].keyword, "farm fencing quotes");
});

test("manual provider can return seeded fixture artifacts", async () => {
  const fixture: ResearchArtifact = {
    provider: "manual",
    queriedAt: "2026-10-15T00:00:00.000Z",
    primaryKeyword: "fixture keyword",
    searchIntent: "informational",
    keywordOpportunities: [],
    serpCompetitors: [],
    relatedQuestions: ["Fixture question?"],
    entities: [],
    contentGaps: [],
    notes: ["Fixture"],
  };

  const provider = createManualResearchProvider({
    artifactsByConversationId: {
      "conversation-1": fixture,
    },
  });

  const artifact = await provider.research({
    tenantId: "tenant-1",
    conversationId: "conversation-1",
  });

  assert.equal(artifact.primaryKeyword, "fixture keyword");
});

test("runBlogResearch defaults to the manual provider", async () => {
  const artifact = await runBlogResearch({
    input: {
      tenantId: "tenant-1",
      conversationId: "conversation-1",
      primaryKeyword: "dog grooming prices",
      searchIntent: "commercial",
    },
  });

  assert.equal(artifact.provider, "manual");
  assert.equal(artifact.searchIntent, "commercial");
});
