/**
 * Tenant-scope guard shared by every case/contact helper (CON-164).
 *
 * Every public helper in `src/lib/cases/*` and `src/lib/contacts/*` MUST
 * call `assertTenantId(tenantId)` as its first executable statement. This
 * guarantees that even if a caller passes an empty string, `undefined`
 * coerced to a string, or a non-UUID, we throw before any DB call.
 *
 * This is the type-system + runtime audit point referenced by Linear
 * CON-164: "100% of helper functions have tenant scope baked in".
 */

/**
 * Strict RFC 4122 v1–v5 UUID regex. Permissive on hyphenation case but
 * rejects anything that is not a canonical 8-4-4-4-12 hex layout with a
 * version digit between 1–5 and a variant nibble of 8/9/a/b. Matches the
 * default `gen_random_uuid()` shape used by the Postgres tables we read.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Throws if `tenantId` is missing or not a syntactically valid UUID.
 *
 * @throws Error "tenantId is required" when `tenantId` is null/undefined/empty.
 * @throws Error "tenantId must be a UUID" when `tenantId` is not a valid UUID.
 */
export function assertTenantId(tenantId: string): asserts tenantId is string {
  if (tenantId === undefined || tenantId === null || tenantId === "") {
    throw new Error("tenantId is required");
  }
  if (typeof tenantId !== "string") {
    throw new Error("tenantId must be a string");
  }
  if (!UUID_RE.test(tenantId)) {
    throw new Error("tenantId must be a UUID");
  }
}

/**
 * Same as `assertTenantId` but for any UUID-shaped field (caseId, contactId,
 * conversationId, etc.). Surfaces the field name in the error so callers
 * see exactly which arg failed validation.
 *
 * @throws Error "<fieldName> is required" when `value` is empty.
 * @throws Error "<fieldName> must be a UUID" when `value` is not a valid UUID.
 */
export function assertUuid(value: string, fieldName: string): asserts value is string {
  if (value === undefined || value === null || value === "") {
    throw new Error(`${fieldName} is required`);
  }
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string`);
  }
  if (!UUID_RE.test(value)) {
    throw new Error(`${fieldName} must be a UUID`);
  }
}
