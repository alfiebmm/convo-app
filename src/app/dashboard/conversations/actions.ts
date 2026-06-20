"use server";

import { auth } from "@/lib/auth";
import {
  getActiveTenantIdForUser,
  getTenantMembership,
} from "@/lib/auth-context";
import { canMutateCases, canViewCasePii } from "@/lib/auth/permissions";
import {
  addCaseNote,
  assignCaseWithAudit,
  dismissCaseWithAudit,
  requeueOutboxRow,
  resolveCaseWithAudit,
} from "@/lib/cases";
import {
  isCasePiiField,
  revealCasePiiForTenant,
  type CasePiiField,
} from "@/lib/cases/pii";
import { revalidatePath } from "next/cache";

async function requireCaseActionContext() {
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
  if (!canMutateCases(membership)) {
    throw new Error("Forbidden");
  }

  return { tenantId, actorId: session.user.id };
}

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

  if (!canViewCasePii(membership)) {
    throw new Error("Forbidden");
  }

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

export async function assignCaseAction(caseId: string, assigneeUserId: string) {
  const { tenantId, actorId } = await requireCaseActionContext();
  const nextAssignee = assigneeUserId.trim() || null;

  if (nextAssignee) {
    const assigneeMembership = await getTenantMembership(nextAssignee, tenantId);
    if (!assigneeMembership) {
      throw new Error("Assignee not found");
    }
  }

  const updated = await assignCaseWithAudit(
    tenantId,
    caseId,
    nextAssignee,
    actorId
  );
  if (!updated) {
    throw new Error("Not found");
  }

  revalidatePath("/dashboard/conversations");
  return { message: nextAssignee ? "Assigned" : "Unassigned" };
}

export async function addInternalNoteAction(caseId: string, bodyHtml: string) {
  const { tenantId, actorId } = await requireCaseActionContext();
  const event = await addCaseNote(tenantId, caseId, bodyHtml, actorId);
  if (!event) {
    throw new Error("Not found");
  }

  revalidatePath("/dashboard/conversations");
  return { message: "Note added" };
}

export async function resolveCaseAction(caseId: string) {
  const { tenantId, actorId } = await requireCaseActionContext();
  const updated = await resolveCaseWithAudit(tenantId, caseId, actorId);
  if (!updated) {
    throw new Error("Not found");
  }

  revalidatePath("/dashboard/conversations");
  return { message: "Resolved" };
}

export async function dismissCaseAction(caseId: string, reason: string) {
  const { tenantId, actorId } = await requireCaseActionContext();
  const updated = await dismissCaseWithAudit(tenantId, caseId, reason, actorId);
  if (!updated) {
    throw new Error("Not found");
  }

  revalidatePath("/dashboard/conversations");
  return { message: "Dismissed" };
}

export async function retrySyncAction(outboxId: string) {
  const { tenantId, actorId } = await requireCaseActionContext();

  try {
    const result = await requeueOutboxRow(tenantId, outboxId, actorId);
    if (!result) {
      throw new Error("Not found");
    }

    revalidatePath("/dashboard/conversations");
    return {
      message: result.requeued ? "Sync queued" : "Nothing to retry",
      requeued: result.requeued,
    };
  } catch (error) {
    console.error("[cases] retry sync failed", {
      tenantId,
      outboxId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
