#!/usr/bin/env node

import {
  handleBackfillOrphans,
  type BackfillOrphansDeps,
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
const OTHER_TENANT_ID = "22222222-2222-4222-8222-222222222222";
const ORPHAN_IDS = ["conv-1", "conv-2", "conv-3", "conv-4", "conv-5"];

function deps(
  overrides: Partial<BackfillOrphansDeps> = {}
): BackfillOrphansDeps {
  return {
    schedule: () => {},
    findOrphanConversationIds: async () => [],
    resetConversationStates: async () => {},
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
    let queried = false;
    const res = await handleBackfillOrphans(
      req({ tenantId: TENANT_ID }),
      deps({
        findOrphanConversationIds: async () => {
          queried = true;
          return [];
        },
      })
    );

    assertEq(res.status, 401, "status");
    assertEq(queried, false, "query not called");
  });

  await test("401 with wrong bearer", async () => {
    const res = await handleBackfillOrphans(
      req(
        { tenantId: TENANT_ID },
        new Headers({ authorization: "Bearer wrong-secret" })
      ),
      deps()
    );

    assertEq(res.status, 401, "status");
  });

  await test("queues found orphan conversations after resetting state", async () => {
    const resetState = new Map(ORPHAN_IDS.map((id) => [id, "converted_to_blog"]));
    const calls: string[] = [];

    const res = await handleBackfillOrphans(
      req(
        { tenantId: TENANT_ID, limit: 5, dryRun: false },
        new Headers({ authorization: "Bearer test-secret" })
      ),
      deps({
        findOrphanConversationIds: async ({ tenantId }) =>
          tenantId === TENANT_ID ? ORPHAN_IDS : [],
        resetConversationStates: async ({ tenantId, conversationIds }) => {
          assertEq(tenantId, TENANT_ID, "reset tenant");
          for (const id of conversationIds) resetState.set(id, "reset");
        },
        requestPipeline: async (conversationId, options) => {
          calls.push(conversationId);
          assertEq(options.source, "backfill", "source");
          assertEq(options.tenantId, TENANT_ID, "request tenant");
          assertEq(options.markCompleted, true, "mark completed");
          assertEq(resetState.get(conversationId), "reset", "state reset first");
          return { status: "queued", conversationId };
        },
      })
    );

    assertEq(res.status, 200, "status");
    assertDeepEq(calls, ORPHAN_IDS, "request calls");
    for (const id of ORPHAN_IDS) {
      assertEq(resetState.get(id), "reset", `${id} state`);
    }

    const body = await readJson(res);
    assertDeepEq(
      body,
      {
        tenantId: TENANT_ID,
        dryRun: false,
        found: 5,
        queued: 5,
        skipped: 0,
        notFound: 0,
        conversationIds: ORPHAN_IDS,
      },
      "response"
    );
  });

  await test("dry run returns found conversations without mutations", async () => {
    let resetCalled = false;
    let requested = false;

    const res = await handleBackfillOrphans(
      req(
        { tenantId: TENANT_ID, limit: 5, dryRun: true },
        new Headers({ authorization: "Bearer test-secret" })
      ),
      deps({
        findOrphanConversationIds: async () => ORPHAN_IDS,
        resetConversationStates: async () => {
          resetCalled = true;
        },
        requestPipeline: async (conversationId) => {
          requested = true;
          return { status: "queued", conversationId };
        },
      })
    );

    assertEq(res.status, 200, "status");
    assertEq(resetCalled, false, "reset not called");
    assertEq(requested, false, "request not called");

    const body = await readJson(res);
    assertDeepEq(
      body,
      {
        tenantId: TENANT_ID,
        dryRun: true,
        found: 5,
        queued: 0,
        skipped: 0,
        notFound: 0,
        conversationIds: ORPHAN_IDS,
      },
      "response"
    );
  });

  await test("tenant scoping only returns rows for requested tenant", async () => {
    const tenantRows = {
      [TENANT_ID]: ORPHAN_IDS,
      [OTHER_TENANT_ID]: ["other-conv"],
    } as Record<string, string[]>;

    const res = await handleBackfillOrphans(
      req(
        { tenantId: TENANT_ID, limit: 5, dryRun: true },
        new Headers({ authorization: "Bearer test-secret" })
      ),
      deps({
        findOrphanConversationIds: async ({ tenantId }) => tenantRows[tenantId] ?? [],
      })
    );

    assertEq(res.status, 200, "status");
    const body = await readJson(res);
    assertDeepEq(body.conversationIds, ORPHAN_IDS, "conversation ids");
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
