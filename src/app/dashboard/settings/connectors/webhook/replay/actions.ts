"use server";

import { revalidatePath } from "next/cache";

import { getCurrentTenant } from "@/lib/auth-context";
import { assertTenantId } from "@/lib/cases/tenant-guard";
import {
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

export async function replayOutboxRow(rowId: string) {
  const tenantId = await requireTenantId();
  const result = await replayOutboxRowForTenant(tenantId, rowId);
  revalidatePath(WEBHOOK_REPLAY_PATH);
  revalidatePath("/dashboard/settings/connectors/webhook");
  return result;
}
