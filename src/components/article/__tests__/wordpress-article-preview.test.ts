import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { BlogPostDetail } from "@/lib/blog/queries";
import { WordPressArticlePreview } from "../wordpress-article-preview";

function makePost(): BlogPostDetail {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    tenantId: "11111111-1111-4111-8111-111111111111",
    threadId: null,
    title: "Best rural directories for Australian suppliers",
    slug: "best-rural-directories",
    content: "",
    contentSemantic: null,
    metadata: {
      dek: "A practical guide to choosing useful directories for regional suppliers.",
      meta: { updated: "Oct 2026", readMinutes: 7 },
      hero: {
        url: "https://agpages.example/hero.jpg",
        alt: "A rural supplier checking a listing on a tablet.",
      },
    },
    status: "draft",
    persona: "regional suppliers",
    topic: "Supplier directories",
    createdAt: new Date("2026-10-02T00:00:00.000Z"),
    publishedAt: null,
    lastModified: new Date("2026-10-02T00:00:00.000Z"),
  };
}

const publishHtml = `
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","publisher":{"@type":"Organization","name":"AgPages","logo":{"@type":"ImageObject","url":"https://agpages.example/logo.png"}}}</script>
<h1>Best rural directories for Australian suppliers</h1>
<p>A practical guide to choosing useful directories for regional suppliers.</p>
<figure><img src="https://agpages.example/hero.jpg" alt="A rural supplier checking a listing on a tablet." /></figure>
<p>Use this guide to compare visibility, audience quality and enquiry paths.</p>
<h2>Compare directory options</h2>
<table><caption>Directory fit</caption><thead><tr><th scope="col">Directory</th><th scope="col">Best for</th></tr></thead><tbody><tr><td>AgPages</td><td>Regional suppliers</td></tr></tbody></table>
<aside class="quick-answer"><h3>Quick answer</h3><p>Choose directories with category pages, buyer intent and clear contact paths.</p></aside>
<p><strong><a href="/contact">Book a listing review &rarr;</a></strong></p>
<h2>FAQ</h2>
<h3>Do directory listings help local suppliers?</h3>
<p>They can help when the directory has relevant buyer traffic.</p>
<h2>Related</h2>
<ul><li><a href="/guides/supplier-profile">Improve your supplier profile</a></li></ul>
`;

test("renders constrained brand logo and 16:9 hero crop", () => {
  const markup = renderToStaticMarkup(
    React.createElement(WordPressArticlePreview, {
      post: makePost(),
      tenantName: "AgPages",
      publishHtml,
      brandJson: {
        name: "AgPages",
        logo: {
          url: "https://agpages.example/agpages-854x274.png",
          alt: "AgPages",
        },
      },
    }),
  );

  assert.match(markup, /max-h-12 w-auto max-w-full object-contain/);
  assert.match(markup, /aspect-\[16\/9\]/);
  assert.match(markup, /h-full w-full object-cover/);
});

test("renders WordPress preview modules from publishable HTML", () => {
  const markup = renderToStaticMarkup(
    React.createElement(WordPressArticlePreview, {
      post: makePost(),
      tenantName: "AgPages",
      publishHtml,
      brandJson: { name: "AgPages" },
    }),
  );

  assert.match(markup, /WordPress-style preview/);
  assert.match(markup, /Compare directory options/);
  assert.match(markup, /<table>/);
  assert.match(markup, /quick-answer/);
  assert.match(markup, /Book a listing review/);
  assert.match(markup, /Do directory listings help local suppliers/);
  assert.match(markup, /Improve your supplier profile/);
  assert.doesNotMatch(markup, /<script/);
});
