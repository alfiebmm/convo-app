#!/usr/bin/env node

/**
 * `/api/conversations/case-events` route tests (CON-169, Epic D1).
 *
 * Pure tsx-runnable (no test framework). Covers input validation and
 * tenant-scope semantics. Database lookups are injected via the
 * `handleCaseEvent` deps seam — no real Postgres calls in this suite.
 *
 * Run with:
 *   npx tsx src/app/api/conversations/case-events/__tests__/route.test.ts
 */

import {
  handleCaseEvent,
  type CaseEventDeps,
} from "../route";

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const failures: string[] = [];

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`❌ ${name}`);
    console.log(`   Error: ${message}`);
    failed++;
    failures.push(`${name}: ${message}`);
  }
}

function assertEq<T>(actual: T, expected: T, msg: string) {
  if (actual !== expected) {
    throw new Error(
      `${msg} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// Real v4-shaped UUIDs (Zod v4's `.uuid()` enforces version + variant
// digits per RFC 4122, so all-1s/all-2s/all-a's fixtures fail validation).
const TENANT_A_ID = "a1111111-1111-4111-8111-111111111111";
const TENANT_B_ID = "b2222222-2222-4222-9222-222222222222";
const CONVO_A_ID = "cccccccc-cccc-4ccc-accc-cccccccccccc";
const UNKNOWN_TENANT_ID = "d3333333-3333-4333-b333-333333333333";
const UNKNOWN_CONVO_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function mockReq(body: unknown): { json: () => Promise<unknown> } {
  return {
    json: async () => body,
  };
}

function makeDeps(overrides: Partial<CaseEventDeps> = {}): CaseEventDeps {
  return {
    getTenantById: async (id: string) =>
      id === TENANT_A_ID || id === TENANT_B_ID ? { id } : null,
    getConversation: async (id: string) =>
      id === CONVO_A_ID
        ? { id: CONVO_A_ID, tenantId: TENANT_A_ID }
        : null,
    ...overrides,
  };
}

async function readJson(res: Response): Promise<unknown> {
  return JSON.parse(await res.text());
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function runAll() {
  await test("missing tenantId → 400", async () => {
    const res = await handleCaseEvent(
      mockReq({
        conversationId: CONVO_A_ID,
        caseEventType: "offer_accepted",
      }),
      makeDeps(),
    );
    assertEq(res.status, 400, "status");
  });

  await test("missing conversationId → 400", async () => {
    const res = await handleCaseEvent(
      mockReq({
        tenantId: TENANT_A_ID,
        caseEventType: "offer_accepted",
      }),
      makeDeps(),
    );
    assertEq(res.status, 400, "status");
  });

  await test("missing caseEventType → 400", async () => {
    const res = await handleCaseEvent(
      mockReq({
        tenantId: TENANT_A_ID,
        conversationId: CONVO_A_ID,
      }),
      makeDeps(),
    );
    assertEq(res.status, 400, "status");
  });

  await test("unknown caseEventType → 400", async () => {
    const res = await handleCaseEvent(
      mockReq({
        tenantId: TENANT_A_ID,
        conversationId: CONVO_A_ID,
        caseEventType: "offer_maybe",
      }),
      makeDeps(),
    );
    assertEq(res.status, 400, "status");
  });

  await test("non-uuid tenantId → 400", async () => {
    const res = await handleCaseEvent(
      mockReq({
        tenantId: "not-a-uuid",
        conversationId: CONVO_A_ID,
        caseEventType: "offer_accepted",
      }),
      makeDeps(),
    );
    assertEq(res.status, 400, "status");
  });

  await test("malformed JSON body → 400", async () => {
    const req = {
      json: async () => {
        throw new Error("invalid json");
      },
    };
    const res = await handleCaseEvent(req, makeDeps());
    assertEq(res.status, 400, "status");
  });

  await test("unknown tenant → 404", async () => {
    const res = await handleCaseEvent(
      mockReq({
        tenantId: UNKNOWN_TENANT_ID,
        conversationId: CONVO_A_ID,
        caseEventType: "offer_accepted",
      }),
      makeDeps(),
    );
    assertEq(res.status, 404, "status");
  });

  await test("cross-tenant conversation → 404 (non-enumerating)", async () => {
    // Conversation belongs to tenant A; caller supplies tenant B's id.
    // Must 404, NOT 403, and must NOT leak the real owner.
    const res = await handleCaseEvent(
      mockReq({
        tenantId: TENANT_B_ID,
        conversationId: CONVO_A_ID,
        caseEventType: "offer_accepted",
      }),
      makeDeps(),
    );
    assertEq(res.status, 404, "status");
    const body = (await readJson(res)) as { error?: string };
    // The message must not mention the conversation owner or the word
    // "tenant" — it should look like a generic 404.
    assert(typeof body.error === "string", "error string present");
    assert(
      !/tenant_a|owner|wrong tenant/i.test(body.error ?? ""),
      "404 must not enumerate the real owner",
    );
  });

  await test("unknown conversation → 404", async () => {
    const res = await handleCaseEvent(
      mockReq({
        tenantId: TENANT_A_ID,
        conversationId: UNKNOWN_CONVO_ID,
        caseEventType: "offer_accepted",
      }),
      makeDeps(),
    );
    assertEq(res.status, 404, "status");
  });

  await test("valid offer_accepted → 200 { ok: true }", async () => {
    const res = await handleCaseEvent(
      mockReq({
        tenantId: TENANT_A_ID,
        conversationId: CONVO_A_ID,
        caseEventType: "offer_accepted",
        metadata: { rule_id: "r1", confidence: 0.8 },
      }),
      makeDeps(),
    );
    assertEq(res.status, 200, "status");
    const body = (await readJson(res)) as { ok?: boolean };
    assertEq(body.ok, true, "ok flag");
  });

  await test("valid offer_declined → 200 { ok: true }", async () => {
    const res = await handleCaseEvent(
      mockReq({
        tenantId: TENANT_A_ID,
        conversationId: CONVO_A_ID,
        caseEventType: "offer_declined",
      }),
      makeDeps(),
    );
    assertEq(res.status, 200, "status");
    const body = (await readJson(res)) as { ok?: boolean };
    assertEq(body.ok, true, "ok flag");
  });
}

runAll().then(() => {
  console.log("");
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("");
    console.log("Failures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
});
