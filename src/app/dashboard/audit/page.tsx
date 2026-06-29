import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentTenant } from "@/lib/auth-context";
import { assertTenantId } from "@/lib/cases/tenant-guard";
import { withDashboardErrorLogging } from "@/lib/errors/wrap";

import {
  AUDIT_EVENT_TYPES,
  encodeAuditCursor,
  parseAuditCursor,
  parseAuditEventTypes,
  type AuditEventRow,
} from "./query";
import { listAuditEvents } from "./actions";

const ACCENT = "#FF6B2C";

function normaliseParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function normaliseParamArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseToDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T23:59:59.999Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

function buildHref(
  params: Record<string, string | string[] | undefined>,
  next: Record<string, string | string[] | null>,
) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...params, ...next })) {
    if (value === null || value === undefined || value === "") continue;
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) search.append(key, item);
  }
  const query = search.toString();
  return query ? `/dashboard/audit?${query}` : "/dashboard/audit";
}

async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");
  assertTenantId(tenant.id);

  const params = await searchParams;
  const selectedTypes = parseAuditEventTypes(normaliseParamArray(params.event_type));
  const actorId = normaliseParam(params.actor_id)?.trim() || undefined;
  const from = normaliseParam(params.from);
  const to = normaliseParam(params.to);
  const cursor = parseAuditCursor(normaliseParam(params.cursor));

  const result = await listAuditEvents(
    {
      eventTypes: selectedTypes,
      actorId,
      from: parseDate(from),
      to: parseToDate(to),
    },
    cursor,
  );
  const nextCursor = encodeAuditCursor(result.nextCursor);

  return (
    <div className="font-[Inter] text-zinc-900">
      <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="font-[Outfit] text-2xl font-bold">Audit log</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Tenant-scoped records of PII access, exports, workflow changes and
            connector delivery attempts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportLink params={params} format="csv" />
          <ExportLink params={params} format="xlsx" />
        </div>
      </header>

      <form className="mb-5 rounded-lg border border-zinc-200 bg-white p-4">
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
          <label className="text-sm font-medium text-zinc-700">
            Event type
            <select
              name="event_type"
              multiple
              defaultValue={selectedTypes}
              className="mt-1 min-h-28 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
            >
              {AUDIT_EVENT_TYPES.map((eventType) => (
                <option key={eventType} value={eventType}>
                  {formatLabel(eventType)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-zinc-700">
            Actor ID
            <input
              name="actor_id"
              defaultValue={actorId ?? ""}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-medium text-zinc-700">
            From
            <input
              name="from"
              type="date"
              defaultValue={from ?? ""}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-medium text-zinc-700">
            To
            <input
              name="to"
              type="date"
              defaultValue={to ?? ""}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="rounded-md px-4 py-2 text-sm font-semibold text-white"
              style={{ backgroundColor: ACCENT }}
            >
              Filter
            </button>
            <Link
              href="/dashboard/audit"
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700"
            >
              Reset
            </Link>
          </div>
        </div>
      </form>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Case</th>
              <th className="px-4 py-3">Payload</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {result.rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-zinc-500">
                  No audit events match these filters.
                </td>
              </tr>
            ) : (
              result.rows.map((row) => <AuditRow key={row.id} row={row} />)
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-zinc-500">
        <span>{result.rows.length} events shown</span>
        {nextCursor ? (
          <Link
            href={buildHref(params, { cursor: nextCursor })}
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 font-semibold text-zinc-700"
          >
            Next page
          </Link>
        ) : (
          <span>No more events</span>
        )}
      </div>
    </div>
  );
}

function ExportLink({
  params,
  format,
}: {
  params: Record<string, string | string[] | undefined>;
  format: "csv" | "xlsx";
}) {
  const href = buildHref(params, { format, cursor: null }).replace(
    "/dashboard/audit",
    "/api/audit/export",
  );
  return (
    <Link
      href={href}
      className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700"
    >
      Export {format.toUpperCase()}
    </Link>
  );
}

function AuditRow({ row }: { row: AuditEventRow }) {
  return (
    <tr className="align-top">
      <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
        {formatDateTime(row.createdAt)}
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700">
          {formatLabel(row.eventType)}
        </span>
      </td>
      <td className="px-4 py-3 text-zinc-600">
        <div className="font-medium text-zinc-800">{row.actorId ?? "system"}</div>
        <div className="text-xs text-zinc-500">{row.actorType}</div>
      </td>
      <td className="px-4 py-3">
        {row.caseId ? (
          <Link
            href={`/dashboard/conversations?case=${row.caseId}`}
            className="font-medium text-zinc-800 underline decoration-zinc-300 underline-offset-2"
          >
            {row.caseId}
          </Link>
        ) : (
          <span className="text-zinc-400">None</span>
        )}
      </td>
      <td className="max-w-xl px-4 py-3">
        <details>
          <summary className="cursor-pointer text-sm font-medium text-zinc-700">
            View JSON
          </summary>
          <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-zinc-50 p-3 text-xs text-zinc-700">
            {JSON.stringify(row.payload, null, 2)}
          </pre>
        </details>
      </td>
    </tr>
  );
}

export default withDashboardErrorLogging(AuditPage, {
  route: "/dashboard/audit",
});
