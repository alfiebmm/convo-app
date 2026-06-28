"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { getCurrentTenant } from "@/lib/auth-context";
import { assertTenantId } from "@/lib/cases/tenant-guard";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import {
  rotateWebhookSecretForTenant,
  saveWebhookSettingsForTenant,
  sendTestWebhookForTenant,
  type WebhookSettingsStore,
} from "@/lib/connectors/webhook/settings-actions";

const WEBHOOK_SETTINGS_PATH = "/dashboard/settings/connectors/webhook";

function buildStore(): WebhookSettingsStore {
  return {
    async getTenantSettings(tenantId) {
      assertTenantId(tenantId);
      const [tenant] = await db
        .select({ settings: tenants.settings })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);
      if (!tenant) return null;
      return (tenant.settings ?? {}) as Record<string, unknown>;
    },
    async saveTenantSettings(tenantId, settings) {
      assertTenantId(tenantId);
      const [updated] = await db
        .update(tenants)
        .set({ settings, updatedAt: new Date() })
        .where(eq(tenants.id, tenantId))
        .returning({ settings: tenants.settings });
      return (updated?.settings ?? settings) as Record<string, unknown>;
    },
  };
}

async function requireTenantId() {
  const tenant = await getCurrentTenant();
  if (!tenant) {
    throw new Error("Tenant not found");
  }
  assertTenantId(tenant.id);
  return tenant.id;
}

export async function saveWebhookSettings(input: unknown) {
  const tenantId = await requireTenantId();
  const result = await saveWebhookSettingsForTenant(tenantId, input, buildStore());
  revalidatePath(WEBHOOK_SETTINGS_PATH);
  return result;
}

export async function rotateWebhookSecret() {
  const tenantId = await requireTenantId();
  const result = await rotateWebhookSecretForTenant(tenantId, buildStore());
  revalidatePath(WEBHOOK_SETTINGS_PATH);
  return result;
}

export async function sendTestWebhook() {
  const tenantId = await requireTenantId();
  return sendTestWebhookForTenant(tenantId, buildStore());
}
