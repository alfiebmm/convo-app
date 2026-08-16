#!/usr/bin/env node

import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ArticleDetailView } from "../article-detail";
import {
  getBlogPostByIdForTenant,
  type BlogPostDetail,
  type BlogPostStatus,
  type BlogPostsSupabaseClient,
} from "@/lib/blog/queries";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_TENANT_ID = "22222222-2222-4222-8222-222222222222";
const POST_ID = "33333333-3333-4333-8333-333333333333";

let passed = 0;
let failed = 0;
const tests: Array<{ name: string; fn: () => void | Promise<void> }> = [];

function test(name: string, fn: () => void | Promise<void>) {
  tests.push({ name, fn });
}

function makePost(overrides: Partial<BlogPostDetail> = {}): BlogPostDetail {
  return {
    id: POST_ID,
    tenantId: TENANT_ID,
    threadId: "44444444-4444-4444-8444-444444444444",
    title: "How pharmacists support ongoing care",
    slug: "how-pharmacists-support-ongoing-care",
    content: "<p>Rendered body from the pipeline.</p>",
    metadata: {
      body_html: '<p>Article body <a href="https://example.com/path">external</a></p>',
      word_count: 856,
      decision: {
        primary_keyword: "pharmacists",
        intent: "educational",
        similar_posts: [{ title: "Medication reviews", score: 0.8123 }],
      },
      seo: {
        metaDescription: "A practical guide to pharmacist support.",
        canonicalUrl: "https://chemist2u.com.au/pharmacists/",
        ogImage: "https://chemist2u.com.au/og.jpg",
      },
      json_ld: '{"@type":"Article","headline":"How pharmacists support ongoing care"}',
    },
    status: "draft",
    persona: "pharmacists",
    topic: "educational",
    createdAt: new Date("2026-08-15T04:09:00.000Z"),
    publishedAt: null,
    lastModified: new Date("2026-08-15T04:09:00.000Z"),
    ...overrides,
  };
}

async function renderArticle(post: BlogPostDetail) {
  const element = await ArticleDetailView({ post });
  return renderToStaticMarkup(element);
}

function makeSupabase(rows: BlogPostDetail[]) {
  const filters: Array<[string, string]> = [];

  return {
    filters,
    client: {
      from(table: "blog_posts") {
        assert.equal(table, "blog_posts");
        return {
          select() {
            return {
              eq(column: string, value: string) {
                filters.push([column, value]);
                return this;
              },
              maybeSingle() {
                const tenantId = filters.find(([column]) => column === "tenant_id")?.[1];
                const postId = filters.find(([column]) => column === "id")?.[1];
                const row = rows.find(
                  (candidate) =>
                    candidate.id === postId && candidate.tenantId === tenantId,
                );

                return Promise.resolve({
                  data: row
                    ? {
                        id: row.id,
                        tenant_id: row.tenantId,
                        thread_id: row.threadId,
                        title: row.title,
                        slug: row.slug,
                        content: row.content,
                        metadata: row.metadata,
                        status: row.status as BlogPostStatus,
                        persona: row.persona,
                        topic: row.topic,
                        created_at: row.createdAt.toISOString(),
                        published_at: row.publishedAt?.toISOString() ?? null,
                        last_modified: row.lastModified.toISOString(),
                      }
                    : null,
                  error: null,
                });
              },
            };
          },
        };
      },
    },
  };
}

test("renders success state with title and body", async () => {
  const markup = await renderArticle(makePost());

  assert.match(markup, /How pharmacists support ongoing care/);
  assert.match(markup, /Article body/);
  assert.match(markup, /rel="noopener noreferrer"/);
  assert.match(markup, /View source conversation/);
  assert.match(markup, /Medication reviews/);
});

test("renders failure banner with generation failure reason", async () => {
  const markup = await renderArticle(
    makePost({
      status: "generation_failed",
      content: "",
      metadata: {
        generation_failure: {
          reason: "Schema validation failed: missing intro.",
          failedAt: "2026-08-15T04:09:00.000Z",
          decision: {
            primary_keyword: "pharmacists",
            intent: "educational",
            log_id: "log-123",
          },
        },
      },
    }),
  );

  assert.match(markup, /Article generation failed/);
  assert.match(markup, /Schema validation failed: missing intro/);
  assert.match(markup, /log-123/);
  assert.doesNotMatch(markup, /Approve/);
});

test("returns null for 404 when tenant scope mismatches", async () => {
  const supabase = makeSupabase([makePost()]);

  const result = await getBlogPostByIdForTenant({
    supabase: supabase.client as unknown as BlogPostsSupabaseClient,
    tenantId: OTHER_TENANT_ID,
    postId: POST_ID,
  });

  assert.equal(result, null);
});

test("tenant scope is enforced in the detail query", async () => {
  const supabase = makeSupabase([makePost()]);

  await getBlogPostByIdForTenant({
    supabase: supabase.client as unknown as BlogPostsSupabaseClient,
    tenantId: TENANT_ID,
    postId: POST_ID,
  });

  assert.deepEqual(supabase.filters, [
    ["tenant_id", TENANT_ID],
    ["id", POST_ID],
  ]);
});

async function main() {
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`PASS ${name}`);
      passed++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`FAIL ${name}`);
      console.log(`   Error: ${message}`);
      failed++;
    }
  }

  console.log(`${passed} passed`);
  if (failed > 0) process.exit(1);
}

void main();
