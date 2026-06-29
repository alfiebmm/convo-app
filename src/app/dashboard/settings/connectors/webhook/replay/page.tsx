import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getCurrentTenant,
  getCurrentUser,
  getTenantMembership,
} from "@/lib/auth-context";
import { canManageConnectors, canViewCasePii } from "@/lib/auth/permissions";
import { assertTenantId } from "@/lib/cases/tenant-guard";
import {
  listOutboxRowsForTenant,
  type WebhookOutboxStatus,
} from "@/lib/connectors/webhook/replay-actions";
import { redactWebhookPayload } from "@/lib/connectors/webhook/redact";
import { getConnectorHealthMetrics } from "./actions";
import { ReplayOutboxTable } from "./replay-outbox-table";

const STATUS_FILTERS: { value: WebhookOutboxStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
  { value: "abandoned", label: "Abandoned" },
];

function normaliseParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseStatus(value: string | undefined): WebhookOutboxStatus | undefined {
  if (
    value === "pending" ||
    value === "sent" ||
    value === "failed" ||
    value === "abandoned"
  ) {
    return value;
  }
  return undefined;
}

function filterHref(status: WebhookOutboxStatus | "all") {
  if (status === "all") return "/dashboard/settings/connectors/webhook/replay";
  return `/dashboard/settings/connectors/webhook/replay?status=${status}`;
}

export default async function WebhookReplayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");
  assertTenantId(tenant.id);

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const membership = await getTenantMembership(user.id, tenant.id);
  const canReplay = canManageConnectors(membership);
  const canRevealPii = canViewCasePii(membership);

  const params = await searchParams;
  const status = parseStatus(normaliseParam(params.status));
  const cursor = normaliseParam(params.cursor) ?? null;
  const [outbox, metrics] = await Promise.all([
    listOutboxRowsForTenant(tenant.id, { status, cursor }),
    getConnectorHealthMetrics(),
  ]);
  const rows = outbox.rows.map((row) => ({
    ...row,
    payload: redactWebhookPayload(row.payload, { canRevealPii }),
  }));

  const nextHref = outbox.nextCursor
    ? `/dashboard/settings/connectors/webhook/replay?${new URLSearchParams({
        ...(status ? { status } : {}),
        cursor: outbox.nextCursor,
      }).toString()}`
    : null;

  return (
    <div>
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">
            Webhook outbox replay
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Review delivery rows for this tenant and replay individual webhook
            events.
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            Last attempt shows the successful delivery timestamp when available;
            V1 does not store failed attempt timestamps.
          </p>
        </div>
        <Link
          href="/dashboard/settings/connectors/webhook"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
        >
          Back to settings
        </Link>
      </header>

      <section className="mb-6 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-3">
          <Metric
            label="24h success rate"
            value={`${metrics.successRate24h.toFixed(1)}%`}
            detail={`${metrics.totalAttempts24h} attempted`}
          />
          <Metric
            label="24h failures"
            value={String(metrics.failureCount24h)}
            detail="Failed or abandoned rows"
          />
          <Metric
            label="24h average latency"
            value={formatLatency(metrics.avgLatencyMs24h)}
            detail="Delivered rows only"
          />
        </div>
      </section>

      <nav className="flex flex-wrap gap-2" aria-label="Webhook outbox status filters">
        {STATUS_FILTERS.map((filter) => {
          const active = (status ?? "all") === filter.value;
          return (
            <Link
              key={filter.value}
              href={filterHref(filter.value)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "border-[#FF6B2C] bg-[#FF6B2C] text-white"
                  : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {filter.label}
            </Link>
          );
        })}
      </nav>

      <ReplayOutboxTable rows={rows} canReplay={canReplay} />

      {nextHref && (
        <div className="mt-6">
          <Link
            href={nextHref}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            Next page
          </Link>
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-zinc-900">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{detail}</p>
    </div>
  );
}

function formatLatency(value: number | null): string {
  if (value === null) return "No data";
  if (value < 1000) return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(1)} s`;
}
