import { redirect } from "next/navigation";
import Link from "next/link";
import { and, eq, sql } from "drizzle-orm";

import { getCurrentTenant } from "@/lib/auth-context";
import { assertTenantId } from "@/lib/cases/tenant-guard";
import { connectorOutbox } from "@/lib/db/schema";
import { db } from "@/lib/db";
import {
  parseTenantWebhookSettings,
  type WebhookEvent,
} from "@/lib/connectors/webhook/settings";
import { WebhookSettingsPanel } from "./webhook-settings-panel";

export type WebhookStatusSummary = {
  lastSuccessfulDeliveryAt: string | null;
  pendingCount: number;
  abandonedCount: number;
};

export default async function WebhookSettingsPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");
  assertTenantId(tenant.id);

  const webhookSettings = parseTenantWebhookSettings(tenant.settings);
  const status = await getWebhookStatusSummary(tenant.id);

  return (
    <div>
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Webhook connector</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Send subscribed case and contact events to your HTTPS endpoint.
          </p>
        </div>
        <Link
          href="/dashboard/settings/connectors/webhook/replay"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
        >
          View outbox
        </Link>
      </header>

      <WebhookSettingsPanel
        initialSettings={{
          enabled: webhookSettings?.enabled ?? false,
          url: webhookSettings?.url ?? "",
          events: webhookSettings?.events ?? defaultEvents(),
          hasSecret: Boolean(webhookSettings?.secret_ciphertext),
        }}
        status={status}
      />
    </div>
  );
}

async function getWebhookStatusSummary(
  tenantId: string,
): Promise<WebhookStatusSummary> {
  assertTenantId(tenantId);

  const [lastSuccessful] = await db
    .select({
      deliveredAt: sql<Date | null>`max(${connectorOutbox.deliveredAt})`,
    })
    .from(connectorOutbox)
    .where(
      and(
        eq(connectorOutbox.tenantId, tenantId),
        eq(connectorOutbox.connectorType, "webhook"),
        eq(connectorOutbox.status, "sent"),
      ),
    );

  const [pending] = await db
    .select({ count: sql<number>`count(*)` })
    .from(connectorOutbox)
    .where(
      and(
        eq(connectorOutbox.tenantId, tenantId),
        eq(connectorOutbox.connectorType, "webhook"),
        eq(connectorOutbox.status, "pending"),
      ),
    );

  const [abandoned] = await db
    .select({ count: sql<number>`count(*)` })
    .from(connectorOutbox)
    .where(
      and(
        eq(connectorOutbox.tenantId, tenantId),
        eq(connectorOutbox.connectorType, "webhook"),
        eq(connectorOutbox.status, "abandoned"),
      ),
    );

  return {
    lastSuccessfulDeliveryAt: lastSuccessful?.deliveredAt
      ? new Date(lastSuccessful.deliveredAt).toISOString()
      : null,
    pendingCount: Number(pending?.count ?? 0),
    abandonedCount: Number(abandoned?.count ?? 0),
  };
}

function defaultEvents(): WebhookEvent[] {
  return ["case.created", "case.updated", "case.resolved", "contact.updated"];
}
