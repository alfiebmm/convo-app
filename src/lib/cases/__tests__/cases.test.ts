#!/usr/bin/env node

/**
 * Tenant-scoped case + event + attribute helper tests (CON-164, Epic B5).
 *
 * Pure tsx-runnable (matches `src/lib/follow-up/__tests__/*` and
 * `src/lib/classifier/__tests__/*`). No test framework — no Vitest/Jest
 * is wired into this repo. Database access is faked via the
 * `InMemoryCasesStore` so we exercise the helper validation + the
 * scoping contract without booting Postgres.
 *
 * Coverage per public helper:
 *   1. Happy path — write/read works with valid tenantId.
 *   2. Cross-tenant denial — tenant A cannot read/write/list tenant B's data.
 *   3. tenantId validation — empty/non-UUID throws BEFORE any DB call.
 *
 * Run with:  npx tsx src/lib/cases/__tests__/cases.test.ts
 */

import {
  addCaseNote,
  assignCase,
  assignCaseWithAudit,
  createCase,
  dismissCaseWithAudit,
  getCaseById,
  getCaseByConversation,
  getCaseDetailById,
  listCasesByTenant,
  listCasesByTenantWithActivity,
  listConversationsByTenantWithOptionalCase,
  requeueOutboxRow,
  resolveCaseWithAudit,
  updateCaseStatus,
} from "../index";
import { setCaseAttribute, getCaseAttributes } from "../attributes";
import { recordCaseEvent } from "../events";
import { revealCasePiiForTenant } from "../pii";
import { sanitizeCaseNoteHtml } from "../sanitize";
import { createInMemoryCasesStore } from "./in-memory-store";

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

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function assertEq<T>(actual: T, expected: T, msg: string) {
  if (actual !== expected) {
    throw new Error(
      `${msg} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

async function assertThrows(
  fn: () => Promise<unknown>,
  expectedSubstring: string,
  msg: string
) {
  let threw = false;
  let errMsg = "";
  try {
    await fn();
  } catch (e) {
    threw = true;
    errMsg = e instanceof Error ? e.message : String(e);
  }
  assert(threw, `${msg} — expected throw, got success`);
  assert(
    errMsg.includes(expectedSubstring),
    `${msg} — expected error to include "${expectedSubstring}", got "${errMsg}"`
  );
}

// ---------------------------------------------------------------------------
// Fixtures (real v4-shaped UUIDs)
// ---------------------------------------------------------------------------

const TENANT_A = "a1111111-1111-4111-8111-111111111111";
const TENANT_B = "b2222222-2222-4222-9222-222222222222";
const CONVO_A = "cccccccc-cccc-4ccc-accc-cccccccccccc";
const CONVO_B = "dddddddd-dddd-4ddd-addd-dddddddddddd";
const CONVO_C = "11111111-3333-4333-8333-333333333333";
const CONVO_D = "11111111-4444-4444-8444-444444444444";
const CONVO_E = "11111111-5555-4555-8555-555555555555";
const USER_X = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const OUTBOX_A = "77777777-7777-4777-8777-777777777777";

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

async function runAllTests() {
  // -------------------------------------------------------------------------
  // createCase
  // -------------------------------------------------------------------------

  await test("createCase: happy path persists the row with status=open by default", async () => {
    const store = createInMemoryCasesStore();
    const row = await createCase(
      TENANT_A,
      { conversationId: CONVO_A, caseType: "unanswered_question" },
      { store }
    );
    assertEq(row.tenantId, TENANT_A, "tenantId echoed");
    assertEq(row.conversationId, CONVO_A, "conversationId echoed");
    assertEq(row.caseType, "unanswered_question", "caseType echoed");
    assertEq(row.status, "open", "default status is open");
    assertEq(row.contactId, null, "contactId defaults to null");
    assertEq(store._dump().cases.length, 1, "one row written");
  });

  await test("createCase: rejects missing tenantId before any DB call", async () => {
    const store = createInMemoryCasesStore();
    await assertThrows(
      () =>
        createCase(
          "",
          { conversationId: CONVO_A, caseType: "x" },
          { store }
        ),
      "tenantId is required",
      "empty tenantId"
    );
    assertEq(store._dump().cases.length, 0, "no row written on validation fail");
  });

  await test("createCase: rejects non-UUID tenantId", async () => {
    const store = createInMemoryCasesStore();
    await assertThrows(
      () =>
        createCase(
          "not-a-uuid",
          { conversationId: CONVO_A, caseType: "x" },
          { store }
        ),
      "tenantId must be a UUID",
      "garbage tenantId"
    );
  });

  await test("createCase: rejects empty caseType", async () => {
    const store = createInMemoryCasesStore();
    await assertThrows(
      () =>
        createCase(
          TENANT_A,
          { conversationId: CONVO_A, caseType: "" },
          { store }
        ),
      "caseType is required",
      "empty caseType"
    );
  });

  await test("createCase: rejects non-UUID conversationId", async () => {
    const store = createInMemoryCasesStore();
    await assertThrows(
      () =>
        createCase(
          TENANT_A,
          { conversationId: "nope", caseType: "x" },
          { store }
        ),
      "conversationId must be a UUID",
      "garbage conversationId"
    );
  });

  // -------------------------------------------------------------------------
  // getCaseById — cross-tenant denial
  // -------------------------------------------------------------------------

  await test("getCaseById: happy path returns the row for the owning tenant", async () => {
    const store = createInMemoryCasesStore();
    const created = await createCase(
      TENANT_A,
      { conversationId: CONVO_A, caseType: "lead" },
      { store }
    );
    const fetched = await getCaseById(TENANT_A, created.id, { store });
    assert(fetched !== null, "found in same tenant");
    assertEq(fetched!.id, created.id, "same id returned");
  });

  await test("getCaseById: tenant B cannot read tenant A's case (returns null, no leak)", async () => {
    const store = createInMemoryCasesStore();
    const created = await createCase(
      TENANT_A,
      { conversationId: CONVO_A, caseType: "lead" },
      { store }
    );
    const fetched = await getCaseById(TENANT_B, created.id, { store });
    assertEq(fetched, null, "tenant B sees null for tenant A's case");
  });

  await test("getCaseById: rejects empty tenantId", async () => {
    const store = createInMemoryCasesStore();
    await assertThrows(
      () => getCaseById("", "00000000-0000-4000-8000-000000000000", { store }),
      "tenantId is required",
      "empty tenantId"
    );
  });

  await test("getCaseById: rejects non-UUID caseId", async () => {
    const store = createInMemoryCasesStore();
    await assertThrows(
      () => getCaseById(TENANT_A, "nope", { store }),
      "caseId must be a UUID",
      "garbage caseId"
    );
  });

  // -------------------------------------------------------------------------
  // getCaseByConversation — CON-170 / D2a chat-route idempotency helper
  // -------------------------------------------------------------------------

  await test("getCaseByConversation: returns null when no case exists for the conversation", async () => {
    const store = createInMemoryCasesStore();
    const fetched = await getCaseByConversation(TENANT_A, CONVO_A, { store });
    assertEq(fetched, null, "no case yet");
  });

  await test("getCaseByConversation: returns the case after createCase", async () => {
    const store = createInMemoryCasesStore();
    const created = await createCase(
      TENANT_A,
      { conversationId: CONVO_A, caseType: "lead" },
      { store }
    );
    const fetched = await getCaseByConversation(TENANT_A, CONVO_A, { store });
    assert(fetched !== null, "found by conversation");
    assertEq(fetched!.id, created.id, "same case id");
  });

  await test("getCaseByConversation: tenant B cannot see tenant A's case via conversation lookup", async () => {
    const store = createInMemoryCasesStore();
    await createCase(
      TENANT_A,
      { conversationId: CONVO_A, caseType: "lead" },
      { store }
    );
    const fetched = await getCaseByConversation(TENANT_B, CONVO_A, { store });
    assertEq(fetched, null, "cross-tenant lookup returns null");
  });

  await test("getCaseByConversation: rejects empty tenantId", async () => {
    const store = createInMemoryCasesStore();
    await assertThrows(
      () =>
        getCaseByConversation(
          "",
          "00000000-0000-4000-8000-000000000000",
          { store }
        ),
      "tenantId is required",
      "empty tenantId"
    );
  });

  await test("getCaseByConversation: rejects non-UUID conversationId", async () => {
    const store = createInMemoryCasesStore();
    await assertThrows(
      () => getCaseByConversation(TENANT_A, "nope", { store }),
      "conversationId must be a UUID",
      "garbage conversationId"
    );
  });

  // -------------------------------------------------------------------------
  // updateCaseStatus
  // -------------------------------------------------------------------------

  await test("updateCaseStatus: happy path transitions status and stamps resolvedAt on resolve", async () => {
    const store = createInMemoryCasesStore();
    const created = await createCase(
      TENANT_A,
      { conversationId: CONVO_A, caseType: "lead" },
      { store }
    );
    const resolved = await updateCaseStatus(TENANT_A, created.id, "resolved", {
      store,
    });
    assert(resolved !== null, "resolve returned a row");
    assertEq(resolved!.status, "resolved", "status set");
    assert(resolved!.resolvedAt !== null, "resolvedAt stamped");

    const reopened = await updateCaseStatus(TENANT_A, created.id, "open", {
      store,
    });
    assert(reopened !== null, "reopen returned a row");
    assertEq(reopened!.status, "open", "status back to open");
    assertEq(reopened!.resolvedAt, null, "resolvedAt cleared on re-open");
  });

  await test("updateCaseStatus: tenant B cannot mutate tenant A's case (returns null, row untouched)", async () => {
    const store = createInMemoryCasesStore();
    const created = await createCase(
      TENANT_A,
      { conversationId: CONVO_A, caseType: "lead" },
      { store }
    );
    const result = await updateCaseStatus(
      TENANT_B,
      created.id,
      "resolved",
      { store }
    );
    assertEq(result, null, "tenant B update returns null");

    const stillOpen = await getCaseById(TENANT_A, created.id, { store });
    assertEq(stillOpen!.status, "open", "tenant A's case untouched");
  });

  await test("updateCaseStatus: rejects bad tenantId", async () => {
    const store = createInMemoryCasesStore();
    await assertThrows(
      () =>
        updateCaseStatus("", "11111111-1111-4111-8111-111111111111", "open", {
          store,
        }),
      "tenantId is required",
      "empty tenantId"
    );
  });

  // -------------------------------------------------------------------------
  // assignCase
  // -------------------------------------------------------------------------

  await test("assignCase: happy path sets assignedTo and unassign clears it", async () => {
    const store = createInMemoryCasesStore();
    const created = await createCase(
      TENANT_A,
      { conversationId: CONVO_A, caseType: "lead" },
      { store }
    );
    const assigned = await assignCase(TENANT_A, created.id, USER_X, { store });
    assertEq(assigned!.assignedTo, USER_X, "assignedTo set");
    const unassigned = await assignCase(TENANT_A, created.id, null, { store });
    assertEq(unassigned!.assignedTo, null, "assignedTo cleared");
  });

  await test("assignCase: tenant B cannot assign tenant A's case (returns null)", async () => {
    const store = createInMemoryCasesStore();
    const created = await createCase(
      TENANT_A,
      { conversationId: CONVO_A, caseType: "lead" },
      { store }
    );
    const result = await assignCase(TENANT_B, created.id, USER_X, { store });
    assertEq(result, null, "tenant B assign returns null");
    const peek = await getCaseById(TENANT_A, created.id, { store });
    assertEq(peek!.assignedTo, null, "tenant A's case untouched");
  });

  await test("assignCase: rejects non-UUID assignee", async () => {
    const store = createInMemoryCasesStore();
    const created = await createCase(
      TENANT_A,
      { conversationId: CONVO_A, caseType: "lead" },
      { store }
    );
    await assertThrows(
      () => assignCase(TENANT_A, created.id, "not-a-uuid", { store }),
      "assigneeUserId must be a UUID",
      "garbage assignee"
    );
  });

  // -------------------------------------------------------------------------
  // Operational action helpers — CON-177
  // -------------------------------------------------------------------------

  await test("assignCaseWithAudit: happy path writes assignedTo and emits assignment_change", async () => {
    const store = createInMemoryCasesStore();
    const created = await createCase(
      TENANT_A,
      { conversationId: CONVO_A, caseType: "lead", assignedTo: null },
      { store }
    );

    const updated = await assignCaseWithAudit(
      TENANT_A,
      created.id,
      USER_X,
      USER_X,
      { store }
    );

    assert(updated !== null, "assignment returned row");
    assertEq(updated!.assignedTo, USER_X, "assignedTo set");
    const event = store._dump().events.find((row) => row.eventType === "assignment_change");
    assert(event, "audit event emitted");
    assertEq(event!.payload.assigned_to as string, USER_X, "new assignee logged");
    assertEq(event!.payload.prev_assigned_to as null, null, "previous assignee logged");
    assertEq(event!.payload.actor_id as string, USER_X, "actor logged");
  });

  await test("assignCaseWithAudit: tenant B cannot assign tenant A's case or emit an event", async () => {
    const store = createInMemoryCasesStore();
    const created = await createCase(
      TENANT_A,
      { conversationId: CONVO_A, caseType: "lead" },
      { store }
    );

    const result = await assignCaseWithAudit(
      TENANT_B,
      created.id,
      USER_X,
      USER_X,
      { store }
    );

    assertEq(result, null, "cross-tenant assign returns null");
    assertEq(store._dump().events.length, 0, "no cross-tenant event emitted");
    const peek = await getCaseById(TENANT_A, created.id, { store });
    assertEq(peek!.assignedTo, null, "tenant A row untouched");
  });

  await test("resolveCaseWithAudit: happy path resolves and emits status_change", async () => {
    const store = createInMemoryCasesStore();
    const created = await createCase(
      TENANT_A,
      { conversationId: CONVO_A, caseType: "lead" },
      { store }
    );

    const resolved = await resolveCaseWithAudit(TENANT_A, created.id, USER_X, {
      store,
    });

    assert(resolved !== null, "resolve returned row");
    assertEq(resolved!.status, "resolved", "status set");
    assert(resolved!.resolvedAt !== null, "resolvedAt stamped");
    const event = store._dump().events.find((row) => row.eventType === "status_change");
    assert(event, "audit event emitted");
    assertEq(event!.payload.actor_id as string, USER_X, "actor logged");
  });

  await test("resolveCaseWithAudit: tenant B cannot resolve tenant A's case", async () => {
    const store = createInMemoryCasesStore();
    const created = await createCase(
      TENANT_A,
      { conversationId: CONVO_A, caseType: "lead" },
      { store }
    );

    const result = await resolveCaseWithAudit(TENANT_B, created.id, USER_X, {
      store,
    });

    assertEq(result, null, "cross-tenant resolve returns null");
    assertEq(store._dump().events.length, 0, "no event emitted");
  });

  await test("dismissCaseWithAudit: happy path dismisses and emits status_change with reason", async () => {
    const store = createInMemoryCasesStore();
    const created = await createCase(
      TENANT_A,
      { conversationId: CONVO_A, caseType: "lead" },
      { store }
    );

    const dismissed = await dismissCaseWithAudit(
      TENANT_A,
      created.id,
      "Duplicate enquiry",
      USER_X,
      { store }
    );

    assert(dismissed !== null, "dismiss returned row");
    assertEq(dismissed!.status, "dismissed", "status set");
    const event = store._dump().events.find((row) => row.eventType === "status_change");
    assert(event, "audit event emitted");
    assertEq(event!.payload.reason as string, "Duplicate enquiry", "reason logged");
  });

  await test("dismissCaseWithAudit: requires a 1-1000 character reason", async () => {
    const store = createInMemoryCasesStore();
    const created = await createCase(
      TENANT_A,
      { conversationId: CONVO_A, caseType: "lead" },
      { store }
    );

    await assertThrows(
      () => dismissCaseWithAudit(TENANT_A, created.id, "", USER_X, { store }),
      "Dismiss reason must be 1-1000 characters",
      "empty reason"
    );
  });

  await test("addCaseNote: happy path stores a sanitised note_added event", async () => {
    const store = createInMemoryCasesStore();
    const created = await createCase(
      TENANT_A,
      { conversationId: CONVO_A, caseType: "lead" },
      { store }
    );

    const event = await addCaseNote(
      TENANT_A,
      created.id,
      `<p><b>Call</b> <i>back</i> <a href="https://example.com" onclick="x()">link</a><script>alert(1)</script></p>`,
      USER_X,
      { store }
    );

    assert(event !== null, "note event returned");
    assertEq(event!.eventType, "note_added", "event type set");
    const body = event!.payload.body_html as string;
    assert(body.includes("<strong>Call</strong>"), "bold preserved as strong");
    assert(body.includes("<em>back</em>"), "italic preserved as em");
    assert(body.includes('href="https://example.com"'), "safe link preserved");
    assert(!body.includes("onclick"), "event handler stripped");
    assert(!body.includes("script"), "script stripped");
  });

  await test("addCaseNote: tenant B cannot append to tenant A's case", async () => {
    const store = createInMemoryCasesStore();
    const created = await createCase(
      TENANT_A,
      { conversationId: CONVO_A, caseType: "lead" },
      { store }
    );

    const result = await addCaseNote(TENANT_B, created.id, "<p>Hidden</p>", USER_X, {
      store,
    });

    assertEq(result, null, "cross-tenant note returns null");
    assertEq(store._dump().events.length, 0, "no event emitted");
  });

  await test("requeueOutboxRow: failed row is requeued and emits sync_retried", async () => {
    const store = createInMemoryCasesStore();
    const created = await createCase(
      TENANT_A,
      { conversationId: CONVO_A, caseType: "lead" },
      { store }
    );
    store._seedConnector({
      id: OUTBOX_A,
      tenantId: TENANT_A,
      caseId: created.id,
      connectorType: "hubspot",
      destinationId: "main",
      payloadVersion: "1",
      payload: {},
      status: "failed",
      attemptCount: 2,
      lastError: "timeout",
      nextAttemptAt: new Date("2026-06-20T00:00:00Z"),
      createdAt: new Date("2026-06-20T00:00:00Z"),
      deliveredAt: null,
      idempotencyKey: "tenant-a:case-a",
    });

    const result = await requeueOutboxRow(TENANT_A, OUTBOX_A, USER_X, { store });

    assert(result !== null, "result returned");
    assertEq(result!.requeued, true, "marked requeued");
    assertEq(result!.row.status, "pending", "status set pending");
    const event = store._dump().events.find((row) => row.eventType === "sync_retried");
    assert(event, "audit event emitted");
    assertEq(event!.payload.outbox_id as string, OUTBOX_A, "outbox id logged");
  });

  await test("requeueOutboxRow: pending or sent rows no-op without emitting sync_retried", async () => {
    const store = createInMemoryCasesStore();
    const created = await createCase(
      TENANT_A,
      { conversationId: CONVO_A, caseType: "lead" },
      { store }
    );
    store._seedConnector({
      id: OUTBOX_A,
      tenantId: TENANT_A,
      caseId: created.id,
      connectorType: "hubspot",
      destinationId: "main",
      payloadVersion: "1",
      payload: {},
      status: "pending",
      attemptCount: 1,
      lastError: null,
      nextAttemptAt: new Date(),
      createdAt: new Date(),
      deliveredAt: null,
      idempotencyKey: "tenant-a:case-a",
    });

    const result = await requeueOutboxRow(TENANT_A, OUTBOX_A, USER_X, { store });

    assert(result !== null, "result returned");
    assertEq(result!.requeued, false, "marked no-op");
    assertEq(store._dump().events.length, 0, "no event emitted");
  });

  await test("requeueOutboxRow: tenant B cannot requeue tenant A's outbox row", async () => {
    const store = createInMemoryCasesStore();
    const created = await createCase(
      TENANT_A,
      { conversationId: CONVO_A, caseType: "lead" },
      { store }
    );
    store._seedConnector({
      id: OUTBOX_A,
      tenantId: TENANT_A,
      caseId: created.id,
      connectorType: "hubspot",
      destinationId: "main",
      payloadVersion: "1",
      payload: {},
      status: "failed",
      attemptCount: 1,
      lastError: "timeout",
      nextAttemptAt: new Date(),
      createdAt: new Date(),
      deliveredAt: null,
      idempotencyKey: "tenant-a:case-a",
    });

    const result = await requeueOutboxRow(TENANT_B, OUTBOX_A, USER_X, { store });

    assertEq(result, null, "cross-tenant retry returns null");
    assertEq(store._dump().connectors[0].status, "failed", "row untouched");
    assertEq(store._dump().events.length, 0, "no event emitted");
  });

  await test("sanitizeCaseNoteHtml: strips XSS payloads and data URLs", () => {
    const html = sanitizeCaseNoteHtml(
      `<p style="color:red"><strong>Safe</strong><img src=x onerror=alert(1)><a href="javascript:alert(1)">bad</a><a href="data:text/html,hi">data</a><a href="mailto:test@example.com">mail</a></p>`
    );

    assert(html.includes("<strong>Safe</strong>"), "allowed strong preserved");
    assert(html.includes('href="mailto:test@example.com"'), "mailto preserved");
    assert(!html.includes("style="), "style stripped");
    assert(!html.includes("img"), "image stripped");
    assert(!html.includes("javascript:"), "javascript URL stripped");
    assert(!html.includes("data:"), "data URL stripped");
  });

  // -------------------------------------------------------------------------
  // listCasesByTenant
  // -------------------------------------------------------------------------

  await test("listCasesByTenant: happy path returns only the requested tenant's cases", async () => {
    const store = createInMemoryCasesStore();
    await createCase(
      TENANT_A,
      { conversationId: CONVO_A, caseType: "lead" },
      { store }
    );
    await createCase(
      TENANT_A,
      {
        conversationId: "f0000000-0000-4000-8000-000000000001",
        caseType: "support",
      },
      { store }
    );
    await createCase(
      TENANT_B,
      { conversationId: CONVO_B, caseType: "lead" },
      { store }
    );

    const aList = await listCasesByTenant(TENANT_A, {}, { store });
    assertEq(aList.length, 2, "tenant A has 2 cases");
    for (const row of aList) {
      assertEq(row.tenantId, TENANT_A, "every returned row belongs to A");
    }

    const bList = await listCasesByTenant(TENANT_B, {}, { store });
    assertEq(bList.length, 1, "tenant B has 1 case");
    assertEq(bList[0].tenantId, TENANT_B, "tenant B row belongs to B");
  });

  await test("listCasesByTenant: cross-tenant denial — tenant A's filter does NOT leak tenant B's cases", async () => {
    const store = createInMemoryCasesStore();
    await createCase(
      TENANT_B,
      { conversationId: CONVO_B, caseType: "lead" },
      { store }
    );
    const aList = await listCasesByTenant(
      TENANT_A,
      { caseType: "lead" },
      { store }
    );
    assertEq(aList.length, 0, "tenant A sees zero leads (B's row is invisible)");
  });

  await test("listCasesByTenant: status filter narrows results", async () => {
    const store = createInMemoryCasesStore();
    const c1 = await createCase(
      TENANT_A,
      { conversationId: CONVO_A, caseType: "lead" },
      { store }
    );
    await createCase(
      TENANT_A,
      {
        conversationId: "f0000000-0000-4000-8000-000000000002",
        caseType: "lead",
      },
      { store }
    );
    await updateCaseStatus(TENANT_A, c1.id, "resolved", { store });

    const open = await listCasesByTenant(
      TENANT_A,
      { status: "open" },
      { store }
    );
    assertEq(open.length, 1, "one open case remains");
    const resolved = await listCasesByTenant(
      TENANT_A,
      { status: "resolved" },
      { store }
    );
    assertEq(resolved.length, 1, "one resolved case");
  });

  await test("listCasesByTenant: rejects empty tenantId", async () => {
    const store = createInMemoryCasesStore();
    await assertThrows(
      () => listCasesByTenant("", {}, { store }),
      "tenantId is required",
      "empty tenantId"
    );
  });

  // -------------------------------------------------------------------------
  // listCasesByTenantWithActivity — CON-173 conversations inbox helper
  // -------------------------------------------------------------------------

  await test("listCasesByTenantWithActivity: tenant A query never returns tenant B cases", async () => {
    const store = createInMemoryCasesStore();
    await createCase(
      TENANT_A,
      {
        conversationId: CONVO_A,
        caseType: "lead",
        priority: "high",
        routingKey: "sales",
        ruleId: "lead-capture",
      },
      { store }
    );
    await createCase(
      TENANT_B,
      {
        conversationId: CONVO_B,
        caseType: "lead",
        priority: "high",
        routingKey: "sales",
        ruleId: "lead-capture",
      },
      { store }
    );

    const aList = await listCasesByTenantWithActivity(
      TENANT_A,
      {
        caseType: "lead",
        priority: "high",
        routingKey: "sales",
        ruleId: "lead-capture",
      },
      { store }
    );

    assertEq(aList.length, 1, "only tenant A's matching case is returned");
    assertEq(aList[0].tenantId, TENANT_A, "returned row belongs to tenant A");
  });

  await test("listCasesByTenantWithActivity: combined filters narrow by case fields and attributes", async () => {
    const store = createInMemoryCasesStore();
    const included = await createCase(
      TENANT_A,
      {
        conversationId: CONVO_A,
        caseType: "lead",
        priority: "urgent",
        routingKey: "sales",
        ruleId: "lead-capture",
        assignedTo: USER_X,
      },
      { store }
    );
    const excluded = await createCase(
      TENANT_A,
      {
        conversationId: "f0000000-0000-4000-8000-000000000003",
        caseType: "lead",
        priority: "urgent",
        routingKey: "support",
        ruleId: "lead-capture",
        assignedTo: USER_X,
      },
      { store }
    );
    await setCaseAttribute(
      TENANT_A,
      { caseId: included.id, key: "persona", value: "buyer" },
      { store }
    );
    await setCaseAttribute(
      TENANT_A,
      { caseId: included.id, key: "topic", value: "pricing" },
      { store }
    );
    await setCaseAttribute(
      TENANT_A,
      { caseId: excluded.id, key: "persona", value: "seller" },
      { store }
    );

    const rows = await listCasesByTenantWithActivity(
      TENANT_A,
      {
        caseType: "lead",
        followUpRequired: true,
        status: "open",
        priority: "urgent",
        assignedTo: USER_X,
        routingKey: "sales",
        ruleId: "lead-capture",
        persona: "buyer",
        topic: "pricing",
      },
      { store }
    );

    assertEq(rows.length, 1, "combined filters return one row");
    assertEq(rows[0].id, included.id, "included case returned");
  });

  // -------------------------------------------------------------------------
  // listConversationsByTenantWithOptionalCase — CON-244 conversations tab
  // -------------------------------------------------------------------------

  await test("listConversationsByTenantWithOptionalCase: default returns every tenant conversation and has-case filters split them", async () => {
    const store = createInMemoryCasesStore();
    const started = new Date("2026-07-01T00:00:00.000Z");
    for (const [idx, id] of [CONVO_A, CONVO_B, CONVO_C, CONVO_D, CONVO_E].entries()) {
      store._seedConversation({
        id,
        tenantId: TENANT_A,
        startedAt: new Date(started.getTime() + idx * 60_000),
      });
    }
    await createCase(
      TENANT_A,
      { conversationId: CONVO_A, caseType: "lead", priority: "high" },
      { store }
    );
    await createCase(
      TENANT_A,
      { conversationId: CONVO_B, caseType: "cx_support", priority: "low" },
      { store }
    );

    const allRows = await listConversationsByTenantWithOptionalCase(
      TENANT_A,
      {},
      { store }
    );
    assertEq(allRows.length, 5, "default returns all five conversations");

    const withCase = await listConversationsByTenantWithOptionalCase(
      TENANT_A,
      { hasCase: true },
      { store }
    );
    assertEq(withCase.length, 2, "hasCase=true returns the two cased rows");
    assert(
      withCase.every((row) => row.case !== null),
      "hasCase=true rows all include a case"
    );

    const withoutCase = await listConversationsByTenantWithOptionalCase(
      TENANT_A,
      { hasCase: false },
      { store }
    );
    assertEq(withoutCase.length, 3, "hasCase=false returns the three no-case rows");
    assert(
      withoutCase.every((row) => row.case === null),
      "hasCase=false rows all have null case"
    );

    const leadRows = await listConversationsByTenantWithOptionalCase(
      TENANT_A,
      { caseType: "lead" },
      { store }
    );
    assertEq(leadRows.length, 1, "caseType=lead returns one row");
    assertEq(leadRows[0].case?.caseType, "lead", "lead row has lead case data");
  });

  // -------------------------------------------------------------------------
  // getCaseDetailById — CON-174 detail graph
  // -------------------------------------------------------------------------

  await test("getCaseDetailById: returns the tenant-scoped detail graph for the owning tenant", async () => {
    const store = createInMemoryCasesStore();
    const created = await createCase(
      TENANT_A,
      {
        conversationId: CONVO_A,
        caseType: "lead",
        title: "Buyer enquiry",
        ruleId: "lead-capture",
      },
      { store }
    );
    await setCaseAttribute(
      TENANT_A,
      { caseId: created.id, key: "topic", value: "pricing" },
      { store }
    );
    await recordCaseEvent(
      TENANT_A,
      {
        caseId: created.id,
        conversationId: CONVO_A,
        actorType: "system",
        eventType: "case.created",
      },
      { store }
    );

    const detail = await getCaseDetailById(TENANT_A, created.id, { store });
    assert(detail !== null, "detail returned");
    assertEq(detail!.case.id, created.id, "case included");
    assertEq(detail!.attributes.length, 1, "attributes included");
    assertEq(detail!.events.length, 1, "events included");
  });

  await test("getCaseDetailById: tenant B cannot read tenant A's detail graph", async () => {
    const store = createInMemoryCasesStore();
    const created = await createCase(
      TENANT_A,
      { conversationId: CONVO_A, caseType: "lead" },
      { store }
    );

    const detail = await getCaseDetailById(TENANT_B, created.id, { store });
    assertEq(detail, null, "cross-tenant detail lookup returns null");
  });

  await test("revealCasePiiForTenant: returns the requested field and writes pii_reveal audit event", async () => {
    const store = createInMemoryCasesStore();
    const created = await createCase(
      TENANT_A,
      { conversationId: CONVO_A, caseType: "lead" },
      { store }
    );
    store._seedCaseDetail(created.id, {
      contact: {
        id: "99999999-9999-4999-8999-999999999999",
        displayName: "Case Contact",
        emailNormalised: "case@example.com",
        phoneNormalised: "+61400000000",
        preferredContactMethod: "email",
        attributes: {},
        consentState: "captured",
        privacyNoticeVersion: "v1",
        privacyNoticeRecordedAt: new Date("2026-06-20T10:00:00Z"),
      },
    });

    const revealed = await revealCasePiiForTenant(
      TENANT_A,
      created.id,
      "emailNormalised",
      USER_X,
      { store }
    );
    assert(revealed !== null, "value returned");
    assertEq(revealed!.value, "case@example.com", "email revealed");

    const audit = store
      ._dump()
      .events.find((event) => event.eventType === "pii_reveal");
    assert(audit, "audit event written");
    assertEq(audit!.tenantId, TENANT_A, "audit tenant scoped");
    assertEq(audit!.payload.field as string, "emailNormalised", "field logged");
    assertEq(audit!.payload.actor_id as string, USER_X, "actor logged");
  });

  // -------------------------------------------------------------------------
  // recordCaseEvent (append-only)
  // -------------------------------------------------------------------------

  await test("recordCaseEvent: happy path appends to the case timeline", async () => {
    const store = createInMemoryCasesStore();
    const created = await createCase(
      TENANT_A,
      { conversationId: CONVO_A, caseType: "lead" },
      { store }
    );
    const evt = await recordCaseEvent(
      TENANT_A,
      {
        caseId: created.id,
        conversationId: CONVO_A,
        actorType: "system",
        eventType: "case.created",
        payload: { source: "rule" },
      },
      { store }
    );
    assertEq(evt.tenantId, TENANT_A, "tenantId stamped");
    assertEq(evt.caseId, created.id, "caseId stamped");
    assertEq(evt.eventType, "case.created", "eventType stamped");
    assertEq(store._dump().events.length, 1, "one event written");
  });

  await test("recordCaseEvent: cross-tenant writes are tagged to the writing tenant (cannot poison another tenant's timeline)", async () => {
    const store = createInMemoryCasesStore();
    const aCase = await createCase(
      TENANT_A,
      { conversationId: CONVO_A, caseType: "lead" },
      { store }
    );
    // Tenant B tries to write an event referencing tenant A's case id. The
    // helper stamps tenantId=B on the row, so when tenant A lists its
    // events by tenantId+caseId it cannot see B's write. (The in-memory
    // store mirrors the production WHERE clause.)
    await recordCaseEvent(
      TENANT_B,
      {
        caseId: aCase.id,
        conversationId: CONVO_B,
        actorType: "system",
        eventType: "noise",
      },
      { store }
    );
    const stored = store._dump().events;
    assertEq(stored.length, 1, "the row was stored");
    assertEq(stored[0].tenantId, TENANT_B, "stored under writer's tenant");
    // Tenant A reading its timeline (would be a list-by-case helper in
    // future tickets) won't see it because both tenantId AND caseId must
    // match — and tenant A's case lookup would have already failed.
  });

  await test("recordCaseEvent: rejects empty actorType", async () => {
    const store = createInMemoryCasesStore();
    await assertThrows(
      () =>
        recordCaseEvent(
          TENANT_A,
          {
            caseId: "11111111-1111-4111-8111-111111111111",
            conversationId: CONVO_A,
            actorType: "",
            eventType: "x",
          },
          { store }
        ),
      "actorType is required",
      "empty actorType"
    );
  });

  await test("recordCaseEvent: rejects empty eventType", async () => {
    const store = createInMemoryCasesStore();
    await assertThrows(
      () =>
        recordCaseEvent(
          TENANT_A,
          {
            caseId: "11111111-1111-4111-8111-111111111111",
            conversationId: CONVO_A,
            actorType: "system",
            eventType: "",
          },
          { store }
        ),
      "eventType is required",
      "empty eventType"
    );
  });

  await test("recordCaseEvent: rejects bad tenantId", async () => {
    const store = createInMemoryCasesStore();
    await assertThrows(
      () =>
        recordCaseEvent(
          "",
          {
            caseId: "11111111-1111-4111-8111-111111111111",
            conversationId: CONVO_A,
            actorType: "system",
            eventType: "x",
          },
          { store }
        ),
      "tenantId is required",
      "empty tenantId"
    );
  });

  // -------------------------------------------------------------------------
  // setCaseAttribute / getCaseAttributes
  // -------------------------------------------------------------------------

  await test("setCaseAttribute / getCaseAttributes: happy path upsert + read", async () => {
    const store = createInMemoryCasesStore();
    const created = await createCase(
      TENANT_A,
      { conversationId: CONVO_A, caseType: "lead" },
      { store }
    );

    await setCaseAttribute(
      TENANT_A,
      {
        caseId: created.id,
        key: "buyer_intent",
        value: "high",
        source: "classifier",
        confidence: 0.92,
      },
      { store }
    );
    let attrs = await getCaseAttributes(TENANT_A, created.id, { store });
    assertEq(attrs.length, 1, "one attribute stored");
    assertEq(attrs[0].key, "buyer_intent", "correct key");
    assertEq(attrs[0].value as string, "high", "correct value");
    assertEq(attrs[0].confidence, 0.92, "confidence stamped");

    // Upsert overwrites
    await setCaseAttribute(
      TENANT_A,
      {
        caseId: created.id,
        key: "buyer_intent",
        value: "medium",
        source: "classifier",
        confidence: 0.7,
      },
      { store }
    );
    attrs = await getCaseAttributes(TENANT_A, created.id, { store });
    assertEq(attrs.length, 1, "still one row");
    assertEq(attrs[0].value as string, "medium", "value overwritten");
  });

  await test("getCaseAttributes: tenant B sees empty array for tenant A's case (non-enumerating)", async () => {
    const store = createInMemoryCasesStore();
    const created = await createCase(
      TENANT_A,
      { conversationId: CONVO_A, caseType: "lead" },
      { store }
    );
    await setCaseAttribute(
      TENANT_A,
      { caseId: created.id, key: "k", value: 1 },
      { store }
    );
    const bAttrs = await getCaseAttributes(TENANT_B, created.id, { store });
    assertEq(bAttrs.length, 0, "tenant B sees zero attributes");
  });

  await test("setCaseAttribute: tenant B's write is partitioned (lands under B's tenantId)", async () => {
    const store = createInMemoryCasesStore();
    const aCase = await createCase(
      TENANT_A,
      { conversationId: CONVO_A, caseType: "lead" },
      { store }
    );
    await setCaseAttribute(
      TENANT_A,
      { caseId: aCase.id, key: "shared_key", value: "from-A" },
      { store }
    );
    await setCaseAttribute(
      TENANT_B,
      { caseId: aCase.id, key: "shared_key", value: "from-B" },
      { store }
    );

    const aAttrs = await getCaseAttributes(TENANT_A, aCase.id, { store });
    assertEq(aAttrs.length, 1, "A sees only its own attribute");
    assertEq(aAttrs[0].value as string, "from-A", "A's value untouched");

    const bAttrs = await getCaseAttributes(TENANT_B, aCase.id, { store });
    assertEq(bAttrs.length, 1, "B sees its own write only");
    assertEq(bAttrs[0].value as string, "from-B", "B's value visible to B");
  });

  await test("setCaseAttribute: rejects empty key", async () => {
    const store = createInMemoryCasesStore();
    await assertThrows(
      () =>
        setCaseAttribute(
          TENANT_A,
          {
            caseId: "11111111-1111-4111-8111-111111111111",
            key: "",
            value: 1,
          },
          { store }
        ),
      "key is required",
      "empty key"
    );
  });

  await test("setCaseAttribute: rejects bad tenantId", async () => {
    const store = createInMemoryCasesStore();
    await assertThrows(
      () =>
        setCaseAttribute(
          "bad",
          {
            caseId: "11111111-1111-4111-8111-111111111111",
            key: "k",
            value: 1,
          },
          { store }
        ),
      "tenantId must be a UUID",
      "bad tenantId"
    );
  });
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

runAllTests().then(() => {
  console.log("");
  console.log("=".repeat(60));
  console.log(`Tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("");
    console.log("Failures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
});
