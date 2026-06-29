import { auth } from "@/lib/auth";
import { getActiveTenantIdForUser, getTenantMembership } from "@/lib/auth-context";
import { canViewCasePii } from "@/lib/auth/permissions";
import { assertTenantId } from "@/lib/cases/tenant-guard";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import {
  listCasesByTenantWithActivity,
  type CaseListItemRow,
} from "@/lib/cases";
import { getContactDetailById, type ContactDetailRow } from "@/lib/contacts";
import {
  contentTypeForFormat,
  exportFilename,
  serialiseCsv,
  serialiseXlsx,
  type ExportCellValue,
  type ExportColumn,
} from "@/lib/exports/files";
import { parseCaseExportFilters } from "@/lib/exports/filters";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

type ExportFormat = "csv" | "xlsx";

interface TenantForExport {
  id: string;
  slug: string;
}

type Membership = Awaited<ReturnType<typeof getTenantMembership>>;

type CaseExportRow = Record<string, ExportCellValue> & {
  case_id: string;
  conversation_id: string;
  contact_id: string;
  case_type: string;
  status: string;
  priority: string;
  title: string;
  summary: string;
  reason: string;
  source: string;
  rule_id: string;
  assigned_owner_name: string;
  contact_display_name: string;
  email: string;
  phone: string;
  contact_identifiers: string;
  latest_connector_type: string;
  latest_connector_destination_id: string;
  latest_connector_status: string;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
  pii_redacted: boolean;
};

export interface CaseExportDeps {
  getSessionUserId: () => Promise<string | null>;
  getActiveTenant: (userId: string) => Promise<TenantForExport | null>;
  getTenantMembership: (userId: string, tenantId: string) => Promise<Membership>;
  canExportPii: (membership: Membership) => boolean;
  listCases: typeof listCasesByTenantWithActivity;
  getContactDetail: typeof getContactDetailById;
  now: () => Date;
}

const CASE_COLUMNS: ExportColumn<CaseExportRow>[] = [
  { key: "case_id", header: "case_id" },
  { key: "conversation_id", header: "conversation_id" },
  { key: "contact_id", header: "contact_id" },
  { key: "case_type", header: "case_type" },
  { key: "status", header: "status" },
  { key: "priority", header: "priority" },
  { key: "title", header: "title" },
  { key: "summary", header: "summary" },
  { key: "reason", header: "reason" },
  { key: "source", header: "source" },
  { key: "rule_id", header: "rule_id" },
  { key: "assigned_owner_name", header: "assigned_owner_name" },
  { key: "contact_display_name", header: "contact_display_name" },
  { key: "email", header: "email" },
  { key: "phone", header: "phone" },
  { key: "contact_identifiers", header: "contact_identifiers" },
  { key: "latest_connector_type", header: "latest_connector_type" },
  { key: "latest_connector_destination_id", header: "latest_connector_destination_id" },
  { key: "latest_connector_status", header: "latest_connector_status" },
  { key: "created_at", header: "created_at" },
  { key: "updated_at", header: "updated_at" },
  { key: "last_activity_at", header: "last_activity_at" },
  { key: "pii_redacted", header: "pii_redacted" },
];

function defaultDeps(): CaseExportDeps {
  return {
    getSessionUserId: async () => {
      const session = await auth();
      return session?.user?.id ?? null;
    },
    getActiveTenant: async (userId) => {
      const tenantId = await getActiveTenantIdForUser(userId);
      if (!tenantId) return null;
      const membership = await getTenantMembership(userId, tenantId);
      if (!membership) return null;
      const [tenant] = await db
        .select({ id: tenants.id, slug: tenants.slug })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);
      if (!tenant) return null;
      return {
        id: tenant.id,
        slug: tenant.slug,
      };
    },
    getTenantMembership,
    canExportPii: canViewCasePii,
    listCases: listCasesByTenantWithActivity,
    getContactDetail: getContactDetailById,
    now: () => new Date(),
  };
}

function parseFormat(params: URLSearchParams): ExportFormat | null {
  const format = params.get("format") ?? "csv";
  return format === "csv" || format === "xlsx" ? format : null;
}

function joinIdentifiers(detail: ContactDetailRow | null): string {
  return (
    detail?.identifiers
      .map((identifier) => `${identifier.type}:${identifier.valueNormalised}`)
      .join("; ") ?? ""
  );
}

function redact(value: string, piiRedacted: boolean): string {
  if (!piiRedacted) return value;
  return value ? "[redacted]" : "[redacted]";
}

function toCaseExportRow(
  row: CaseListItemRow,
  contactDetail: ContactDetailRow | null,
  piiRedacted: boolean,
): CaseExportRow {
  return {
    case_id: row.id,
    conversation_id: row.conversationId,
    contact_id: row.contactId ?? "",
    case_type: row.caseType,
    status: row.status,
    priority: row.priority ?? "",
    title: row.title ?? "",
    summary: row.summary ?? "",
    reason: row.reason ?? "",
    source: row.source ?? "",
    rule_id: row.ruleId ?? "",
    assigned_owner_name: row.assignedOwnerName ?? "",
    contact_display_name: row.contactDisplayName ?? "",
    email: redact(contactDetail?.contact.emailNormalised ?? "", piiRedacted),
    phone: redact(contactDetail?.contact.phoneNormalised ?? "", piiRedacted),
    contact_identifiers: redact(joinIdentifiers(contactDetail), piiRedacted),
    latest_connector_type: row.latestConnectorType ?? "",
    latest_connector_destination_id: row.latestConnectorDestinationId ?? "",
    latest_connector_status: row.latestConnectorStatus ?? "",
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    last_activity_at: row.lastActivityAt.toISOString(),
    pii_redacted: piiRedacted,
  };
}

export async function handleCasesExport(
  request: Request,
  deps: CaseExportDeps = defaultDeps(),
): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const format = parseFormat(params);
  if (!format) {
    return Response.json({ error: "Unsupported format" }, { status: 400 });
  }

  const actorId = await deps.getSessionUserId();
  if (!actorId) {
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  }

  const tenant = await deps.getActiveTenant(actorId);
  if (!tenant) {
    return Response.json({ error: "Tenant not found" }, { status: 404 });
  }
  assertTenantId(tenant.id);

  const membership = await deps.getTenantMembership(actorId, tenant.id);
  if (!membership) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const filters = parseCaseExportFilters(params);
  const pageSize = filters.limit ?? 1000;
  const rows: CaseListItemRow[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await deps.listCases(tenant.id, {
      ...filters,
      limit: pageSize,
      offset,
    });
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  const piiRedacted = !deps.canExportPii(membership);
  const detailsByContactId = new Map<string, ContactDetailRow | null>();

  const exportRows = await Promise.all(
    rows.map(async (row) => {
      const contactId = row.contactId;
      if (!contactId) return toCaseExportRow(row, null, piiRedacted);
      if (!detailsByContactId.has(contactId)) {
        detailsByContactId.set(
          contactId,
          await deps.getContactDetail(tenant.id, contactId),
        );
      }
      return toCaseExportRow(row, detailsByContactId.get(contactId) ?? null, piiRedacted);
    }),
  );

  // TODO(CON-182): persist to follow_up_events.
  console.log({
    event: "export",
    actor_id: actorId,
    tenant_id: tenant.id,
    scope: "cases",
    filter: Object.fromEntries(params.entries()),
    row_count: exportRows.length,
    format,
    pii_redacted: piiRedacted,
  });

  const body =
    format === "csv"
      ? serialiseCsv(CASE_COLUMNS, exportRows)
      : await serialiseXlsx(CASE_COLUMNS, exportRows, "Cases");
  const responseBody: BodyInit =
    typeof body === "string" ? body : new Uint8Array(body);
  const filename = exportFilename("cases", tenant.slug, format, deps.now());

  return new Response(responseBody, {
    headers: {
      "Content-Type": contentTypeForFormat(format),
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function GET(request: Request) {
  return handleCasesExport(request);
}
