#!/usr/bin/env node

import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

import { ArticleDetailViewWithPublishing } from "../article-detail";
import type { BlogPostDetail } from "@/lib/blog/queries";
import type { PrePublishChecklistResult } from "@/lib/blog/pre-publish-checklist";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const POST_ID = "33333333-3333-4333-8333-333333333333";

function makePost(overrides: Partial<BlogPostDetail> = {}): BlogPostDetail {
  return {
    id: POST_ID,
    tenantId: TENANT_ID,
    threadId: null,
    title: "Understanding AgPages contractor rates",
    slug: "understanding-agpages-contractor-rates",
    content: "<p>Rendered body from the pipeline.</p>",
    metadata: {
      body_html: "<p>Article body.</p>",
      word_count: 900,
    },
    status: "draft",
    persona: "contractors",
    topic: "pricing",
    createdAt: new Date("2026-09-21T04:09:00.000Z"),
    publishedAt: null,
    lastModified: new Date("2026-09-21T04:09:00.000Z"),
    ...overrides,
  };
}

async function renderWithChecklist(
  checklist: PrePublishChecklistResult | null,
  overrides: Partial<BlogPostDetail> = {},
) {
  const post = makePost(overrides);
  const element = await ArticleDetailViewWithPublishing({
    post,
    checklist,
    wordpressSiteUrl: "https://agpages.example",
  });
  return renderToStaticMarkup(element);
}

let passed = 0;
let failed = 0;
const tests: Array<{ name: string; fn: () => Promise<void> | void }> = [];
function test(name: string, fn: () => Promise<void> | void) {
  tests.push({ name, fn });
}

test("article body does NOT contain the pre-publish checklist panel", async () => {
  const checklist: PrePublishChecklistResult = {
    ok: false,
    ranAt: "2026-09-10T00:00:00.000Z",
    items: [
      { id: "canonical_url", label: "Canonical URL", status: "fail", message: "Canonical URL is required." },
      { id: "schema_valid", label: "Post schema and JSON-LD valid", status: "fail", message: "Schema invalid." },
      { id: "word_count", label: "Word count gates", status: "pass" },
    ],
  };
  const markup = await renderWithChecklist(checklist);

  // Checklist still rendered (inside the collapsible Review checks panel).
  assert.match(markup, /Pre-publish checklist/);
  // But it is nested inside the Publishing readiness section, NOT a sibling
  // between the <article> and the publish controls.
  const readinessStart = markup.indexOf("Publishing readiness");
  const checklistStart = markup.indexOf("Pre-publish checklist");
  assert.ok(readinessStart !== -1, "readiness panel renders");
  assert.ok(checklistStart !== -1, "checklist renders inside readiness panel");
  assert.ok(
    checklistStart > readinessStart,
    "checklist sits inside the readiness section, not above it",
  );
  // Article body section ends before readiness panel starts.
  const articleStart = markup.indexOf("<article");
  assert.ok(articleStart !== -1, "article preview still renders");
  assert.ok(
    articleStart < readinessStart,
    "article preview comes before the readiness panel (preview stays clean)",
  );
});

test("renders a plain-language blocker summary for hard-blocker fails", async () => {
  const checklist: PrePublishChecklistResult = {
    ok: false,
    ranAt: "2026-09-10T00:00:00.000Z",
    items: [
      { id: "canonical_url", label: "Canonical URL", status: "fail" },
      { id: "schema_valid", label: "Post schema and JSON-LD valid", status: "fail" },
    ],
  };
  const markup = await renderWithChecklist(checklist);
  assert.match(
    markup,
    /Cannot publish yet: canonical URL missing and schema invalid\./,
  );
});

test("renders ready-to-publish state when all checks pass", async () => {
  const checklist: PrePublishChecklistResult = {
    ok: true,
    ranAt: "2026-09-10T00:00:00.000Z",
    items: [{ id: "word_count", label: "Word count gates", status: "pass" }],
  };
  const markup = await renderWithChecklist(checklist);
  assert.match(markup, /All pre-publish checks passing/);
  assert.doesNotMatch(markup, /Cannot publish yet/);
});

test("Review checks collapsible exposes passed/total count", async () => {
  const checklist: PrePublishChecklistResult = {
    ok: false,
    ranAt: "2026-09-10T00:00:00.000Z",
    items: [
      { id: "canonical_url", label: "Canonical URL", status: "fail" },
      { id: "word_count", label: "Word count gates", status: "pass" },
      { id: "slug_format", label: "Slug format", status: "pass" },
    ],
  };
  const markup = await renderWithChecklist(checklist);
  assert.match(markup, /Review checks \(2 \/ 3 passed\)/);
});

test("hard-blocker enforcement: Publish button still disabled when checklist fails", async () => {
  const checklist: PrePublishChecklistResult = {
    ok: false,
    ranAt: "2026-09-10T00:00:00.000Z",
    items: [
      { id: "canonical_url", label: "Canonical URL", status: "fail" },
    ],
  };
  const markup = await renderWithChecklist(checklist, {
    metadata: {
      body_html: "<p>Article body.</p>",
      prePublishChecklist: checklist,
    },
  });
  // Publish button rendered and disabled with failing-checks tooltip.
  assert.match(markup, /Fix 1 failing pre-publish checks before publishing/);
});

async function main() {
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`PASS ${name}`);
      passed++;
    } catch (error) {
      const message = error instanceof Error ? error.stack ?? error.message : String(error);
      console.log(`FAIL ${name}`);
      console.log(`   Error: ${message}`);
      failed++;
    }
  }

  console.log(`${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void main();
