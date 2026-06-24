import Link from "next/link";
import {
  listAuditFilterOptions,
  listAuditRows,
  parseAuditFilters,
} from "@/lib/platform-admin/audit-query";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function prettyJson(value: unknown) {
  if (value === null || value === undefined) return "null";
  return JSON.stringify(value, null, 2);
}

function valueFor(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function PlatformAdminAuditPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = parseAuditFilters(params);
  const [{ rows, nextCursor }, options] = await Promise.all([
    listAuditRows(filters),
    listAuditFilterOptions(),
  ]);

  const nextParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) nextParams.append(key, item);
    } else if (value) {
      nextParams.set(key, value);
    }
  }
  if (nextCursor) nextParams.set("cursor", nextCursor);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-normal">
            Admin audit
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Intent and outcome rows for platform-admin actions.
          </p>
        </div>
        <form action="/platform-admin/audit/export" method="post">
          {Object.entries(params).map(([key, value]) =>
            Array.isArray(value) ? (
              value.map((item) => (
                <input key={`${key}-${item}`} type="hidden" name={key} value={item} />
              ))
            ) : (
              <input key={key} type="hidden" name={key} value={value ?? ""} />
            ),
          )}
          <button
            type="submit"
            className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Export CSV
          </button>
        </form>
      </div>

      <form
        action="/platform-admin/audit"
        className="grid gap-3 rounded-md border border-zinc-200 bg-white p-4 text-sm md:grid-cols-4"
      >
        <label className="space-y-1">
          <span className="font-medium text-zinc-700">Actor</span>
          <select
            name="actor"
            defaultValue={filters.actor ?? ""}
            className="w-full rounded-md border border-zinc-300 px-3 py-2"
          >
            <option value="">Any actor</option>
            {options.actors.map((actor) => (
              <option key={actor} value={actor}>
                {actor}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="font-medium text-zinc-700">Action</span>
          <select
            name="action"
            multiple
            defaultValue={filters.actions}
            className="h-24 w-full rounded-md border border-zinc-300 px-3 py-2"
          >
            {options.actions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="font-medium text-zinc-700">Target type</span>
          <select
            name="target_type"
            defaultValue={filters.targetType ?? ""}
            className="w-full rounded-md border border-zinc-300 px-3 py-2"
          >
            <option value="">Any type</option>
            {options.targetTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="font-medium text-zinc-700">Status</span>
          <select
            name="status"
            defaultValue={filters.status ?? ""}
            className="w-full rounded-md border border-zinc-300 px-3 py-2"
          >
            <option value="">Any status</option>
            <option value="intent">intent</option>
            <option value="outcome:success">outcome:success</option>
            <option value="outcome:error">outcome:error</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className="font-medium text-zinc-700">Target ID</span>
          <input
            name="target_id"
            defaultValue={valueFor(params, "target_id")}
            className="w-full rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>

        <label className="space-y-1">
          <span className="font-medium text-zinc-700">Correlation ID</span>
          <input
            name="correlation_id"
            defaultValue={valueFor(params, "correlation_id")}
            className="w-full rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>

        <label className="space-y-1">
          <span className="font-medium text-zinc-700">From</span>
          <input
            type="date"
            name="from"
            defaultValue={filters.from}
            className="w-full rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>

        <label className="space-y-1">
          <span className="font-medium text-zinc-700">To</span>
          <input
            type="date"
            name="to"
            defaultValue={filters.to ?? ""}
            className="w-full rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>

        <div className="md:col-span-4">
          <button
            type="submit"
            className="rounded-md bg-[#FF6B2C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#E85A1E]"
          >
            Apply filters
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-md border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-100 text-xs uppercase text-zinc-600">
            <tr>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Target</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Correlation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {rows.map((row) => (
              <tr key={row.id} className="align-top">
                <td className="px-4 py-3 text-zinc-700">
                  {new Date(row.created_at).toLocaleString("en-AU")}
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-semibold text-zinc-600">
                      Details
                    </summary>
                    <div className="mt-3 grid gap-3 text-xs md:grid-cols-2">
                      <pre className="overflow-auto rounded bg-zinc-950 p-3 text-zinc-100">
                        {prettyJson(row.before_state)}
                      </pre>
                      <pre className="overflow-auto rounded bg-zinc-950 p-3 text-zinc-100">
                        {prettyJson(row.after_state)}
                      </pre>
                      <pre className="overflow-auto rounded bg-zinc-950 p-3 text-zinc-100 md:col-span-2">
                        {prettyJson(row.metadata)}
                      </pre>
                      {(row.reason || row.support_context) && (
                        <div className="rounded bg-zinc-100 p-3 md:col-span-2">
                          <p>
                            <span className="font-semibold">Reason:</span>{" "}
                            {row.reason ?? "None"}
                          </p>
                          <p>
                            <span className="font-semibold">Support context:</span>{" "}
                            {row.support_context ?? "None"}
                          </p>
                        </div>
                      )}
                    </div>
                  </details>
                </td>
                <td className="px-4 py-3">{row.actor_email}</td>
                <td className="px-4 py-3 font-mono text-xs">{row.action}</td>
                <td className="px-4 py-3">
                  <div>{row.target_type ?? "none"}</div>
                  <div className="font-mono text-xs text-zinc-500">
                    {row.target_id ?? "none"}
                  </div>
                </td>
                <td className="px-4 py-3">{row.status}</td>
                <td className="px-4 py-3 font-mono text-xs">
                  <Link
                    href={`/platform-admin/audit/${row.correlation_id}`}
                    className="text-[#E85A1E] underline-offset-2 hover:underline"
                  >
                    {row.correlation_id}
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  No audit rows match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {nextCursor && (
        <Link
          href={`/platform-admin/audit?${nextParams.toString()}`}
          className="inline-flex rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-zinc-50"
        >
          Next page
        </Link>
      )}
    </div>
  );
}
