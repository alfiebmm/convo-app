#!/usr/bin/env node

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { EmptyContentState } from "../page";

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

test("empty state links to failed generations when hidden failed rows exist", () => {
  const markup = renderToStaticMarkup(
    React.createElement(EmptyContentState, {
      failedCount: 7,
      showFailedHref: "/dashboard/content?includeFailed=1",
    }),
  );

  assertIncludes(markup, "No published articles yet.", "new tenant copy");
  assertIncludes(markup, "7 generations", "failed generation count");
  assertIncludes(markup, "Show failed generations", "show failed link");
  assertIncludes(markup, "includeFailed=1", "shareable failed filter href");
});

test("empty state keeps default copy when no hidden failures exist", () => {
  const markup = renderToStaticMarkup(
    React.createElement(EmptyContentState, {
      failedCount: 0,
      showFailedHref: "/dashboard/content?includeFailed=1",
    }),
  );

  assertIncludes(markup, "No articles found.", "default empty copy");
});

console.log(`${passed} passed`);
if (failed > 0) process.exit(1);
