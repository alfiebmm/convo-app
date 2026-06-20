#!/usr/bin/env node

import {
  conversationFiltersToSearchParams,
  conversationFiltersToStorage,
  parseConversationFilters,
  parseStoredConversationFilters,
  serialiseConversationFilters,
  type ConversationFilterState,
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
      `${msg} - expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

test("conversation filters: URL-param contract round-trips all 13 filters", () => {
  const filters: ConversationFilterState = {
    "case-type": "lead",
    "follow-up": "true",
    status: "open",
    priority: "high",
    assigned: "unassigned",
    routing: "sales",
    rule: "lead-capture",
    persona: "buyer",
    "mkt-side": "supply",
    topic: "pricing",
    dest: "hubspot-main",
    delivery: "pending",
    from: "2026-06-01",
    to: "2026-06-20",
  };

  const params = conversationFiltersToSearchParams(filters);
  assertEq(
    params.toString(),
    "case-type=lead&follow-up=true&status=open&priority=high&assigned=unassigned&routing=sales&rule=lead-capture&persona=buyer&mkt-side=supply&topic=pricing&dest=hubspot-main&delivery=pending&from=2026-06-01&to=2026-06-20",
    "stable kebab-case query string"
  );

  const parsed = parseConversationFilters(params);
  assertEq(serialiseConversationFilters(parsed), params.toString(), "URL round-trip");

  const stored = conversationFiltersToStorage(parsed);
  const restored = parseStoredConversationFilters(stored);
  assertEq(
    serialiseConversationFilters(restored),
    params.toString(),
    "sessionStorage round-trip"
  );
});

if (failed > 0) {
  console.error(`${failed} failed, ${passed} passed`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`${passed} passed`);
