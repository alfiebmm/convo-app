/**
 * Cases data-access helpers (CON-164 / Epic B5).
 *
 * Tenant-scoped CRUD for `follow_up_cases`. Every public function:
 *   1. Takes `tenantId` as its FIRST parameter.
 *   2. Validates `tenantId` is a non-empty UUID before any DB call
 *      (`assertTenantId`).
 *   3. Routes all DB work through `CasesStore`, which guarantees a
 *      `tenant_id = $tenantId` predicate on every WHERE clause.
 *
 * There is NO function in this module that bypasses tenant scope. If you
 * find yourself needing to "look up a case across tenants", you are doing
 * something wrong — flag the caller in code review.
 *
 * Tests: `__tests__/cases.test.ts`.
 *
 * Downstream consumers (planned): Epic C rule engine, Epic D capture UX,
 * Epic E inbox, Epic F connector worker.
 */

import { assertTenantId, assertUuid } from "./tenant-guard";
import { resolveCta } from "@/lib/cta/resolve";
import { fireWebhookEvent } from "@/lib/connectors/webhook/hooks";
import {
  logAuditEvent,
  type AuditEventType,
} from "@/lib/audit/log-event";
import { sanitizeCaseNoteHtml } from "./sanitize";
import {
  getDefaultCasesStore,
  type CaseDetailRow,
  type CaseRow,
  type CaseListItemRow,
  type CaseStatus,
  type CasesStore,
  type ConnectorOutboxRow,
  type CreateCaseInput,
  type ListCasesFilters,
  type ListCasesWithActivityFilters,
} from "./store";

export type {
  CaseDetailMessageRow,
  CaseDetailRow,
  CaseRow,
  CaseListItemRow,
  CaseStatus,
  CasesStore,
  ConnectorOutboxRow,
  CreateCaseInput,
  ListCasesFilters,
  ListCasesWithActivityFilters,
} from "./store";

export interface CaseInternalLink {
  text: string;
  url: string;
  tag: string;
}

export interface CaseDetail extends CaseDetailRow {
  internalLinks: CaseInternalLink[];
}

/**
 * Optional override slot for callers (mostly tests) that want to inject a
 * non-default store. Defaults to the singleton Drizzle store. Production
 * callers should NEVER pass this — the default is the right answer.
 */
export interface CaseHelperOptions {
  store?: CasesStore;
}

function resolveStore(opts?: CaseHelperOptions): CasesStore {
  return opts?.store ?? getDefaultCasesStore();
}

function shouldFireWebhookHooks(opts?: CaseHelperOptions): boolean {
  return !opts?.store;
}

function caseWebhookPayload(event: string, row: CaseRow): Record<string, unknown> {
  return {
    event,
    case: row,
  };
}

function fireCaseWebhook(
  tenantId: string,
  event: "case.created" | "case.updated" | "case.resolved",
  row: CaseRow,
  idempotencyKey: string,
  opts?: CaseHelperOptions,
): void {
  if (!shouldFireWebhookHooks(opts)) return;
  fireWebhookEvent({
    tenantId,
    caseId: row.id,
    event,
    payload: caseWebhookPayload(event, row),
    idempotencyKey,
  });
}

async function logCaseScopedAuditEvent(
  tenantId: string,
  input: {
    caseId: string;
    conversationId: string;
    actorType: "user" | "visitor" | "system";
    actorId: string | null;
    eventType: AuditEventType;
    payload?: Record<string, unknown>;
  },
  opts?: CaseHelperOptions,
) {
  if (opts?.store) {
    await opts.store.insertEvent(tenantId, input);
    return;
  }
  await logAuditEvent({ tenantId, ...input });
}

// ---------------------------------------------------------------------------
// createCase
// ---------------------------------------------------------------------------

export type CreateCaseArgs = CreateCaseInput;

/**
 * Create a new follow-up case for the given tenant.
 *
 * @param tenantId Tenant UUID — REQUIRED.
 * @param args Case payload. `conversationId` and `caseType` are required;
 *   everything else is optional. `status` defaults to `"open"`.
 * @returns The persisted case row.
 *
 * @throws Error when `tenantId` is missing or not a valid UUID.
 * @throws Error when `args.conversationId` is missing or not a valid UUID.
 * @throws Error when `args.caseType` is empty.
 */
export async function createCase(
  tenantId: string,
  args: CreateCaseArgs,
  opts?: CaseHelperOptions
): Promise<CaseRow> {
  assertTenantId(tenantId);
  assertUuid(args.conversationId, "conversationId");
  if (args.contactId !== undefined && args.contactId !== null) {
    assertUuid(args.contactId, "contactId");
  }
  if (!args.caseType || typeof args.caseType !== "string") {
    throw new Error("caseType is required");
  }

  const row = await resolveStore(opts).insertCase(tenantId, args);
  fireCaseWebhook(tenantId, "case.created", row, `case.created:${row.id}`, opts);
  return row;
}

// ---------------------------------------------------------------------------
// updateCaseStatus
// ---------------------------------------------------------------------------

/**
 * Patch the status of an existing case. Returns the updated row, or `null`
 * if no case with `caseId` exists in the given tenant's scope.
 *
 * Setting status to `"resolved"` stamps `resolvedAt` to now; the rest of
 * the row is untouched. Callers that need to clear `resolvedAt` (re-open a
 * resolved case) should pass status = `"open"` and the helper will null the
 * `resolvedAt` column for symmetry.
 *
 * @param tenantId Tenant UUID — REQUIRED.
 * @param caseId Case UUID — REQUIRED.
 * @param status New status (one of the `follow_up_case_status` enum values).
 * @returns The updated row, or `null` if not found in the tenant scope.
 *
 * @throws Error when `tenantId`/`caseId` are missing or not valid UUIDs.
 */
export async function updateCaseStatus(
  tenantId: string,
  caseId: string,
  status: CaseStatus,
  opts?: CaseHelperOptions
): Promise<CaseRow | null> {
  assertTenantId(tenantId);
  assertUuid(caseId, "caseId");

  const patch: Parameters<CasesStore["updateCase"]>[2] = { status };
  if (status === "resolved") {
    patch.resolvedAt = new Date();
  } else if (status === "open") {
    patch.resolvedAt = null;
  }

  const row = await resolveStore(opts).updateCase(tenantId, caseId, patch);
  if (row) {
    const event = status === "resolved" ? "case.resolved" : "case.updated";
    fireCaseWebhook(
      tenantId,
      event,
      row,
      `${event}:${row.id}:${row.updatedAt.toISOString()}`,
      opts,
    );
  }
  return row;
}

// ---------------------------------------------------------------------------
// assignCase
// ---------------------------------------------------------------------------

/**
 * Assign (or unassign, with `assigneeUserId = null`) a case to a user.
 * Returns the updated row, or `null` if no case with `caseId` exists in
 * the given tenant's scope.
 *
 * Note: this helper does NOT verify that `assigneeUserId` is a member of
 * the tenant. That validation belongs in the API route that takes the
 * staff input — keeping it out of the helper keeps the data layer thin
 * and avoids re-implementing tenant-membership checks here.
 *
 * @param tenantId Tenant UUID — REQUIRED.
 * @param caseId Case UUID — REQUIRED.
 * @param assigneeUserId User UUID to assign to, or `null` to unassign.
 * @returns The updated row, or `null` if not found in the tenant scope.
 *
 * @throws Error when `tenantId`/`caseId` are missing or not valid UUIDs.
 * @throws Error when `assigneeUserId` is a non-null string but not a UUID.
 */
export async function assignCase(
  tenantId: string,
  caseId: string,
  assigneeUserId: string | null,
  opts?: CaseHelperOptions
): Promise<CaseRow | null> {
  assertTenantId(tenantId);
  assertUuid(caseId, "caseId");
  if (assigneeUserId !== null) {
    assertUuid(assigneeUserId, "assigneeUserId");
  }

  const row = await resolveStore(opts).updateCase(tenantId, caseId, {
    assignedTo: assigneeUserId,
  });
  if (row) {
    fireCaseWebhook(
      tenantId,
      "case.updated",
      row,
      `case.updated:${row.id}:assigned:${row.updatedAt.toISOString()}`,
      opts,
    );
  }
  return row;
}

export async function assignCaseWithAudit(
  tenantId: string,
  caseId: string,
  assigneeUserId: string | null,
  actorId: string,
  opts?: CaseHelperOptions
): Promise<CaseRow | null> {
  assertTenantId(tenantId);
  assertUuid(caseId, "caseId");
  assertUuid(actorId, "actorId");
  if (assigneeUserId !== null) {
    assertUuid(assigneeUserId, "assigneeUserId");
  }

  const store = resolveStore(opts);
  const current = await store.findCaseById(tenantId, caseId);
  if (!current) return null;

  const updated = await store.updateCase(tenantId, caseId, {
    assignedTo: assigneeUserId,
  });
  if (!updated) return null;

  await logCaseScopedAuditEvent(tenantId, {
    caseId,
    conversationId: current.conversationId,
    actorType: "user",
    actorId,
    eventType: "assignment_change",
    payload: {
      assigned_to: assigneeUserId,
      prev_assigned_to: current.assignedTo,
      actor_id: actorId,
    },
  }, opts);

  fireCaseWebhook(
    tenantId,
    "case.updated",
    updated,
    `case.updated:${updated.id}:assigned:${updated.updatedAt.toISOString()}`,
    opts,
  );

  return updated;
}

export async function resolveCaseWithAudit(
  tenantId: string,
  caseId: string,
  actorId: string,
  opts?: CaseHelperOptions
): Promise<CaseRow | null> {
  assertTenantId(tenantId);
  assertUuid(caseId, "caseId");
  assertUuid(actorId, "actorId");

  const store = resolveStore(opts);
  const current = await store.findCaseById(tenantId, caseId);
  if (!current) return null;

  const updated = await store.updateCase(tenantId, caseId, {
    status: "resolved",
    resolvedAt: new Date(),
  });
  if (!updated) return null;

  await logCaseScopedAuditEvent(tenantId, {
    caseId,
    conversationId: current.conversationId,
    actorType: "user",
    actorId,
    eventType: "status_change",
    payload: {
      previous_status: current.status,
      status: "resolved",
      actor_id: actorId,
    },
  }, opts);

  fireCaseWebhook(
    tenantId,
    "case.resolved",
    updated,
    `case.resolved:${updated.id}:${updated.updatedAt.toISOString()}`,
    opts,
  );

  return updated;
}

export async function dismissCaseWithAudit(
  tenantId: string,
  caseId: string,
  reason: string,
  actorId: string,
  opts?: CaseHelperOptions
): Promise<CaseRow | null> {
  assertTenantId(tenantId);
  assertUuid(caseId, "caseId");
  assertUuid(actorId, "actorId");

  const trimmedReason = reason.trim();
  if (trimmedReason.length < 1 || trimmedReason.length > 1000) {
    throw new Error("Dismiss reason must be 1-1000 characters");
  }

  const store = resolveStore(opts);
  const current = await store.findCaseById(tenantId, caseId);
  if (!current) return null;

  const updated = await store.updateCase(tenantId, caseId, {
    status: "dismissed",
    resolvedAt: null,
  });
  if (!updated) return null;

  await logCaseScopedAuditEvent(tenantId, {
    caseId,
    conversationId: current.conversationId,
    actorType: "user",
    actorId,
    eventType: "status_change",
    payload: {
      previous_status: current.status,
      status: "dismissed",
      reason: trimmedReason,
      actor_id: actorId,
    },
  }, opts);

  fireCaseWebhook(
    tenantId,
    "case.updated",
    updated,
    `case.updated:${updated.id}:dismissed:${updated.updatedAt.toISOString()}`,
    opts,
  );

  return updated;
}

export async function addCaseNote(
  tenantId: string,
  caseId: string,
  bodyHtml: string,
  actorId: string,
  opts?: CaseHelperOptions
) {
  assertTenantId(tenantId);
  assertUuid(caseId, "caseId");
  assertUuid(actorId, "actorId");

  const sanitized = sanitizeCaseNoteHtml(bodyHtml);
  if (!sanitized) {
    throw new Error("Note body is required");
  }

  const store = resolveStore(opts);
  const current = await store.findCaseById(tenantId, caseId);
  if (!current) return null;

  const event = await store.insertEvent(tenantId, {
    caseId,
    conversationId: current.conversationId,
    actorType: "user",
    actorId,
    eventType: "note_added",
    payload: { body_html: sanitized, actor_id: actorId },
  });
  fireCaseWebhook(
    tenantId,
    "case.updated",
    current,
    `case.updated:${caseId}:note:${event.id}`,
    opts,
  );
  return event;
}

export interface RequeueOutboxResult {
  row: ConnectorOutboxRow;
  requeued: boolean;
}

export async function requeueOutboxRow(
  tenantId: string,
  outboxId: string,
  actorId: string,
  opts?: CaseHelperOptions
): Promise<RequeueOutboxResult | null> {
  assertTenantId(tenantId);
  assertUuid(outboxId, "outboxId");
  assertUuid(actorId, "actorId");

  const store = resolveStore(opts);
  const existing = await store.findConnectorOutboxRow(tenantId, outboxId);
  if (!existing) return null;
  if (existing.status !== "failed") {
    return { row: existing, requeued: false };
  }

  const updated = await store.requeueFailedConnectorOutboxRow(tenantId, outboxId);
  if (!updated) return { row: existing, requeued: false };

  const kase = await store.findCaseById(tenantId, updated.caseId);
  if (!kase) return { row: updated, requeued: true };

  await store.insertEvent(tenantId, {
    caseId: updated.caseId,
    conversationId: kase.conversationId,
    actorType: "user",
    actorId,
    eventType: "sync_retried",
    payload: { outbox_id: outboxId, actor_id: actorId },
  });

  return { row: updated, requeued: true };
}

// ---------------------------------------------------------------------------
// listCasesByTenant
// ---------------------------------------------------------------------------

/**
 * List cases for a tenant, newest first. Supports server-side filtering on
 * status / case_type / assignee and basic pagination.
 *
 * @param tenantId Tenant UUID — REQUIRED.
 * @param filters Optional filters + pagination. `limit` defaults to 50,
 *   max enforced server-side (not here — keep the helper dumb). `offset`
 *   defaults to 0.
 * @returns Array of case rows in `createdAt DESC` order.
 *
 * @throws Error when `tenantId` is missing or not a valid UUID.
 */
export async function listCasesByTenant(
  tenantId: string,
  filters: ListCasesFilters = {},
  opts?: CaseHelperOptions
): Promise<CaseRow[]> {
  assertTenantId(tenantId);
  if (filters.assignedTo !== undefined && filters.assignedTo !== null) {
    assertUuid(filters.assignedTo, "filters.assignedTo");
  }

  return resolveStore(opts).listCases(tenantId, filters);
}

// ---------------------------------------------------------------------------
// listCasesByTenantWithActivity
// ---------------------------------------------------------------------------

/**
 * List tenant-scoped case rows for the conversations inbox, including the
 * joined conversation/contact/owner/connector columns and computed activity.
 *
 * Last activity is calculated by the store as:
 *   GREATEST(MAX(messages.created_at), MAX(follow_up_events.created_at))
 * with `conversations.started_at` as the fallback when both sides are empty.
 *
 * @param tenantId Tenant UUID — REQUIRED.
 * @param filters Case, attribute, connector and activity-date filters.
 * @returns Array of enriched case rows in `lastActivityAt DESC` order.
 *
 * @throws Error when `tenantId` is missing or not a valid UUID.
 */
export async function listCasesByTenantWithActivity(
  tenantId: string,
  filters: ListCasesWithActivityFilters = {},
  opts?: CaseHelperOptions
): Promise<CaseListItemRow[]> {
  assertTenantId(tenantId);
  if (filters.assignedTo !== undefined && filters.assignedTo !== null) {
    assertUuid(filters.assignedTo, "filters.assignedTo");
  }

  return resolveStore(opts).listCasesWithActivity(tenantId, filters);
}

// ---------------------------------------------------------------------------
// getCaseById
// ---------------------------------------------------------------------------

/**
 * Fetch a single case by id, scoped to the tenant. Returns `null` when the
 * case does not exist OR belongs to a different tenant. Callers MUST treat
 * `null` as "not found" — never retry under a different tenant scope.
 *
 * @param tenantId Tenant UUID — REQUIRED.
 * @param caseId Case UUID — REQUIRED.
 * @returns The case row, or `null` if not found in this tenant.
 *
 * @throws Error when `tenantId`/`caseId` are missing or not valid UUIDs.
 */
export async function getCaseById(
  tenantId: string,
  caseId: string,
  opts?: CaseHelperOptions
): Promise<CaseRow | null> {
  assertTenantId(tenantId);
  assertUuid(caseId, "caseId");

  return resolveStore(opts).findCaseById(tenantId, caseId);
}

// ---------------------------------------------------------------------------
// getCaseByConversation
// ---------------------------------------------------------------------------

/**
 * Fetch the (at most one) case bound to a `(tenant, conversation)` pair.
 * Returns `null` when no case exists yet for this conversation, OR when the
 * conversation belongs to a different tenant.
 *
 * The uniqueness guarantee comes from the
 * `follow_up_cases_tenant_conversation_unique` index (CON-161). Callers
 * (CON-170 / D2a chat-route lifecycle) use this to decide between
 * `createCase` (first re-eval that resolves a case-creating action) and
 * a no-op reuse (subsequent re-evals on the same conversation).
 *
 * @param tenantId Tenant UUID — REQUIRED.
 * @param conversationId Conversation UUID — REQUIRED.
 * @returns The case row, or `null` if none.
 *
 * @throws Error when `tenantId`/`conversationId` are missing or not valid UUIDs.
 */
export async function getCaseByConversation(
  tenantId: string,
  conversationId: string,
  opts?: CaseHelperOptions
): Promise<CaseRow | null> {
  assertTenantId(tenantId);
  assertUuid(conversationId, "conversationId");

  return resolveStore(opts).findCaseByConversation(tenantId, conversationId);
}

// ---------------------------------------------------------------------------
// getCaseDetailById
// ---------------------------------------------------------------------------

function resolveInternalLinks(detail: CaseDetailRow): CaseInternalLink[] {
  const lastAssistant = [...detail.messages]
    .reverse()
    .find((message) => message.role === "assistant");
  if (!lastAssistant) return [];

  const result = resolveCta({
    settings: detail.tenantSettings,
    messages: detail.messages.map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.content,
    })),
    assistantResponse: lastAssistant.content,
  });

  return result.cta ? [result.cta] : [];
}

/**
 * Fetch the complete case-detail graph for the conversations inbox panel.
 * Returns `null` when the case is unknown or belongs to another tenant.
 *
 * The store performs one tenant-scoped query for the graph. This helper adds
 * the derived CTA/internal-link view using the existing CTA resolver.
 */
export async function getCaseDetailById(
  tenantId: string,
  caseId: string,
  opts?: CaseHelperOptions
): Promise<CaseDetail | null> {
  assertTenantId(tenantId);
  assertUuid(caseId, "caseId");

  const detail = await resolveStore(opts).getCaseDetailById(tenantId, caseId);
  if (!detail) return null;

  return {
    ...detail,
    internalLinks: resolveInternalLinks(detail),
  };
}
