#!/usr/bin/env node

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  BLOG_POST_STATUS_DISPLAY,
  BlogPostStatusPill,
} from "../content-list";
import type { BlogPostStatus } from "@/lib/blog/queries";

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
      published: { label: "Published", className: "bg-blue-100 text-blue-800" },
      rejected: { label: "Rejected", className: "bg-red-100 text-red-800" },
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

console.log(`${passed} passed`);
if (failed > 0) process.exit(1);
