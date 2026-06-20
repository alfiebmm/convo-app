"use server";

import { auth } from "@/lib/auth";
import {
  getActiveTenantIdForUser,
  getTenantMembership,
} from "@/lib/auth-context";
import {
  isCasePiiField,
  revealCasePiiForTenant,
  type CasePiiField,
} from "@/lib/cases/pii";

export async function revealPii(caseId: string, fieldName: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorised");
  }
  if (!isCasePiiField(fieldName)) {
    throw new Error("Unsupported field");
  }

  const tenantId = await getActiveTenantIdForUser(session.user.id);
  if (!tenantId) {
    throw new Error("Tenant not found");
  }

  const membership = await getTenantMembership(session.user.id, tenantId);
  if (!membership) {
    throw new Error("Not found");
  }

  // TODO(CON-177): replace the membership-only gate with the final role or
  // permission helper once case actions and staff permissions land.
  const result = await revealCasePiiForTenant(
    tenantId,
    caseId,
    fieldName as CasePiiField,
    session.user.id
  );

  if (!result) {
    throw new Error("Not found");
  }

  return result;
}
