#!/usr/bin/env node

import type { ConversationListItemRow } from "@/lib/cases";
import { getConversationListItemDisplay } from "../conversation-list";

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

function assertEq<T>(actual: T, expected: T, msg: string) {
  if (actual !== expected) {
    throw new Error(
      `${msg} - expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

test("conversation list: no-case row maps to placeholder display values", () => {
  const row: ConversationListItemRow = {
    conversation: {
      id: "11111111-1111-4111-8111-111111111111",
      tenantId: "22222222-2222-4222-8222-222222222222",
      status: "active",
      visitorId: null,
      messageCount: 2,
      startedAt: new Date("2026-07-01T00:00:00.000Z"),
      latestMessageAt: new Date("2026-07-01T00:01:00.000Z"),
      latestCaseEventAt: null,
      lastActivityAt: new Date("2026-07-01T00:01:00.000Z"),
    },
    case: null,
  };

  const display = getConversationListItemDisplay(row);
  assertEq(display.caseType, "—", "case type placeholder");
  assertEq(display.status, "No case", "status placeholder");
  assertEq(display.priority, "—", "priority placeholder");
  assertEq(display.followUpRequired, false, "follow-up is not required");
  assertEq(display.contact, "—", "contact placeholder");
});

console.log(`${passed} passed`);
if (failed > 0) process.exit(1);
