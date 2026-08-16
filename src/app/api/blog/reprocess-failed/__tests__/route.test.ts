#!/usr/bin/env node

import {
  handleReprocessFailedBlogPosts,
  type ReprocessFailedBlogDeps,
} from "../route";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`OK ${name}`);
    passed++;
  } catch (error) {
    failed++;
    console.log(`FAIL ${name}`);
    console.log(`  ${error instanceof Error ? error.message : String(error)}`);
  }
}

function assertEq<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function assertDeepEq<T>(actual: T, expected: T, label: string) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${label}: expected ${expectedJson}, got ${actualJson}`);
  }
}

function req(body: unknown, headers = new Headers()) {
  return {
    headers,
    json: async () => body,
  };
}

async function readJson(res: Response) {
  return JSON.parse(await res.text());
}

const TENANT_ID = "11111111-1111-4111-8111-111111111111";

function deps(
  overrides: Partial<ReprocessFailedBlogDeps> = {}
): ReprocessFailedBlogDeps {
  return {
    schedule: () => {},
    purgeFailedPosts: async () => ({ purged: 0, conversationIds: [] }),
    resetConversationStates: async () => {},
    findNewestConversationIds: async () => [],
    requestPipeline: async (conversationId: string) => ({
      status: "queued",
      conversationId,
    }),
    ...overrides,
  };
}

async function run() {
  const originalCronSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "test-secret";

  await test("401 without bearer", async () => {
    let purged = false;
    const res = await handleReprocessFailedBlogPosts(
      req({ tenantId: TENANT_ID }),
      deps({
        purgeFailedPosts: async () => {
          purged = true;
          return { purged: 0, conversationIds: [] };
        },
      })
    );

    assertEq(res.status, 401, "status");
    assertEq(purged, false, "purge not called");
  });

  await test("400 on invalid body", async () => {
    const res = await handleReprocessFailedBlogPosts(
      req("not-an-object", new Headers({ authorization: "Bearer test-secret" })),
      deps()
    );

    assertEq(res.status, 400, "status");
    const body = (await readJson(res)) as { error?: string };
    assertEq(body.error, "invalid_request", "error");
  });

  await test("400 on non-uuid tenantId", async () => {
    const res = await handleReprocessFailedBlogPosts(
      req(
        { tenantId: "not-a-uuid" },
        new Headers({ authorization: "Bearer test-secret" })
      ),
      deps()
    );

    assertEq(res.status, 400, "status");
    const body = (await readJson(res)) as { error?: string };
    assertEq(body.error, "invalid_request", "error");
  });

  await test("retry_failed purges, resets, and queues newest conversations", async () => {
    const calls: string[] = [];
    let purgeTenantId: string | null = null;
    let resetIds: string[] = [];
    let findArgs: { tenantId: string; limit: number } | null = null;

    const res = await handleReprocessFailedBlogPosts(
      req(
        { tenantId: TENANT_ID, limit: 2 },
        new Headers({ authorization: "Bearer test-secret" })
      ),
      deps({
        purgeFailedPosts: async (tenantId) => {
          purgeTenantId = tenantId;
          return { purged: 2, conversationIds: ["conv-a", "conv-b"] };
        },
        resetConversationStates: async (ids) => {
          resetIds = ids;
        },
        findNewestConversationIds: async (args) => {
          findArgs = args;
          return ["conv-a", "conv-c"];
        },
        requestPipeline: async (conversationId) => {
          calls.push(conversationId);
          return { status: "queued", conversationId };
        },
      })
    );

    assertEq(res.status, 200, "status");
    assertEq(purgeTenantId, TENANT_ID, "purge tenant");
    assertDeepEq(resetIds, ["conv-a", "conv-b"], "reset ids");
    assertDeepEq(findArgs, { tenantId: TENANT_ID, limit: 2 }, "find args");
    assertDeepEq(calls, ["conv-a", "conv-c"], "request calls");

    const body = await readJson(res);
    assertDeepEq(
      body,
      {
        tenantId: TENANT_ID,
        purged: 2,
        queued: 2,
        skipped: 0,
        notFound: 0,
        conversationIds: ["conv-a", "conv-c"],
      },
      "response"
    );
  });

  await test("top_n skips purge and still queues newest conversations", async () => {
    let purgeCalled = false;
    let resetIds: string[] | null = null;

    const res = await handleReprocessFailedBlogPosts(
      req(
        { tenantId: TENANT_ID, mode: "top_n" },
        new Headers({ authorization: "Bearer test-secret" })
      ),
      deps({
        purgeFailedPosts: async () => {
          purgeCalled = true;
          return { purged: 0, conversationIds: [] };
        },
        resetConversationStates: async (ids) => {
          resetIds = ids;
        },
        findNewestConversationIds: async () => ["conv-new"],
        requestPipeline: async (conversationId) => ({
          status: "skipped",
          conversationId,
          reason: "duplicate_thread_id",
        }),
      })
    );

    assertEq(res.status, 200, "status");
    assertEq(purgeCalled, false, "purge not called");
    assertDeepEq(resetIds, [], "reset with no affected conversations");

    const body = await readJson(res);
    assertDeepEq(
      body,
      {
        tenantId: TENANT_ID,
        purged: 0,
        queued: 0,
        skipped: 1,
        notFound: 0,
        conversationIds: ["conv-new"],
      },
      "response"
    );
  });

  if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalCronSecret;

  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
