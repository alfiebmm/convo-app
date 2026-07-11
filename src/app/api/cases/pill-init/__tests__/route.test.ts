#!/usr/bin/env node

/**
 * `/api/cases/pill-init` route tests (CON-255).
 *
 * Pure tsx-runnable. Database lookups are injected via the `handlePillInit`
 * deps seam; no real Postgres calls in this suite.
 */

import {
  handlePillInit,
  OPTIONS as PillInitOPTIONS,
  type PillInitDeps,
} from "../route";
import { DEFAULT_STARTER_PROMPTS } from "@/lib/forum-config/defaults";
import type { CaseRow } from "@/lib/cases";

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

const TENANT_A = "a1111111-1111-4111-8111-111111111111";
const TENANT_B = "b2222222-2222-4222-9222-222222222222";
const CONVO_A = "cccccccc-cccc-4ccc-accc-cccccccccccc";
const VISITOR_A = "visitor-a";
const VISITOR_B = "visitor-b";
const CASE_A = "11111111-1111-4111-8111-111111111111";

function mockReq(body: unknown): { json: () => Promise<unknown> } {
  return { json: async () => body };
}

function makeCaseRow(overrides: Partial<CaseRow> = {}): CaseRow {
  const now = new Date();
  return {
    id: CASE_A,
    tenantId: TENANT_A,
    conversationId: CONVO_A,
    contactId: null,
    caseType: "lead",
    status: "open",
    priority: null,
    routingKey: null,
    title: null,
    summary: null,
    reason: "capture_details_then_flag",
    source: "starter_pill",
    ruleId: null,
    classifierConfidence: null,
    assignedTo: null,
    externalSystem: null,
    externalId: null,
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    ...overrides,
  };
}

interface FakeWorld {
  cases: CaseRow[];
  attributes: Array<{
    tenantId: string;
    caseId: string;
    key: string;
    value: unknown;
  }>;
}

function makeDeps(
  world: FakeWorld,
  overrides: Partial<PillInitDeps> = {},
): PillInitDeps {
  return {
    getTenantById: async (id) =>
      id === TENANT_A || id === TENANT_B
        ? {
            id,
            settings: {
              forumConfig: {
                starter_prompts: DEFAULT_STARTER_PROMPTS,
              },
            },
          }
        : null,
    getConversationForVisitor: async (id, tenantId, visitorId) =>
      id === CONVO_A && tenantId === TENANT_A && visitorId === VISITOR_A
        ? { id, tenantId }
        : null,
    getCaseByConversation: async (tenantId, conversationId) =>
      world.cases.find(
        (c) => c.tenantId === tenantId && c.conversationId === conversationId,
      ) ?? null,
    createCase: async (tenantId, input) => {
      const row = makeCaseRow({
        tenantId,
        conversationId: input.conversationId,
        caseType: input.caseType,
        reason: input.reason ?? null,
        source: input.source ?? null,
      });
      world.cases.push(row);
      return row;
    },
    setCaseAttribute: (async (tenantId, input) => {
      world.attributes.push({
        tenantId,
        caseId: input.caseId,
        key: input.key,
        value: input.value,
      });
      return {
        tenantId,
        caseId: input.caseId,
        key: input.key,
        value: input.value,
        source: input.source ?? null,
        confidence: input.confidence ?? null,
        detectedAt: new Date(),
      };
    }) as PillInitDeps["setCaseAttribute"],
    ...overrides,
  };
}

async function readJson(res: Response): Promise<unknown> {
  return JSON.parse(await res.text());
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: TENANT_A,
    visitorId: VISITOR_A,
    conversationId: CONVO_A,
    capture_policy_id: "starter_pill_get_in_touch",
    ...overrides,
  };
}

async function runAll() {
  await test("happy path creates a starter-pill lead case and returns policy", async () => {
    const world: FakeWorld = { cases: [], attributes: [] };
    const res = await handlePillInit(mockReq(validBody()), makeDeps(world));
    assertEq(res.status, 200, "status");

    const body = (await readJson(res)) as {
      case_id?: string;
      capture_policy?: { id?: string; required_fields?: string[] };
    };
    assertEq(body.case_id, CASE_A, "case_id");
    assertEq(
      body.capture_policy?.id,
      "starter_pill_get_in_touch",
      "capture_policy.id",
    );
    assertEq(
      body.capture_policy?.required_fields?.[0],
      "free_text_note",
      "intent field first",
    );
    assertEq(world.cases.length, 1, "case created");
    assertEq(world.cases[0].reason, "capture_details_then_flag", "case action");
    assertEq(world.attributes[0].key, "origin", "origin key");
    assertEq(world.attributes[0].value, "pill_lead_capture", "origin value");
  });

  await test("reuses an existing conversation case without creating another", async () => {
    const existing = makeCaseRow();
    const world: FakeWorld = { cases: [existing], attributes: [] };
    const res = await handlePillInit(mockReq(validBody()), makeDeps(world));
    assertEq(res.status, 200, "status");
    const body = (await readJson(res)) as { case_id?: string };
    assertEq(body.case_id, existing.id, "case_id");
    assertEq(world.cases.length, 1, "no duplicate case");
  });

  await test("missing capture_policy_id returns 400", async () => {
    const world: FakeWorld = { cases: [], attributes: [] };
    const res = await handlePillInit(
      mockReq(validBody({ capture_policy_id: undefined })),
      makeDeps(world),
    );
    assertEq(res.status, 400, "status");
  });

  await test("unknown inline capture policy returns 400", async () => {
    const world: FakeWorld = { cases: [], attributes: [] };
    const res = await handlePillInit(
      mockReq(validBody({ capture_policy_id: "unknown" })),
      makeDeps(world),
    );
    assertEq(res.status, 400, "status");
  });

  await test("unknown tenant returns non-enumerating 404", async () => {
    const world: FakeWorld = { cases: [], attributes: [] };
    const res = await handlePillInit(
      mockReq(validBody({ tenantId: "d3333333-3333-4333-b333-333333333333" })),
      makeDeps(world),
    );
    assertEq(res.status, 404, "status");
    const body = (await readJson(res)) as { error?: string };
    assertEq(body.error, "Not found", "generic error");
  });

  await test("cross-visitor conversation returns non-enumerating 404", async () => {
    const world: FakeWorld = { cases: [], attributes: [] };
    const res = await handlePillInit(
      mockReq(validBody({ visitorId: VISITOR_B })),
      makeDeps(world),
    );
    assertEq(res.status, 404, "status");
    const body = (await readJson(res)) as { error?: string };
    assert(!/visitor|tenant|owner/i.test(body.error ?? ""), "no scope leak");
  });

  await test("OPTIONS preflight returns permissive CORS", () => {
    const res = PillInitOPTIONS();
    assertEq(res.status, 204, "status");
    assertEq(
      res.headers.get("access-control-allow-origin"),
      "*",
      "allow origin",
    );
    assertEq(
      res.headers.get("access-control-allow-methods"),
      "POST, OPTIONS",
      "allow methods",
    );
  });
}

runAll()
  .then(() => {
    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) {
      console.log(failures.join("\n"));
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
