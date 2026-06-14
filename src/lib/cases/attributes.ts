/**
 * Case attributes helper (CON-164 / Epic B5).
 *
 * `follow_up_case_attributes` is a key/value snapshot keyed by
 * `(case_id, key)`. It stores the latest classifier signal per attribute
 * (the events table keeps the history). Helpers expose set + get only —
 * deletes happen via `ON DELETE CASCADE` on the parent case.
 */

import { assertTenantId, assertUuid } from "./tenant-guard";
import {
  getDefaultCasesStore,
  type CaseAttributeRow,
  type CasesStore,
  type SetCaseAttributeInput,
} from "./store";

export type { CaseAttributeRow, SetCaseAttributeInput } from "./store";

export interface CaseAttributeHelperOptions {
  store?: CasesStore;
}

function resolveStore(opts?: CaseAttributeHelperOptions): CasesStore {
  return opts?.store ?? getDefaultCasesStore();
}

/**
 * Set (upsert) an attribute on a case. Re-running with the same
 * `(caseId, key)` overwrites the previous value, source, and confidence
 * and stamps `detectedAt = now()`.
 *
 * @param tenantId Tenant UUID — REQUIRED.
 * @param input Attribute payload. `caseId` and `key` are required; `value`
 *   may be any JSON-serialisable value (the column is `jsonb`).
 * @returns The persisted row.
 *
 * @throws Error when `tenantId`/`input.caseId` are missing or not valid UUIDs.
 * @throws Error when `input.key` is empty.
 */
export async function setCaseAttribute(
  tenantId: string,
  input: SetCaseAttributeInput,
  opts?: CaseAttributeHelperOptions
): Promise<CaseAttributeRow> {
  assertTenantId(tenantId);
  assertUuid(input.caseId, "caseId");
  if (!input.key || typeof input.key !== "string") {
    throw new Error("key is required");
  }

  return resolveStore(opts).upsertAttribute(tenantId, input);
}

/**
 * List all attributes on a case, scoped to the tenant. Returns an empty
 * array if the case has no attributes OR if the case does not belong to
 * this tenant (non-enumerating — never leak the existence of a
 * cross-tenant case).
 *
 * @param tenantId Tenant UUID — REQUIRED.
 * @param caseId Case UUID — REQUIRED.
 * @returns Array of attribute rows (no defined order).
 *
 * @throws Error when `tenantId`/`caseId` are missing or not valid UUIDs.
 */
export async function getCaseAttributes(
  tenantId: string,
  caseId: string,
  opts?: CaseAttributeHelperOptions
): Promise<CaseAttributeRow[]> {
  assertTenantId(tenantId);
  assertUuid(caseId, "caseId");

  return resolveStore(opts).listAttributes(tenantId, caseId);
}
