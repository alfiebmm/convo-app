#!/usr/bin/env node

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  BLOG_POST_STATUS_DISPLAY,
  BlogPostContentTypePill,
  BlogPostStatusPill,
  FailedGenerationFilterChip,
} from "../content-list";
import type { BlogPostListItem, BlogPostStatus } from "@/lib/blog/queries";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS ${name}`);
    passed++;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`FAIL ${name}`);
    console.log(`   Error: ${message}`);
    failed++;
  }
}

function assertIncludes(actual: string, expected: string, msg: string) {
  if (!actual.includes(expected)) {
    throw new Error(`${msg} - expected markup to include ${expected}`);
  }
}

test("content status pill renders the required colour mapping", () => {
  const expectations: Record<BlogPostStatus, { label: string; className: string }> =
    {
      draft: { label: "Draft", className: "bg-slate-100 text-slate-700" },
      in_review: {
        label: "In Review",
        className: "bg-amber-100 text-amber-800",
      },
      approved: { label: "Approved", className: "bg-green-100 text-green-800" },
      publishing: {
        label: "Publishing",
        className: "bg-orange-100 text-orange-800",
      },
      published: { label: "Published", className: "bg-blue-100 text-blue-800" },
      publish_failed: {
        label: "Publish failed",
        className: "bg-red-100 text-red-800",
      },
      rejected: { label: "Rejected", className: "bg-red-100 text-red-800" },
      generation_failed: {
        label: "Generation failed",
        className: "bg-red-100 text-red-800",
      },
      update_pending: {
        label: "Update pending",
        className: "bg-amber-100 text-amber-800",
      },
    };

  for (const [status, expectation] of Object.entries(expectations) as Array<
    [BlogPostStatus, { label: string; className: string }]
  >) {
    const display = BLOG_POST_STATUS_DISPLAY[status];
    const markup = renderToStaticMarkup(
      React.createElement(BlogPostStatusPill, { status }),
    );
    assertIncludes(display.className, expectation.className, `${status} class`);
    assertIncludes(markup, expectation.className, `${status} markup class`);
    assertIncludes(markup, expectation.label, `${status} label`);
  }
});

test("failed generation filter chip renders count and inactive label", () => {
  const markup = renderToStaticMarkup(
    React.createElement(FailedGenerationFilterChip, {
      includeFailed: false,
      failedCount: 34,
    }),
  );

  assertIncludes(markup, "Include failed generations", "inactive label");
  assertIncludes(markup, "Generation failed", "status pill");
  assertIncludes(markup, "34 archived", "archived count");
});

test("failed generation filter chip renders active label", () => {
  const markup = renderToStaticMarkup(
    React.createElement(FailedGenerationFilterChip, {
      includeFailed: true,
      failedCount: 42,
    }),
  );

  assertIncludes(markup, "Hiding failed generations", "active label");
  assertIncludes(markup, "42 archived", "active count");
});

function postWithType(
  contentType: BlogPostListItem["contentType"],
  updateOf: string | null = null,
): BlogPostListItem {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Choosing the right puppy class",
    topic: "Puppy training",
    persona: "New dog owner",
    wordCount: 875,
    status: contentType === "generation_failure" ? "generation_failed" : "draft",
    contentType,
    updateOf,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
  };
}

test("content type pill labels new article, update draft, and generation failure", () => {
  const newMarkup = renderToStaticMarkup(
    React.createElement(BlogPostContentTypePill, {
      post: postWithType("new_article"),
    }),
  );
  const updateMarkup = renderToStaticMarkup(
    React.createElement(BlogPostContentTypePill, {
      post: postWithType("update_draft", "22222222-2222-4222-8222-222222222222"),
    }),
  );
  const failureMarkup = renderToStaticMarkup(
    React.createElement(BlogPostContentTypePill, {
      post: postWithType("generation_failure"),
    }),
  );

  assertIncludes(newMarkup, "New article", "new article label");
  assertIncludes(updateMarkup, "Update draft", "update draft label");
  assertIncludes(failureMarkup, "Generation failure", "failure label");
});

console.log(`${passed} passed`);
if (failed > 0) process.exit(1);
