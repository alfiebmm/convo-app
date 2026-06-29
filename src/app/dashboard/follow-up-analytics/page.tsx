import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentTenant } from "@/lib/auth-context";
import { assertTenantId } from "@/lib/cases/tenant-guard";
import { withDashboardErrorLogging } from "@/lib/errors/wrap";

import {
  getCasesByRoutingKey,
  getCasesCreated,
  getConnectorDelivery,
  getRuleFireCounts,
} from "./actions";
import {
  ANALYTICS_RANGES,
  parseAnalyticsRange,
  type CasesByRoutingKey,
  type CasesCreated,
  type ConnectorDelivery,
  type RuleFireCount,
} from "./analytics";

const ACCENT = "#FF6B2C";

async function FollowUpAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");
  assertTenantId(tenant.id);

  const params = await searchParams;
  const range = parseAnalyticsRange(
    Array.isArray(params.range) ? params.range[0] : params.range,
  );

  const [ruleCounts, casesCreated, connectorDelivery, routingKeys] =
    await Promise.all([
      getRuleFireCounts(range),
      getCasesCreated(range),
      getConnectorDelivery(range),
      getCasesByRoutingKey(range),
    ]);

  return (
    <div className="font-[Inter] text-zinc-900">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-[Outfit] text-2xl font-bold">
            Follow-up analytics
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Rule activity, case volume, connector delivery and routing trends.
          </p>
        </div>
        <DateRangeSelector activeRange={range} />
      </header>

      <div className="grid gap-6 xl:grid-cols-2">
        <RuleFireCountsSection rows={ruleCounts} />
        <CasesCreatedSection data={casesCreated} />
        <ConnectorDeliverySection data={connectorDelivery} />
        <RoutingKeySection rows={routingKeys} />
      </div>
    </div>
  );
}

function DateRangeSelector({ activeRange }: { activeRange: string }) {
  return (
    <div className="inline-flex w-fit overflow-hidden rounded-lg border border-zinc-200 bg-white p-1">
      {ANALYTICS_RANGES.map((range) => {
        const active = activeRange === range;
        return (
          <Link
            key={range}
            href={`/dashboard/follow-up-analytics?range=${range}`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "text-white"
                : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
            }`}
            style={active ? { backgroundColor: ACCENT } : undefined}
          >
            {range}
          </Link>
        );
      })}
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5">
      <h2 className="font-[Outfit] text-base font-semibold text-zinc-900">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">
      {children}
    </div>
  );
}

function RuleFireCountsSection({ rows }: { rows: RuleFireCount[] }) {
  const max = maxCount(rows);
  return (
    <SectionCard title="Rule fire counts">
      {rows.length === 0 ? (
        <EmptyState>No rule fires in the selected period.</EmptyState>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <BarRow
              key={row.ruleId}
              label={row.ruleName}
              count={row.count}
              max={max}
            />
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function CasesCreatedSection({ data }: { data: CasesCreated }) {
  const hasData = data.byCaseType.length > 0 || data.byStatus.length > 0;
  return (
    <SectionCard title="Cases created">
      {!hasData ? (
        <EmptyState>No cases created in the selected period.</EmptyState>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          <Breakdown title="By case type" rows={data.byCaseType} />
          <Breakdown title="By status" rows={data.byStatus} />
        </div>
      )}
    </SectionCard>
  );
}

function ConnectorDeliverySection({ data }: { data: ConnectorDelivery }) {
  const total = data.successCount + data.failureCount;
  return (
    <SectionCard title="Connector delivery">
      {total === 0 ? (
        <EmptyState>No connector deliveries in the selected period.</EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Delivered" value={data.successCount} tone="success" />
          <StatCard label="Failed" value={data.failureCount} tone="danger" />
        </div>
      )}
    </SectionCard>
  );
}

function RoutingKeySection({ rows }: { rows: CasesByRoutingKey }) {
  const max = maxCount(rows);
  return (
    <SectionCard title="Cases by routing key">
      {rows.length === 0 ? (
        <EmptyState>No routing keys in the selected period.</EmptyState>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <BarRow
              key={row.routingKey}
              label={row.routingKey}
              count={row.count}
              max={max}
            />
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function Breakdown({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ count: number } & Record<string, string | number>>;
}) {
  const max = maxCount(rows);
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-zinc-700">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">No data.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const label = String(row.caseType ?? row.status ?? "Unknown");
            return (
              <BarRow key={label} label={formatLabel(label)} count={row.count} max={max} />
            );
          })}
        </div>
      )}
    </div>
  );
}

function BarRow({
  label,
  count,
  max,
}: {
  label: string;
  count: number;
  max: number;
}) {
  const width = max > 0 ? Math.max((count / max) * 100, 6) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
        <span className="truncate font-medium text-zinc-700">{formatLabel(label)}</span>
        <span className="tabular-nums text-zinc-500">{count}</span>
      </div>
      <div className="h-2 rounded-full bg-zinc-100">
        <div
          className="h-2 rounded-full"
          style={{ width: `${width}%`, backgroundColor: ACCENT }}
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "danger";
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <p className="text-sm font-medium text-zinc-500">{label}</p>
      <p
        className={`mt-2 font-[Outfit] text-3xl font-bold ${
          tone === "success" ? "text-green-600" : "text-red-600"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function maxCount(rows: Array<{ count: number }>) {
  return rows.reduce((max, row) => Math.max(max, row.count), 0);
}

function formatLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default withDashboardErrorLogging(FollowUpAnalyticsPage, {
  route: "/dashboard/follow-up-analytics",
});
