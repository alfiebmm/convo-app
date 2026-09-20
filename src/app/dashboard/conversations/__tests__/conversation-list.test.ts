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
      latestBlogDecision: null,
    },
    case: null,
  };

  const display = getConversationListItemDisplay(row);
  assertEq(display.caseType, "—", "case type placeholder");
  assertEq(display.status, "No case", "status placeholder");
  assertEq(display.priority, "—", "priority placeholder");
  assertEq(display.followUpRequired, false, "follow-up is not required");
  assertEq(display.contact, "—", "contact placeholder");
  assertEq(display.blog, "Not evaluated", "blog placeholder");
});

function rowWithDecision(
  action: string,
  linked: Partial<NonNullable<ConversationListItemRow["conversation"]["latestBlogDecision"]>> = {},
): ConversationListItemRow {
  return {
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
      latestBlogDecision: {
        action,
        reason:
          action === "failure"
            ? "Generation failure: schema validation failed"
            : "covered_by_existing_healthy_no_new_signal",
        primaryKeyword: "puppy socialisation timeline",
        intent: "educational",
        targetBlogPostId: linked.targetBlogPostId ?? null,
        selectedTargetPostId: linked.selectedTargetPostId ?? null,
        generatedBlogPostId: linked.generatedBlogPostId ?? null,
        updateDraftBlogPostId: linked.updateDraftBlogPostId ?? null,
        failureBlogPostId: linked.failureBlogPostId ?? null,
        failureReason: linked.failureReason ?? null,
        createdAt: new Date("2026-07-01T00:02:00.000Z"),
      },
    },
    case: null,
  };
}

test("conversation list: blog outcome labels are explicit", () => {
  assertEq(
    getConversationListItemDisplay(
      rowWithDecision("create", { generatedBlogPostId: "draft-1" }),
    ).blog,
    "Create",
    "create label",
  );
  assertEq(
    getConversationListItemDisplay(
      rowWithDecision("update", {
        targetBlogPostId: "article-1",
        updateDraftBlogPostId: "draft-2",
      }),
    ).blog,
    "Update",
    "update label",
  );
  assertEq(
    getConversationListItemDisplay(
      rowWithDecision("skip-covered", { targetBlogPostId: "article-1" }),
    ).blog,
    "Skip-covered",
    "skip-covered label",
  );
  assertEq(
    getConversationListItemDisplay(
      rowWithDecision("failure", {
        failureBlogPostId: "failure-1",
        failureReason: "schema validation failed",
      }),
    ).blog,
    "Generation failure",
    "failure label",
  );
});

console.log(`${passed} passed`);
if (failed > 0) process.exit(1);
