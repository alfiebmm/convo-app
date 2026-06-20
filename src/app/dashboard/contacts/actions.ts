"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  getActiveTenantIdForUser,
  getTenantMembership,
} from "@/lib/auth-context";
import { canViewCasePii } from "@/lib/auth/permissions";
import { revealContactIdentifierForTenant } from "@/lib/contacts/pii";

export async function revealContactIdentifier(
  contactId: string,
  identifierId: string,
) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorised");
  }

  const tenantId = await getActiveTenantIdForUser(session.user.id);
  if (!tenantId) {
    throw new Error("Tenant not found");
  }

  const membership = await getTenantMembership(session.user.id, tenantId);
  if (!membership) {
    throw new Error("Not found");
  }

  if (!canViewCasePii(membership)) {
    throw new Error("Forbidden");
  }

  const result = await revealContactIdentifierForTenant(
    tenantId,
    contactId,
    identifierId,
    session.user.id,
  );
  if (!result) {
    throw new Error("Not found");
  }

  revalidatePath(`/dashboard/contacts/${contactId}`);
  return result;
}
