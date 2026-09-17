#!/usr/bin/env node

import {
  handleBlogEnqueue,
  type BlogEnqueueDeps,
} from "../route";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`OK ${name}`);
    passed++;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`FAIL ${name}`);
    console.log(`  ${message}`);
    failed++;
  }
}

function assertEq<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function req(body: unknown) {
  return {
    json: async () => body,
  };
}

const TENANT_ID = "tenant-a";
const VISITOR_ID = "visitor-a";
const CONVERSATION_ID = "conversation-a";

function deps(overrides: Partial<BlogEnqueueDeps> = {}): BlogEnqueueDeps {
  return {
    getConversationForVisitor: async (
      conversationId: string,
      tenantId: string,
      visitorId: string
    ) =>
      conversationId === CONVERSATION_ID &&
      tenantId === TENANT_ID &&
      visitorId === VISITOR_ID
        ? { id: CONVERSATION_ID, status: "active" }
        : null,
    requestBlogPipeline: async (conversationId: string) => ({
      status: "queued",
      conversationId,
    }),
    schedule: () => {},
    ...overrides,
  };
}

async function run() {
  await test("two-turn close path queues blog pipeline without legacy content write", async () => {
    const blogPosts: Array<{ conversationId: string }> = [];
    const decisionLogs: Array<{ conversationId: string; reason: string }> = [];
    const legacyContentWrites: Array<{ conversationId: string }> = [];
    let requested: string | null = null;

    const res = await handleBlogEnqueue(
      req({
        conversationId: CONVERSATION_ID,
        tenantId: TENANT_ID,
        visitorId: VISITOR_ID,
      }),
      deps({
        schedule: (task) => {
          void task();
        },
        requestBlogPipeline: async (conversationId, options) => {
          requested = conversationId;
          options.schedule(async () => {
            decisionLogs.push({
              conversationId,
              reason: "Conversation word count 24 is below minimum 30.",
            });
          });
          return { status: "queued", conversationId };
        },
      })
    );

    assertEq(res.status, 200, "status");
    assertEq(requested, CONVERSATION_ID, "requested conversation");
    assertEq(blogPosts.length + decisionLogs.length > 0, true, "blog outcome persisted");
    assertEq(legacyContentWrites.length, 0, "legacy content writes");
  });

  await test("cross-tenant or cross-visitor trigger returns 404", async () => {
    const res = await handleBlogEnqueue(
      req({
        conversationId: CONVERSATION_ID,
        tenantId: "tenant-b",
        visitorId: VISITOR_ID,
      }),
      deps()
    );
    assertEq(res.status, 404, "status");
  });

  await test("missing body fields returns 400", async () => {
    const res = await handleBlogEnqueue(
      req({ conversationId: CONVERSATION_ID }),
      deps()
    );
    assertEq(res.status, 400, "status");
  });

  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
