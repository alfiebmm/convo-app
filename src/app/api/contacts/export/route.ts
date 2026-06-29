import { auth } from "@/lib/auth";
import { getActiveTenantIdForUser, getTenantMembership } from "@/lib/auth-context";
import { canViewCasePii } from "@/lib/auth/permissions";
import { assertTenantId } from "@/lib/cases/tenant-guard";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import {
  getContactDetailById,
  listContactsByTenant,
  type ContactDetailRow,
  type ContactListItemRow,
} from "@/lib/contacts";
import {
  contentTypeForFormat,
  exportFilename,
  serialiseCsv,
  serialiseXlsx,
  type ExportCellValue,
  type ExportColumn,
} from "@/lib/exports/files";
import { parseContactExportFilters } from "@/lib/exports/filters";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

type ExportFormat = "csv" | "xlsx";

interface TenantForExport {
  id: string;
  slug: string;
}

type Membership = Awaited<ReturnType<typeof getTenantMembership>>;

type ContactExportRow = Record<string, ExportCellValue> & {
  contact_id: string;
  display_name: string;
  email: string;
  phone: string;
  contact_identifiers: string;
  preferred_contact_method: string;
  company: string;
  location: string;
  persona: string;
  marketplace_side: string;
  service_or_product: string;
  related_case_type: string;
  open_case_status: string;
  first_seen_at: string;
  last_seen_at: string;
  pii_redacted: boolean;
};

export interface ContactExportDeps {
  getSessionUserId: () => Promise<string | null>;
  getActiveTenant: (userId: string) => Promise<TenantForExport | null>;
  getTenantMembership: (userId: string, tenantId: string) => Promise<Membership>;
  canExportPii: (membership: Membership) => boolean;
  listContacts: typeof listContactsByTenant;
  getContactDetail: typeof getContactDetailById;
  now: () => Date;
}

const CONTACT_COLUMNS: ExportColumn<ContactExportRow>[] = [
  { key: "contact_id", header: "contact_id" },
  { key: "display_name", header: "display_name" },
  { key: "email", header: "email" },
  { key: "phone", header: "phone" },
  { key: "contact_identifiers", header: "contact_identifiers" },
  { key: "preferred_contact_method", header: "preferred_contact_method" },
  { key: "company", header: "company" },
  { key: "location", header: "location" },
  { key: "persona", header: "persona" },
  { key: "marketplace_side", header: "marketplace_side" },
  { key: "service_or_product", header: "service_or_product" },
  { key: "related_case_type", header: "related_case_type" },
  { key: "open_case_status", header: "open_case_status" },
  { key: "first_seen_at", header: "first_seen_at" },
  { key: "last_seen_at", header: "last_seen_at" },
  { key: "pii_redacted", header: "pii_redacted" },
];

function defaultDeps(): ContactExportDeps {
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
      return tenant;
    },
    getTenantMembership,
    canExportPii: canViewCasePii,
    listContacts: listContactsByTenant,
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
  return "[redacted]";
}

function toContactExportRow(
  row: ContactListItemRow,
  detail: ContactDetailRow | null,
  piiRedacted: boolean,
): ContactExportRow {
  return {
    contact_id: row.id,
    display_name: row.displayName ?? "",
    email: redact(detail?.contact.emailNormalised ?? row.emailNormalised ?? "", piiRedacted),
    phone: redact(detail?.contact.phoneNormalised ?? row.phoneNormalised ?? "", piiRedacted),
    contact_identifiers: redact(joinIdentifiers(detail), piiRedacted),
    preferred_contact_method: row.preferredContactMethod ?? "",
    company: row.company ?? "",
    location: row.location ?? "",
    persona: row.persona ?? "",
    marketplace_side: row.marketplaceSide ?? "",
    service_or_product: row.serviceOrProduct ?? "",
    related_case_type: row.relatedCaseType ?? "",
    open_case_status: row.openCaseStatus ?? "",
    first_seen_at: row.firstSeenAt.toISOString(),
    last_seen_at: row.lastSeenAt.toISOString(),
    pii_redacted: piiRedacted,
  };
}

export async function handleContactsExport(
  request: Request,
  deps: ContactExportDeps = defaultDeps(),
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

  const filters = parseContactExportFilters(params);
  const rows: ContactListItemRow[] = [];
  for (let page = 1, totalCount = 0; page === 1 || rows.length < totalCount; page++) {
    const result = await deps.listContacts(tenant.id, { ...filters, page });
    rows.push(...result.rows);
    totalCount = result.totalCount;
    if (result.rows.length === 0) break;
  }
  const piiRedacted = !deps.canExportPii(membership);

  const exportRows = await Promise.all(
    rows.map(async (row) =>
      toContactExportRow(
        row,
        await deps.getContactDetail(tenant.id, row.id),
        piiRedacted,
      ),
    ),
  );

  // TODO(CON-182): persist to follow_up_events.
  console.log({
    event: "export",
    actor_id: actorId,
    tenant_id: tenant.id,
    scope: "contacts",
    filter: Object.fromEntries(params.entries()),
    row_count: exportRows.length,
    format,
    pii_redacted: piiRedacted,
  });

  const body =
    format === "csv"
      ? serialiseCsv(CONTACT_COLUMNS, exportRows)
      : await serialiseXlsx(CONTACT_COLUMNS, exportRows, "Contacts");
  const responseBody: BodyInit =
    typeof body === "string" ? body : new Uint8Array(body);
  const filename = exportFilename("contacts", tenant.slug, format, deps.now());

  return new Response(responseBody, {
    headers: {
      "Content-Type": contentTypeForFormat(format),
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function GET(request: Request) {
  return handleContactsExport(request);
}
