"use server";

import { getCurrentTenant } from "@/lib/auth-context";
import { assertTenantId } from "@/lib/cases/tenant-guard";

import {
  getAuditEventDetailForTenant,
  listAuditEventsForTenant,
  type AuditCursor,
  type AuditEventFilters,
  type AuditEventRow,
  type ListAuditEventsResult,
} from "./query";

async function requireTenantId() {
  const tenant = await getCurrentTenant();
  if (!tenant) {
    throw new Error("Tenant not found");
  }
  assertTenantId(tenant.id);
  return tenant.id;
}

export async function listAuditEvents(
  filters: AuditEventFilters = {},
  cursor: AuditCursor | null = null,
): Promise<ListAuditEventsResult> {
  const tenantId = await requireTenantId();
  return listAuditEventsForTenant(tenantId, filters, cursor);
}

export async function getAuditEventDetail(
  eventId: string,
): Promise<AuditEventRow | null> {
  const tenantId = await requireTenantId();
  return getAuditEventDetailForTenant(tenantId, eventId);
}
