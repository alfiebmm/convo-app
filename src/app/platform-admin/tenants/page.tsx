import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { withAuditLog } from "@/lib/platform-admin/audit";
import {
  canPaginateSort,
  isEmailQuery,
  loadTenants,
  parseTenantFilters,
  tenantPlans,
  tenantStatuses,
  type TenantListFilters,
  type TenantListRow,
} from "@/lib/platform-admin/tenants-query";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusClass(status: string) {
  if (status === "active") return "bg-green-100 text-green-800";
  if (status === "suspended") return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

function label(value: string) {
  return value.replace("_", " ");
}

function copyParams(params: Record<string, string | string[] | undefined>) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "cursor") continue;
    if (Array.isArray(value)) {
      for (const item of value) next.append(key, item);
    } else if (value) {
      next.set(key, value);
    }
  }
  return next;
}

function Row({ tenant }: { tenant: TenantListRow }) {
  return (
    <tr className="align-top">
      <td className="px-4 py-3">
        <Link
          href={`/platform-admin/tenants/${tenant.id}`}
          className="font-semibold text-zinc-950 underline-offset-2 hover:underline"
        >
          {tenant.name}
        </Link>
        <div className="mt-1 font-mono text-xs text-zinc-500">{tenant.slug}</div>
        {tenant.domain && <div className="mt-1 text-xs text-zinc-500">{tenant.domain}</div>}
      </td>
      <td className="px-4 py-3 text-zinc-700">{tenant.ownerEmail ?? "—"}</td>
      <td className="px-4 py-3 capitalize">{tenant.plan}</td>
      <td className="px-4 py-3 text-zinc-700">{formatDate(tenant.createdAt)}</td>
      <td className="px-4 py-3 text-zinc-700">{formatDateTime(tenant.lastConversationAt)}</td>
      <td className="px-4 py-3 text-zinc-700">{tenant.conversationCount30d}</td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusClass(
            tenant.status,
          )}`}
        >
          {label(tenant.status)}
        </span>
      </td>
    </tr>
  );
}

function FilterForm({
  filters,
  params,
}: {
  filters: TenantListFilters;
  params: Record<string, string | string[] | undefined>;
}) {
  const q = Array.isArray(params.q) ? params.q[0] : params.q;
  return (
    <form
      action="/platform-admin/tenants"
      className="grid gap-3 rounded-md border border-zinc-200 bg-white p-4 text-sm md:grid-cols-5"
    >
      <label className="space-y-1 md:col-span-2">
        <span className="font-medium text-zinc-700">Search</span>
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Name, slug, domain, or member email"
          className="w-full rounded-md border border-zinc-300 px-3 py-2"
        />
      </label>

      <label className="space-y-1">
        <span className="font-medium text-zinc-700">Plan</span>
        <select
          name="plan"
          multiple
          defaultValue={filters.plans}
          className="h-24 w-full rounded-md border border-zinc-300 px-3 py-2"
        >
          {tenantPlans.map((plan) => (
            <option key={plan} value={plan}>
              {plan}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1">
        <span className="font-medium text-zinc-700">Status</span>
        <select
          name="status"
          multiple
          defaultValue={filters.statuses}
          className="h-24 w-full rounded-md border border-zinc-300 px-3 py-2"
        >
          {tenantStatuses.map((status) => (
            <option key={status} value={status}>
              {label(status)}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1">
        <span className="font-medium text-zinc-700">Inactivity</span>
        <select
          name="inactivity"
          defaultValue={filters.inactivity ?? ""}
          className="w-full rounded-md border border-zinc-300 px-3 py-2"
        >
          <option value="">Any activity</option>
          <option value="30d">No conversations in 30 days</option>
          <option value="90d">No conversations in 90 days</option>
        </select>
      </label>

      <label className="space-y-1">
        <span className="font-medium text-zinc-700">Sort</span>
        <select
          name="sort"
          defaultValue={filters.sort}
          className="w-full rounded-md border border-zinc-300 px-3 py-2"
        >
          <option value="signup-desc">Signup newest</option>
          <option value="signup-asc">Signup oldest</option>
          <option value="name-asc">Name A-Z</option>
          <option value="name-desc">Name Z-A</option>
          <option value="plan-asc">Plan</option>
          <option value="status-asc">Status</option>
          <option value="last-conversation-desc">Last conversation</option>
          <option value="conversation-count-desc">30d conversations</option>
        </select>
      </label>

      <div className="flex items-end gap-3 md:col-span-4">
        <button
          type="submit"
          className="rounded-md bg-[#FF6B2C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#E85A1E]"
        >
          Apply filters
        </button>
        <Link
          href="/platform-admin/tenants"
          className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-zinc-50"
        >
          Clear
        </Link>
      </div>
    </form>
  );
}

async function TenantsResults({
  filters,
  params,
}: {
  filters: TenantListFilters;
  params: Record<string, string | string[] | undefined>;
}) {
  const result = await withAuditLog({
    action: "tenant.view",
    target: { type: "tenants_list", id: "all" },
    metadata: {
      filters: {
        plan: filters.plans,
        status: filters.statuses,
        inactivity: filters.inactivity,
        q: filters.q,
      },
      page_size: 50,
    },
    fn: async () => loadTenants(filters),
  });

  if (!result.ok) notFound();

  const nextParams = copyParams(params);
  if (result.value.nextCursor) nextParams.set("cursor", result.value.nextCursor);
  const canPaginate = canPaginateSort(filters.sort);

  return (
    <>
      {isEmailQuery(filters.q) && (
        <section className="overflow-hidden rounded-md border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3">
            <h2 className="font-semibold">Matched by member email</h2>
          </div>
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              Tenants with a member whose email matches the search.
            </caption>
            <tbody className="divide-y divide-zinc-200">
              {result.value.emailMatches.map((tenant) => (
                <Row key={tenant.id} tenant={tenant} />
              ))}
              {result.value.emailMatches.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-sm text-zinc-500">
                    No tenants matched that member email.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      <div className="overflow-hidden rounded-md border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">
            All tenants matching the current filters.
          </caption>
          <thead className="bg-zinc-100 text-xs uppercase text-zinc-600">
            <tr>
              <th scope="col" className="px-4 py-3">Tenant</th>
              <th scope="col" className="px-4 py-3">Owner email</th>
              <th scope="col" className="px-4 py-3">Plan</th>
              <th scope="col" className="px-4 py-3">Signup</th>
              <th scope="col" className="px-4 py-3">Last conversation</th>
              <th scope="col" className="px-4 py-3">Conversations (30d)</th>
              <th scope="col" className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {result.value.rows.map((tenant) => (
              <Row key={tenant.id} tenant={tenant} />
            ))}
            {result.value.rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                  No tenants match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-4">
        {result.value.nextCursor && canPaginate && (
          <Link
            href={`/platform-admin/tenants?${nextParams.toString()}`}
            className="inline-flex rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-zinc-50"
          >
            Next page
          </Link>
        )}
        {result.value.nextCursor && !canPaginate && (
          <p className="text-xs text-zinc-500">
            Pagination is only available on signup sorts. Switch the sort to
            paginate, or narrow the filters.
          </p>
        )}
      </div>
    </>
  );
}

function ResultsSkeleton() {
  return (
    <div
      className="space-y-4 animate-pulse"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="overflow-hidden rounded-md border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 bg-zinc-100 px-4 py-3">
          <div className="h-3 w-32 rounded bg-zinc-200" />
        </div>
        <div className="divide-y divide-zinc-200">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="grid grid-cols-7 gap-3 px-4 py-4">
              <div className="col-span-2 h-4 rounded bg-zinc-200" />
              <div className="h-4 rounded bg-zinc-200" />
              <div className="h-4 rounded bg-zinc-200" />
              <div className="h-4 rounded bg-zinc-200" />
              <div className="h-4 rounded bg-zinc-200" />
              <div className="h-4 rounded bg-zinc-200" />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Loading tenants…</span>
    </div>
  );
}

export default async function PlatformAdminTenantsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = parseTenantFilters(params);

  // Suspense key forces the inner subtree to re-suspend when filters change,
  // so the user sees the skeleton instead of stale data on every nav.
  const suspenseKey = JSON.stringify({
    q: filters.q,
    plans: filters.plans,
    statuses: filters.statuses,
    inactivity: filters.inactivity,
    sort: filters.sort,
    cursor: filters.cursor,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-normal">Tenants</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Search, filter, and drill into Convo tenant profiles.
        </p>
      </div>

      <FilterForm filters={filters} params={params} />

      <Suspense key={suspenseKey} fallback={<ResultsSkeleton />}>
        <TenantsResults filters={filters} params={params} />
      </Suspense>
    </div>
  );
}
