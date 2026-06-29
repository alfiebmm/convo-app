import { auth } from "@/lib/auth";
import {
  getActiveTenantIdForUser,
  getTenantMembership,
} from "@/lib/auth-context";
import { canViewCasePii } from "@/lib/auth/permissions";
import { assertTenantId } from "@/lib/cases/tenant-guard";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import {
  contentTypeForFormat,
  exportFilename,
  serialiseCsv,
  serialiseXlsx,
  type ExportCellValue,
  type ExportColumn,
} from "@/lib/exports/files";
import { eq } from "drizzle-orm";

import {
  listAuditEventsForTenant,
  parseAuditCursor,
  parseAuditEventTypes,
  type AuditEventRow,
} from "@/app/dashboard/audit/query";
import { logAuditEvent } from "@/lib/audit/log-event";

export const runtime = "nodejs";

type ExportFormat = "csv" | "xlsx";

type AuditExportRow = Record<string, ExportCellValue> & {
  created_at: string;
  event_type: string;
  actor_id: string;
  actor_type: string;
  case_id: string;
  conversation_id: string;
  payload_json: string;
};

const AUDIT_COLUMNS: ExportColumn<AuditExportRow>[] = [
  { key: "created_at", header: "created_at" },
  { key: "event_type", header: "event_type" },
  { key: "actor_id", header: "actor_id" },
  { key: "actor_type", header: "actor_type" },
  { key: "case_id", header: "case_id" },
  { key: "conversation_id", header: "conversation_id" },
  { key: "payload_json", header: "payload_json" },
];

function parseFormat(params: URLSearchParams): ExportFormat | null {
  const format = params.get("format") ?? "csv";
  return format === "csv" || format === "xlsx" ? format : null;
}

function parseDate(value: string | null, endOfDay = false): Date | undefined {
  if (!value) return undefined;
  const suffix = endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z";
  const date = new Date(`${value}${suffix}`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function toExportRow(row: AuditEventRow): AuditExportRow {
  return {
    created_at: row.createdAt.toISOString(),
    event_type: row.eventType,
    actor_id: row.actorId ?? "",
    actor_type: row.actorType,
    case_id: row.caseId ?? "",
    conversation_id: row.conversationId ?? "",
    payload_json: JSON.stringify(row.payload),
  };
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const format = parseFormat(params);
  if (!format) {
    return Response.json({ error: "Unsupported format" }, { status: 400 });
  }

  const session = await auth();
  const actorId = session?.user?.id;
  if (!actorId) {
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  }

  const tenantId = await getActiveTenantIdForUser(actorId);
  if (!tenantId) {
    return Response.json({ error: "Tenant not found" }, { status: 404 });
  }
  assertTenantId(tenantId);

  const membership = await getTenantMembership(actorId, tenantId);
  if (!membership) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (!canViewCasePii(membership)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const [tenant] = await db
    .select({ slug: tenants.slug })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  if (!tenant) {
    return Response.json({ error: "Tenant not found" }, { status: 404 });
  }

  const filters = {
    eventTypes: parseAuditEventTypes(params.getAll("event_type")),
    actorId: params.get("actor_id")?.trim() || undefined,
    from: parseDate(params.get("from")),
    to: parseDate(params.get("to"), true),
  };

  const rows: AuditEventRow[] = [];
  let cursor = parseAuditCursor(params.get("cursor"));
  for (;;) {
    const page = await listAuditEventsForTenant(tenantId, filters, cursor, {
      limit: 500,
    });
    rows.push(...page.rows);
    cursor = page.nextCursor;
    if (!cursor || rows.length >= 5000) break;
  }

  await logAuditEvent({
    tenantId,
    actorId,
    actorType: "user",
    eventType: "export",
    payload: {
      scope: "audit",
      filter: Object.fromEntries(params.entries()),
      row_count: rows.length,
      format,
      truncated: rows.length >= 5000,
    },
  });

  const exportRows = rows.map(toExportRow);
  const body =
    format === "csv"
      ? serialiseCsv(AUDIT_COLUMNS, exportRows)
      : await serialiseXlsx(AUDIT_COLUMNS, exportRows, "Audit log");
  const responseBody: BodyInit =
    typeof body === "string" ? body : new Uint8Array(body);
  const filename = exportFilename("audit", tenant.slug, format);

  return new Response(responseBody, {
    headers: {
      "Content-Type": contentTypeForFormat(format),
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
