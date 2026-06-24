import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminAuditLogClient, type AuditRow } from "@/lib/platform-admin/audit";

type PageProps = {
  params: Promise<{ correlationId: string }>;
};

function prettyJson(value: unknown) {
  if (value === null || value === undefined) return "null";
  return JSON.stringify(value, null, 2);
}

export default async function PlatformAdminAuditOperationPage({
  params,
}: PageProps) {
  const { correlationId } = await params;
  const table = await getAdminAuditLogClient();
  const { data, error } = await table
    .select("*")
    .eq("correlation_id", correlationId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw error;
  const rows = (data ?? []) as AuditRow[];
  if (rows.length === 0) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/platform-admin/audit"
          className="text-sm font-semibold text-[#E85A1E] underline-offset-2 hover:underline"
        >
          Back to audit
        </Link>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-normal">
          Audit operation
        </h1>
        <p className="mt-1 font-mono text-sm text-zinc-600">{correlationId}</p>
      </div>

      <div className="space-y-4">
        {rows.map((row) => (
          <article
            key={row.id}
            className="rounded-md border border-zinc-200 bg-white p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-mono text-sm font-semibold">{row.action}</h2>
                <p className="mt-1 text-sm text-zinc-600">
                  {row.status} by {row.actor_email} at{" "}
                  {new Date(row.created_at).toLocaleString("en-AU")}
                </p>
              </div>
              <div className="text-right text-sm">
                <div>{row.target_type ?? "none"}</div>
                <div className="font-mono text-xs text-zinc-500">
                  {row.target_id ?? "none"}
                </div>
              </div>
            </div>

            {(row.reason || row.support_context) && (
              <div className="mt-4 rounded bg-zinc-100 p-3 text-sm">
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

            <div className="mt-4 grid gap-3 text-xs md:grid-cols-2">
              <pre className="overflow-auto rounded bg-zinc-950 p-3 text-zinc-100">
                {prettyJson(row.before_state)}
              </pre>
              <pre className="overflow-auto rounded bg-zinc-950 p-3 text-zinc-100">
                {prettyJson(row.after_state)}
              </pre>
              <pre className="overflow-auto rounded bg-zinc-950 p-3 text-zinc-100 md:col-span-2">
                {prettyJson(row.metadata)}
              </pre>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
