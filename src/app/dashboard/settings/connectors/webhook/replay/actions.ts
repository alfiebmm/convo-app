"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import {
  getActiveTenantIdForUser,
  getCurrentTenant,
  getTenantMembership,
} from "@/lib/auth-context";
import { canManageConnectors } from "@/lib/auth/permissions";
import { assertTenantId } from "@/lib/cases/tenant-guard";
import {
  getConnectorHealthMetricsForTenant,
  listOutboxRowsForTenant,
  replayOutboxRowForTenant,
  type ListOutboxRowsInput,
} from "@/lib/connectors/webhook/replay-actions";

const WEBHOOK_REPLAY_PATH = "/dashboard/settings/connectors/webhook/replay";

async function requireTenantId() {
  const tenant = await getCurrentTenant();
  if (!tenant) {
    throw new Error("Tenant not found");
  }
  assertTenantId(tenant.id);
  return tenant.id;
}

export async function listOutboxRows(filter: ListOutboxRowsInput = {}) {
  const tenantId = await requireTenantId();
  return listOutboxRowsForTenant(tenantId, filter);
}

export async function getConnectorHealthMetrics() {
  const tenantId = await requireTenantId();
  return getConnectorHealthMetricsForTenant(tenantId);
}

export async function replayOutboxRow(rowId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorised");
  }

  const tenantId = await getActiveTenantIdForUser(session.user.id);
  if (!tenantId) {
    throw new Error("Tenant not found");
  }
  assertTenantId(tenantId);

  const membership = await getTenantMembership(session.user.id, tenantId);
  if (!membership) {
    throw new Error("Not found");
  }

  if (!canManageConnectors(membership)) {
    throw new Error("Forbidden");
  }

  const result = await replayOutboxRowForTenant(tenantId, rowId, {
    canManageConnectors: true,
  });
  revalidatePath(WEBHOOK_REPLAY_PATH);
  revalidatePath("/dashboard/settings/connectors/webhook");
  return result;
}
