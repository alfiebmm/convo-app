import assert from "node:assert/strict";
import { test } from "node:test";

import { supportedSchemaTypes } from "../jsonld-spec";
import { validateJsonLd } from "../jsonld-validator";

function validArticle(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Safe puppy socialisation timeline",
    image: ["https://example.com/hero.jpg"],
    datePublished: "2026-08-19",
    dateModified: "2026-08-19T10:00:00+10:00",
    author: { "@type": "Person", name: "Avery Hill", url: "https://example.com/authors/avery" },
    publisher: {
      "@type": "Organization",
      name: "Doggo",
      url: "https://example.com",
      logo: { "@type": "ImageObject", url: "https://example.com/logo.png" },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": "https://example.com/blog/puppies" },
    ...overrides,
  };
}

test("valid Article JSON-LD passes without issues", () => {
  assert.deepEqual(validateJsonLd(validArticle()), { ok: true, issues: [] });
});

test("Article missing headline returns the required-field error", () => {
  const jsonLd = validArticle({ headline: undefined });
  const result = validateJsonLd(jsonLd);

  assert.equal(result.ok, false);
  assert.deepEqual(result.issues[0], {
    severity: "error",
    path: "Article.headline",
    message: "Required field missing",
    field: "headline",
  });
});

test("Article with invalid datePublished returns a type error", () => {
  const result = validateJsonLd(validArticle({ datePublished: "not a date" }));

  assert.equal(result.ok, false);
  assert.equal(result.issues[0]?.path, "Article.datePublished");
  assert.equal(result.issues[0]?.message, "Field must be an ISO-8601 date");
});

test("invalid @type returns an unknown schema type error", () => {
  const result = validateJsonLd({ "@context": "https://schema.org", "@type": "Recipe" });

  assert.equal(result.ok, false);
  assert.deepEqual(result.issues[0], {
    severity: "error",
    path: "@type",
    message: "Unknown schema type: Recipe",
    field: "@type",
  });
});

test("nested @graph validates each supported schema node", () => {
  const result = validateJsonLd({
    "@context": "https://schema.org",
    "@graph": [
      validArticle(),
      {
        "@type": "Organization",
        name: "Doggo",
        url: "https://example.com",
        logo: { "@type": "ImageObject", url: "http://example.com/logo.png" },
      },
    ],
  });

  assert.equal(result.ok, false);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0]?.path, "@graph[1].Organization.logo");
});

test("root arrays validate each JSON-LD object", () => {
  const result = validateJsonLd([
    validArticle(),
    { "@type": "Person", name: "Avery Hill", url: "ftp://example.com/avery" },
  ]);

  assert.equal(result.ok, false);
  assert.equal(result.issues[0]?.path, "[1].Person.url");
  assert.equal(result.issues[0]?.message, "Field must be an absolute HTTPS URL");
});

test("NewsArticle validates with Article-style requirements", () => {
  const result = validateJsonLd(validArticle({ "@type": "NewsArticle" }));

  assert.deepEqual(result, { ok: true, issues: [] });
});

test("BlogPosting validates with Article-style requirements", () => {
  const result = validateJsonLd(validArticle({ "@type": "BlogPosting" }));

  assert.deepEqual(result, { ok: true, issues: [] });
});

test("FAQPage validates question and answer structure", () => {
  const result = validateJsonLd({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "When can puppies socialise?",
        acceptedAnswer: { "@type": "Answer", text: "Ask your vet." },
      },
    ],
  });

  assert.deepEqual(result, { ok: true, issues: [] });
});

test("FAQPage reports missing accepted answer text", () => {
  const result = validateJsonLd({
    "@type": "FAQPage",
    mainEntity: [{ "@type": "Question", name: "When can puppies socialise?" }],
  });

  assert.equal(result.ok, false);
  assert.equal(result.issues[0]?.path, "FAQPage.mainEntity.acceptedAnswer.text");
  assert.equal(result.issues[0]?.message, "Required field missing");
});

test("QAPage validates accepted answer", () => {
  const result = validateJsonLd({
    "@context": "https://schema.org",
    "@type": "QAPage",
    mainEntity: {
      "@type": "Question",
      name: "How do I train recall?",
      acceptedAnswer: { "@type": "Answer", text: "Start indoors with high-value rewards." },
    },
  });

  assert.deepEqual(result, { ok: true, issues: [] });
});

test("HowTo validates step arrays", () => {
  const result = validateJsonLd({
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to introduce a puppy lead",
    image: { "@type": "ImageObject", url: "https://example.com/lead.jpg" },
    step: [
      { "@type": "HowToStep", name: "Clip the lead", text: "Reward calm standing." },
      { "@type": "HowToStep", name: "Take one step", text: "Reward again." },
    ],
  });

  assert.deepEqual(result, { ok: true, issues: [] });
});

test("WebPage validates name and HTTPS URL", () => {
  const result = validateJsonLd({
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Puppy guide",
    url: "https://example.com/blog/puppy-guide",
  });

  assert.deepEqual(result, { ok: true, issues: [] });
});

test("Organization validates name and HTTPS URL", () => {
  const result = validateJsonLd({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Doggo",
    url: "https://example.com",
    logo: "https://example.com/logo.png",
  });

  assert.deepEqual(result, { ok: true, issues: [] });
});

test("Person validates name and HTTPS URL", () => {
  const result = validateJsonLd({
    "@context": "https://schema.org",
    "@type": "Person",
    name: "Avery Hill",
    url: "https://example.com/authors/avery",
    image: "https://example.com/avery.jpg",
  });

  assert.deepEqual(result, { ok: true, issues: [] });
});

test("ImageObject validates url", () => {
  const result = validateJsonLd({
    "@context": "https://schema.org",
    "@type": "ImageObject",
    url: "https://example.com/image.jpg",
  });

  assert.deepEqual(result, { ok: true, issues: [] });
});

test("all ten supported schema types are covered by the spec export", () => {
  assert.deepEqual(supportedSchemaTypes, [
    "Article",
    "NewsArticle",
    "BlogPosting",
    "QAPage",
    "HowTo",
    "FAQPage",
    "WebPage",
    "Organization",
    "Person",
    "ImageObject",
  ]);
});

test("HTTP image URLs fail type validation", () => {
  const result = validateJsonLd(validArticle({ image: ["http://example.com/hero.jpg"] }));

  assert.equal(result.ok, false);
  assert.equal(result.issues[0]?.path, "Article.image");
  assert.equal(result.issues[0]?.message, "Field must be an ImageObject or absolute HTTPS URL");
});
