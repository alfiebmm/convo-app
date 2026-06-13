#!/usr/bin/env node

import {
  handlePipelineTrigger,
  type PipelineTriggerDeps,
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

function deps(
  overrides: Partial<PipelineTriggerDeps> = {}
): PipelineTriggerDeps {
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
    processConversation: async (conversationId: string) => ({
      success: true,
      conversationId,
    }),
    ...overrides,
  };
}

async function readJson(res: Response) {
  return JSON.parse(await res.text());
}

async function run() {
  await test("missing tenantId or visitorId returns 400", async () => {
    const res = await handlePipelineTrigger(
      req({ conversationId: CONVERSATION_ID }),
      deps()
    );
    assertEq(res.status, 400, "status");
  });

  await test("cross-tenant or cross-visitor trigger returns 404", async () => {
    const res = await handlePipelineTrigger(
      req({
        conversationId: CONVERSATION_ID,
        tenantId: "tenant-b",
        visitorId: VISITOR_ID,
      }),
      deps()
    );
    assertEq(res.status, 404, "status");
  });

  await test("completed conversation returns idempotent 200", async () => {
    const res = await handlePipelineTrigger(
      req({
        conversationId: CONVERSATION_ID,
        tenantId: TENANT_ID,
        visitorId: VISITOR_ID,
      }),
      deps({
        getConversationForVisitor: async () => ({
          id: CONVERSATION_ID,
          status: "completed",
        }),
      })
    );
    assertEq(res.status, 200, "status");
    const body = (await readJson(res)) as { message?: string };
    assertEq(body.message, "Conversation already processed", "message");
  });

  await test("valid scoped trigger processes the conversation", async () => {
    let processed: string | null = null;
    const res = await handlePipelineTrigger(
      req({
        conversationId: CONVERSATION_ID,
        tenantId: TENANT_ID,
        visitorId: VISITOR_ID,
      }),
      deps({
        processConversation: async (conversationId: string) => {
          processed = conversationId;
          return { success: true, conversationId };
        },
      })
    );
    assertEq(res.status, 200, "status");
    assertEq(processed, CONVERSATION_ID, "processed conversation");
  });

  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
