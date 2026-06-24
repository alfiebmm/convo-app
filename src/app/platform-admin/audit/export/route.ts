import { listAuditRows, parseAuditFilters } from "@/lib/platform-admin/audit-query";
import { withAuditLog } from "@/lib/platform-admin/audit";

export const dynamic = "force-dynamic";

function csvEscape(value: unknown) {
  if (value === null || value === undefined) return "";
  const text =
    typeof value === "string" ? value : JSON.stringify(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows: Awaited<ReturnType<typeof listAuditRows>>["rows"]) {
  const headers = [
    "id",
    "created_at",
    "actor_user_id",
    "actor_email",
    "actor_ip",
    "action",
    "target_type",
    "target_id",
    "status",
    "correlation_id",
    "idempotency_key",
    "reason",
    "support_context",
    "before_state",
    "after_state",
    "metadata",
  ];
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => csvEscape(row[header as keyof typeof row]))
        .join(","),
    ),
  ];
  return `${lines.join("\n")}\n`;
}

function paramsFromForm(formData: FormData) {
  const params: Record<string, string | string[]> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string" || value === "") continue;
    const existing = params[key];
    if (Array.isArray(existing)) {
      existing.push(value);
    } else if (existing) {
      params[key] = [existing, value];
    } else {
      params[key] = value;
    }
  }
  return params;
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const params = contentType.includes("application/json")
    ? ((await request.json()) as Record<string, string | string[] | undefined>)
    : paramsFromForm(await request.formData());
  const filters = { ...parseAuditFilters(params), cursor: undefined };
  let csv = "";

  const result = await withAuditLog({
    action: "audit.export",
    target: { type: "admin_audit_log", id: "export" },
    metadata: { filters },
    resultMetadata: (value) => ({ row_count: value.rowCount }),
    fn: async () => {
      const { rows } = await listAuditRows(filters, { limit: 10000 });
      csv = toCsv(rows);
      return { rowCount: rows.length };
    },
  });

  if (!result.ok) {
    return Response.json(
      { error: "Audit export failed", correlationId: result.correlationId },
      { status: 500 },
    );
  }

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="admin-audit-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
    },
  });
}
