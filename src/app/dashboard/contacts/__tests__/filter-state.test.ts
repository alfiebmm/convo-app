#!/usr/bin/env node

import {
  contactFiltersToSearchParams,
  contactFiltersToStorage,
  parseContactFilters,
  parseStoredContactFilters,
  serialiseContactFilters,
  type ContactFilterState,
} from "../filter-state";

let passed = 0;
let failed = 0;
const failures: string[] = [];

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
    failures.push(`${name}: ${message}`);
  }
}

function assertEq<T>(actual: T, expected: T, msg: string) {
  if (actual !== expected) {
    throw new Error(
      `${msg} - expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

test("contact filters: URL-param contract round-trips all filters", () => {
  const filters: ContactFilterState = {
    q: "alice",
    persona: "buyer",
    "mkt-side": "demand",
    "case-type": "lead",
    "case-status": "open",
    from: "2026-06-01",
    to: "2026-06-20",
    page: "2",
    sort: "name-asc",
  };

  const params = contactFiltersToSearchParams(filters);
  assertEq(
    params.toString(),
    "q=alice&persona=buyer&mkt-side=demand&case-type=lead&case-status=open&from=2026-06-01&to=2026-06-20&page=2&sort=name-asc",
    "stable kebab-case query string",
  );

  const parsed = parseContactFilters(params);
  assertEq(
    serialiseContactFilters(parsed),
    params.toString(),
    "URL round-trip",
  );

  const stored = contactFiltersToStorage(parsed);
  const restored = parseStoredContactFilters(stored);
  assertEq(
    serialiseContactFilters(restored),
    params.toString(),
    "sessionStorage round-trip",
  );
});

test("contact filters: invalid page and sort are dropped", () => {
  const parsed = parseContactFilters(
    new URLSearchParams("page=0&sort=updated-desc&q=alice"),
  );
  assertEq(
    serialiseContactFilters(parsed),
    "q=alice",
    "invalid controls dropped",
  );
});

if (failed > 0) {
  console.error(`${failed} failed, ${passed} passed`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`${passed} passed`);
