import assert from "node:assert/strict";
import { test } from "node:test";

import {
  groundingViolation,
  validateGrounding,
  type TenantEvidenceInput,
} from "../grounding";
import postFixture from "../schemas/post.example.chemist2u.json";
import type { BlogPostJson } from "../writing-rules";
import agpagesFixture from "./fixtures/agpages-grounding.json";
import nonAgpagesFixture from "./fixtures/non-agpages-grounding.json";

function postWithText(sentences: string[]): BlogPostJson {
  const post = structuredClone(postFixture) as BlogPostJson;
  post.title = "Understanding AgPages contractor rates";
  post.dek = "A grounded guide to contractor rates and quote requests.";
  post.intro = sentences[0] ?? "Use tenant evidence before making product claims.";
  post.sections = [
    {
      heading: "Understanding AgPages contractor rates",
      blocks: sentences.map((text) => ({ type: "p" as const, text })),
    },
  ];
  post.faqs = [
    {
      q: "What should readers do next?",
      a: "Request a quote using the available tenant contact path.",
    },
    {
      q: "Are rate ranges verified?",
      a: "The source material does not include verified rate ranges.",
    },
    {
      q: "What changes a quote?",
      a: "Scope, location, timing, access and machinery needs can change a quote.",
    },
  ];
  post.seo = {
    ...post.seo,
    keywords: ["AgPages contractor rates"],
    metaTitle: "Understanding AgPages contractor rates",
    metaDescription: sentences.join(" ").slice(0, 150),
  };
  return post;
}

function evidenceFromFixture(fixture: {
  tenant: TenantEvidenceInput["tenant"];
  sourceMessages: Array<{ role?: string; content: string | null }>;
}): TenantEvidenceInput {
  return {
    tenant: fixture.tenant,
    sourceMessages: fixture.sourceMessages,
  };
}

test("AgPages hallucinated reviews, forums, webinars, payments and contracts fail grounding", () => {
  const report = validateGrounding(
    postWithText(agpagesFixture.unsupportedSentences),
    evidenceFromFixture(agpagesFixture),
  );

  assert.equal(report.ok, false);
  assert.equal(report.needsReview, true);
  assert.deepEqual(
    Array.from(new Set(report.claims
      .filter((claim) => claim.decision === "unsupported")
      .map((claim) => claim.category))),
    [
      "reviews_ratings",
      "forums_discussions",
      "webinars_training",
      "payments_contracts",
    ],
  );
  assert.match(groundingViolation(report)?.message ?? "", /Unsupported tenant product claim/);
});

test("AgPages repaired rates copy passes once unsupported product claims are removed", () => {
  const report = validateGrounding(
    postWithText(agpagesFixture.repairedSentences),
    evidenceFromFixture(agpagesFixture),
  );

  assert.equal(report.ok, true);
  assert.equal(report.claims.length, 0);
});

test("grounding validation is tenant-agnostic for non-AgPages product claims", () => {
  const unsupported = validateGrounding(
    postWithText([nonAgpagesFixture.unsupportedSentence]),
    evidenceFromFixture(nonAgpagesFixture),
  );
  const supported = validateGrounding(
    postWithText([nonAgpagesFixture.supportedSentence]),
    evidenceFromFixture(nonAgpagesFixture),
  );

  assert.equal(unsupported.ok, false);
  assert.deepEqual(
    Array.from(new Set(unsupported.claims
      .filter((claim) => claim.decision === "unsupported")
      .map((claim) => claim.category))),
    ["booking_scheduling", "rewards_loyalty"],
  );
  assert.equal(supported.ok, true);
});
