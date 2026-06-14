/**
 * Case events helper (CON-164 / Epic B5).
 *
 * `follow_up_events` is the immutable audit timeline for a case. This
 * module exposes ONE function — `recordCaseEvent` — which appends a row.
 *
 * Append-only by design: there is no `updateEvent` or `deleteEvent` in
 * this module, and there must never be. If you need to amend a prior
 * event, append a new one with a `corrects` link in `payload`.
 */

import { assertTenantId, assertUuid } from "./tenant-guard";
import {
  getDefaultCasesStore,
  type CaseEventRow,
  type CasesStore,
  type RecordCaseEventInput,
} from "./store";

export type { CaseEventRow, RecordCaseEventInput } from "./store";

export interface CaseEventHelperOptions {
  store?: CasesStore;
}

function resolveStore(opts?: CaseEventHelperOptions): CasesStore {
  return opts?.store ?? getDefaultCasesStore();
}

/**
 * Append an event to a case's audit timeline.
 *
 * @param tenantId Tenant UUID — REQUIRED.
 * @param input Event payload: `caseId`, `conversationId`, `actorType`,
 *   `eventType` are required; `actorId` and `payload` are optional.
 *   `payload` defaults to `{}`.
 * @returns The persisted event row (with server-assigned `id` + `createdAt`).
 *
 * @throws Error when `tenantId`, `input.caseId`, or `input.conversationId`
 *   are missing or not valid UUIDs.
 * @throws Error when `input.actorType` or `input.eventType` are empty.
 */
export async function recordCaseEvent(
  tenantId: string,
  input: RecordCaseEventInput,
  opts?: CaseEventHelperOptions
): Promise<CaseEventRow> {
  assertTenantId(tenantId);
  assertUuid(input.caseId, "caseId");
  assertUuid(input.conversationId, "conversationId");
  if (!input.actorType || typeof input.actorType !== "string") {
    throw new Error("actorType is required");
  }
  if (!input.eventType || typeof input.eventType !== "string") {
    throw new Error("eventType is required");
  }

  return resolveStore(opts).insertEvent(tenantId, input);
}
