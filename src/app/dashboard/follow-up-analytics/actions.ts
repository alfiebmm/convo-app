"use server";

import { getCurrentTenant } from "@/lib/auth-context";
import { assertTenantId } from "@/lib/cases/tenant-guard";

import {
  getCasesByRoutingKeyForTenant,
  getCasesCreatedForTenant,
  getConnectorDeliveryForTenant,
  getRuleFireCountsForTenant,
  parseAnalyticsRange,
} from "./analytics";

async function requireTenantId() {
  const tenant = await getCurrentTenant();
  if (!tenant) {
    throw new Error("Tenant not found");
  }
  assertTenantId(tenant.id);
  return tenant.id;
}

export async function getRuleFireCounts(range: string = "7d") {
  const tenantId = await requireTenantId();
  return getRuleFireCountsForTenant(tenantId, parseAnalyticsRange(range));
}

export async function getCasesCreated(range: string = "7d") {
  const tenantId = await requireTenantId();
  return getCasesCreatedForTenant(tenantId, parseAnalyticsRange(range));
}

export async function getConnectorDelivery(range: string = "7d") {
  const tenantId = await requireTenantId();
  return getConnectorDeliveryForTenant(tenantId, parseAnalyticsRange(range));
}

export async function getCasesByRoutingKey(range: string = "7d") {
  const tenantId = await requireTenantId();
  return getCasesByRoutingKeyForTenant(tenantId, parseAnalyticsRange(range));
}
