import { recordCaseEvent } from "./events";
import { getCaseDetailById, type CaseHelperOptions } from "./index";
import { assertTenantId, assertUuid } from "./tenant-guard";

export const CASE_PII_FIELDS = [
  "displayName",
  "emailNormalised",
  "phoneNormalised",
] as const;

export type CasePiiField = (typeof CASE_PII_FIELDS)[number];

export interface RevealCasePiiResult {
  field: CasePiiField;
  value: string | null;
}

export function isCasePiiField(value: string): value is CasePiiField {
  return CASE_PII_FIELDS.includes(value as CasePiiField);
}

export async function revealCasePiiForTenant(
  tenantId: string,
  caseId: string,
  field: CasePiiField,
  actorId: string,
  opts?: CaseHelperOptions
): Promise<RevealCasePiiResult | null> {
  assertTenantId(tenantId);
  assertUuid(caseId, "caseId");
  assertUuid(actorId, "actorId");

  const detail = await getCaseDetailById(tenantId, caseId, opts);
  if (!detail) return null;

  const value = detail.contact?.[field] ?? null;

  await recordCaseEvent(
    tenantId,
    {
      caseId,
      conversationId: detail.case.conversationId,
      actorType: "user",
      actorId,
      eventType: "pii_reveal",
      payload: { field, actor_id: actorId },
    },
    opts
  );

  return { field, value };
}
