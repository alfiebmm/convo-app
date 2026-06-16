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
import {
  getDefaultCasesStore,
  type CaseRow,
  type CaseStatus,
  type CasesStore,
  type CreateCaseInput,
  type ListCasesFilters,
} from "./store";

export type {
  CaseRow,
  CaseStatus,
  CasesStore,
  CreateCaseInput,
  ListCasesFilters,
} from "./store";

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

  return resolveStore(opts).insertCase(tenantId, args);
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

  return resolveStore(opts).updateCase(tenantId, caseId, patch);
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

  return resolveStore(opts).updateCase(tenantId, caseId, {
    assignedTo: assigneeUserId,
  });
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
