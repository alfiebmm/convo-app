import { test } from "node:test";
import assert from "node:assert/strict";

import { generateSlug, validateSeoMetadata } from "../seo";
import type { BlogPostJson } from "../writing-rules";

function post(overrides: Partial<BlogPostJson> = {}): BlogPostJson {
  const base: BlogPostJson = {
    slug: "pharmacists-support-ongoing-care-australia",
    category: "Guide",
    title: "How pharmacists support ongoing care",
    dek: "A practical guide to medicine advice and care.",
    meta: { updated: "August 2026", readMinutes: 5 },
    seo: {
      metaTitle: "How pharmacists support ongoing care across Australia",
      metaDescription:
        "Learn how pharmacists support ongoing care, medicine reviews, side effect checks and practical health questions, with clear advice on when to contact a GP.",
      canonicalUrl: "https://chemist2u.com.au/blog/pharmacists-support-care",
      ogImage: null as unknown as string,
      authoredAt: null as unknown as string,
      modifiedAt: null as unknown as string,
      authorName: null as unknown as string,
      keywords: ["pharmacists", "ongoing care"],
    },
    hero: { url: "https://example.com/hero.jpg", alt: "Pharmacist at a counter" },
    toc: ["Medicine advice", "Side effects", "When to ask a GP"],
    intro: "Pharmacists help people understand medicines and ongoing care.",
    sections: [
      { heading: "Medicine advice", blocks: [{ type: "p", text: "Ask early." }] },
      { heading: "Side effects", blocks: [{ type: "p", text: "Check symptoms." }] },
      { heading: "GP care", blocks: [{ type: "p", text: "Escalate when needed." }] },
      { heading: "Follow-up", blocks: [{ type: "p", text: "Keep notes." }] },
    ],
    faqs: [
      { q: "Can pharmacists help?", a: "Yes." },
      { q: "Do I need an appointment?", a: "Usually not." },
      { q: "When should I see a GP?", a: "For diagnosis." },
    ],
  };

  return { ...base, ...overrides };
}

test("generateSlug strips stopwords, lowercases, hyphenates, and removes punctuation", () => {
  assert.equal(
    generateSlug("The Role of Pharmacists in Ongoing Care, with GP Support"),
    "role-pharmacists-ongoing-care-gp-support"
  );
});

test("generateSlug dedupes with numeric suffixes", () => {
  assert.equal(
    generateSlug("A guide to medicine reviews", [
      "guide-medicine-reviews",
      "guide-medicine-reviews-2",
    ]),
    "guide-medicine-reviews-3"
  );
});

test("validateSeoMetadata passes target-length metadata and clean slug", () => {
  const result = validateSeoMetadata(post());
  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);
});

test("validateSeoMetadata warns outside target ranges without failing", () => {
  const result = validateSeoMetadata(
    post({
      seo: {
        ...post().seo,
        metaTitle: "Pharmacists support safe care plans",
        metaDescription:
          "Pharmacists support safe care plans with medicine advice, side effect checks, pharmacist follow-up, safety reminders, timing guidance and clear next steps for Australian patients today.",
      },
    })
  );

  assert.equal(result.ok, true);
  assert.match(result.issues.join("\n"), /warning: metaTitle target/);
  assert.match(result.issues.join("\n"), /warning: metaDescription target/);
});

test("validateSeoMetadata fails hard length, slug, and canonical issues", () => {
  const result = validateSeoMetadata(
    post({
      slug: "the-Bad_slug!",
      seo: {
        ...post().seo,
        metaTitle: "Too short",
        metaDescription: "Short",
        canonicalUrl: "http://localhost/post",
      },
    })
  );

  assert.equal(result.ok, false);
  assert.match(result.issues.join("\n"), /error: metaTitle/);
  assert.match(result.issues.join("\n"), /error: metaDescription/);
  assert.match(result.issues.join("\n"), /lowercase, hyphenated/);
  assert.match(result.issues.join("\n"), /stopword "the"/);
  assert.match(result.issues.join("\n"), /canonicalUrl/);
});
