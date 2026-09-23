import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

import brandFixture from "../schemas/brand.example.chemist2u.json";
import postFixture from "../schemas/post.example.chemist2u.json";
import type { BlogPostJson } from "../writing-rules";

const require = createRequire(import.meta.url);
const { renderSemantic } = require("../template-pack/renderer.js") as {
  renderSemantic: (params: {
    brand: Record<string, unknown>;
    post: BlogPostJson;
  }) => string;
};

function semanticHtml() {
  return renderSemantic({
    brand: brandFixture as Record<string, unknown>,
    post: postFixture as BlogPostJson,
  });
}

function countMatches(html: string, pattern: RegExp) {
  return Array.from(html.matchAll(pattern)).length;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

test("renderSemantic emits destination-theme semantic HTML without Convo chrome", () => {
  const html = semanticHtml();

  assert.doesNotMatch(html, /<style\b/i);
  assert.doesNotMatch(html, /\sclass=/i);
  assert.doesNotMatch(html, /\sstyle=/i);
  assert.doesNotMatch(html, /gh-blog-/i);
  assert.match(html, /<script type="application\/ld\+json">/);
  assert.match(html, /"@type": "Article"/);
  assert.match(html, /"@type": "FAQPage"/);
  assert.doesNotMatch(html, /<header\b|<footer\b|<nav\b|<details\b|<div\b/i);
});

test("renderSemantic preserves fixture structure", () => {
  const html = semanticHtml();

  assert.match(html, new RegExp(`<h1>${postFixture.title}</h1>`));
  assert.match(
    html,
    new RegExp(`<p>${escapeHtml(postFixture.intro).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</p>`),
  );

  for (const section of postFixture.sections) {
    assert.match(
      html,
      new RegExp(`<h2>${escapeHtml(section.heading).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</h2>`),
    );
  }

  assert.equal(countMatches(html, /<ul>/g), 6);
  assert.equal(countMatches(html, /<ol>/g), 0);
  assert.equal(countMatches(html, /<blockquote>/g), 1);
  assert.equal(countMatches(html, /<figure>/g), 1);
});

test("renderSemantic emits portable rates modules", () => {
  const post = structuredClone(postFixture) as BlogPostJson;
  post.sections[0].blocks.unshift({
    type: "quickAnswer",
    heading: "Quick answer",
    body: "Verified ranges are not available.",
  });
  post.sections[0].blocks.push({
    type: "table",
    caption: "Indicative comparison",
    headers: ["Service", "Driver"],
    rows: [["Spraying", "Area and travel"]],
  });
  post.sections[0].blocks.push({
    type: "checklist",
    items: ["Share timing", "Confirm access"],
  });
  post.sections[0].blocks.push({
    type: "noRateDataFallback",
    text: "We do not yet have verified rate data for this service.",
  });

  const html = renderSemantic({
    brand: brandFixture as Record<string, unknown>,
    post,
  });

  assert.match(html, /<aside class="quick-answer">/);
  assert.match(html, /<table>/);
  assert.match(html, /<caption>Indicative comparison<\/caption>/);
  assert.match(html, /<ul class="checklist">/);
  assert.match(html, /<p data-fallback="no-rate-data">/);
});

test("renderSemantic chemist2u snapshot starts with readable JSON-LD and article body", () => {
  const snapshot = semanticHtml().split("\n").slice(0, 33).join("\n");

  assert.equal(
    snapshot,
    `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "The role of pharmacists in ongoing care",
  "description": "Australian pharmacists are clinically trained specialists in medicines. Here's what they can advise on, when to ask them versus your GP, and how a medication review works.",
  "image": [
    "https://seo-v2.c2u-lp-staging.pages.dev/assets/hero-the-role-of-pharmacists-in-ongoing-care.jpg"
  ],
  "author": {
    "@type": "Organization",
    "name": "Chemist2U"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Chemist2U",
    "logo": {
      "@type": "ImageObject",
      "url": "https://chemist2u.com.au/wp-content/uploads/2023/07/chemist2u-logo.svg"
    }
  },
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://chemist2u.com.au/the-role-of-pharmacists-in-ongoing-care/"
  },
  "datePublished": "2026-05-12",
  "dateModified": "2026-05-12"
}
</script>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",`,
  );
});
