import { notFound } from "next/navigation";
import { and, sql } from "drizzle-orm";
import { db, type Database } from "@/lib/db";

export const tenantPlans = ["starter", "growth", "scale"] as const;
export const tenantStatuses = ["active", "suspended", "deleted_soft"] as const;
export const inactivityWindows = ["30d", "90d"] as const;
export const tenantTabs = ["profile", "usage", "activity", "notes", "danger"] as const;

export type TenantPlan = (typeof tenantPlans)[number];
export type TenantStatus = (typeof tenantStatuses)[number];
export type InactivityWindow = (typeof inactivityWindows)[number];
export type TenantTab = (typeof tenantTabs)[number];
export type TenantSort =
  | "signup-desc"
  | "signup-asc"
  | "name-asc"
  | "name-desc"
  | "plan-asc"
  | "status-asc"
  | "last-conversation-desc"
  | "conversation-count-desc";

export type TenantListFilters = {
  plans: TenantPlan[];
  statuses: TenantStatus[];
  inactivity: InactivityWindow | null;
  q: string;
  cursor: TenantCursor | null;
  sort: TenantSort;
};

export type TenantCursor = {
  createdAt: string;
  id: string;
};

export type TenantListRow = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  plan: TenantPlan;
  status: TenantStatus;
  createdAt: string;
  ownerEmail: string | null;
  lastConversationAt: string | null;
  conversationCount30d: number;
};

export type TenantListResult = {
  rows: TenantListRow[];
  emailMatches: TenantListRow[];
  nextCursor: string | null;
};

export type TenantMemberRow = {
  id: string;
  userId: string;
  email: string;
  role: string;
  createdAt: string;
};

export type TenantDetail = {
  tenant: {
    id: string;
    name: string;
    slug: string;
    domain: string | null;
    plan: TenantPlan;
    status: TenantStatus;
    settings: unknown;
    stripeCustomerId: string | null;
    createdAt: string;
    suspendedAt: string | null;
    suspendedReason: string | null;
    suspendedByEmail: string | null;
    softDeletedAt: string | null;
    softDeletedReason: string | null;
    softDeletedByEmail: string | null;
  };
  owner: TenantMemberRow | null;
  members: TenantMemberRow[];
  timeline: TenantTimelineItem[];
};

export type TenantTimelineItem = {
  id: string;
  kind: "member" | "conversation" | "admin_audit" | "plan";
  at: string;
  title: string;
  detail: string | null;
  href?: string;
};

type TenantQueryDeps = {
  database?: Database;
};

type RawTenantListRow = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  plan: TenantPlan;
  status: TenantStatus;
  created_at: string | Date;
  owner_email: string | null;
  last_conversation_at: string | Date | null;
  conversation_count_30d: number | string | bigint;
};

type RawTenantDetailRow = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  plan: TenantPlan;
  status: TenantStatus;
  settings: unknown;
  stripe_customer_id: string | null;
  created_at: string | Date;
  suspended_at: string | Date | null;
  suspended_reason: string | null;
  suspended_by_email: string | null;
  soft_deleted_at: string | Date | null;
  soft_deleted_reason: string | null;
  soft_deleted_by_email: string | null;
};

type RawMemberRow = {
  id: string;
  user_id: string;
  email: string;
  role: string;
  created_at: string | Date;
};

type RawTimelineRow = {
  id: string;
  kind: TenantTimelineItem["kind"];
  at: string | Date;
  title: string | null;
  detail: string | null;
  href: string | null;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseMultiParam<T extends string>(
  value: string | string[] | undefined,
  allowed: readonly T[],
) {
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  const allowedSet = new Set(allowed);
  return raw
    .flatMap((item) => item.split(","))
    .map((item) => item.trim())
    .filter((item): item is T => allowedSet.has(item as T));
}

export function isEmailQuery(value: string) {
  return value.includes("@");
}

export function encodeTenantCursor(cursor: TenantCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeTenantCursor(value: string | null | undefined): TenantCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (
      parsed &&
      typeof parsed.createdAt === "string" &&
      typeof parsed.id === "string" &&
      parsed.createdAt.length > 0 &&
      parsed.id.length > 0
    ) {
      return { createdAt: parsed.createdAt, id: parsed.id };
    }
  } catch {
    return null;
  }
  return null;
}

export function parseTenantFilters(
  params: Record<string, string | string[] | undefined>,
): TenantListFilters {
  const sort = firstParam(params.sort);
  const inactivity = firstParam(params.inactivity);
  const normalisedSorts = new Set<TenantSort>([
    "signup-desc",
    "signup-asc",
    "name-asc",
    "name-desc",
    "plan-asc",
    "status-asc",
    "last-conversation-desc",
    "conversation-count-desc",
  ]);

  return {
    plans: parseMultiParam(params.plan, tenantPlans),
    statuses: parseMultiParam(params.status, tenantStatuses),
    inactivity: inactivityWindows.includes(inactivity as InactivityWindow)
      ? (inactivity as InactivityWindow)
      : null,
    q: (firstParam(params.q) ?? "").trim(),
    cursor: decodeTenantCursor(firstParam(params.cursor)),
    sort: normalisedSorts.has(sort as TenantSort) ? (sort as TenantSort) : "signup-desc",
  };
}

export function parseTenantTab(
  params: Record<string, string | string[] | undefined>,
): TenantTab {
  const tab = firstParam(params.tab);
  return tenantTabs.includes(tab as TenantTab) ? (tab as TenantTab) : "profile";
}

function toIso(value: string | Date | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toCount(value: number | string | bigint) {
  return typeof value === "bigint" ? Number(value) : Number(value);
}

function mapTenantListRow(row: RawTenantListRow): TenantListRow {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    domain: row.domain,
    plan: row.plan,
    status: row.status,
    createdAt: toIso(row.created_at) ?? "",
    ownerEmail: row.owner_email,
    lastConversationAt: toIso(row.last_conversation_at),
    conversationCount30d: toCount(row.conversation_count_30d),
  };
}

// Sorts whose cursor predicate `(t.created_at, t.id) < (...)` matches the
// physical ordering. Any other sort cannot reliably use the cursor and
// the caller (the page component) must hide the "Next page" link.
export const cursorSafeSorts: ReadonlySet<TenantSort> = new Set(["signup-desc"]);

export function canPaginateSort(sort: TenantSort): boolean {
  return cursorSafeSorts.has(sort);
}

function buildListWhere(filters: TenantListFilters) {
  // By default we exclude soft-deleted tenants. If the caller explicitly
  // filters by status, we drop that exclusion so `deleted_soft` can show up
  // when asked for. The next `status IN (...)` clause then narrows the list.
  const where = [];
  if (filters.statuses.length === 0) {
    where.push(sql`t.status <> 'deleted_soft'`);
  }

  if (filters.plans.length > 0) {
    where.push(sql`t.plan::text IN (${sql.join(filters.plans.map((plan) => sql`${plan}`), sql`, `)})`);
  }

  if (filters.statuses.length > 0) {
    where.push(
      sql`t.status::text IN (${sql.join(filters.statuses.map((status) => sql`${status}`), sql`, `)})`,
    );
  }

  if (filters.q) {
    const search = `%${filters.q}%`;
    where.push(sql`(t.name ILIKE ${search} OR t.slug ILIKE ${search} OR t.domain ILIKE ${search})`);
  }

  if (filters.inactivity) {
    const interval = filters.inactivity === "90d" ? sql`interval '90 days'` : sql`interval '30 days'`;
    where.push(sql`NOT EXISTS (
      SELECT 1
        FROM conversations inactivity_conversations
       WHERE inactivity_conversations.tenant_id = t.id
         AND inactivity_conversations.created_at >= now() - ${interval}
    )`);
  }

  if (filters.cursor) {
    where.push(sql`(t.created_at, t.id) < (${filters.cursor.createdAt}::timestamptz, ${filters.cursor.id}::uuid)`);
  }

  return where;
}

function listOrder(sort: TenantSort) {
  switch (sort) {
    case "signup-asc":
      return sql`t.created_at ASC, t.id ASC`;
    case "name-asc":
      return sql`LOWER(t.name) ASC, t.created_at DESC, t.id DESC`;
    case "name-desc":
      return sql`LOWER(t.name) DESC, t.created_at DESC, t.id DESC`;
    case "plan-asc":
      return sql`t.plan::text ASC, t.created_at DESC, t.id DESC`;
    case "status-asc":
      return sql`t.status::text ASC, t.created_at DESC, t.id DESC`;
    case "last-conversation-desc":
      return sql`stats.last_conversation_at DESC NULLS LAST, t.created_at DESC, t.id DESC`;
    case "conversation-count-desc":
      return sql`stats.conversation_count_30d DESC, t.created_at DESC, t.id DESC`;
    default:
      return sql`t.created_at DESC, t.id DESC`;
  }
}

async function runTenantListQuery(
  filters: TenantListFilters,
  options: { emailOnly?: boolean; limit?: number } = {},
  deps: TenantQueryDeps = {},
) {
  const database = deps.database ?? db;
  const where = buildListWhere(filters);
  if (options.emailOnly && filters.q) {
    where.push(sql`EXISTS (
      SELECT 1
        FROM tenant_members email_members
        INNER JOIN users email_users ON email_users.id = email_members.user_id
       WHERE email_members.tenant_id = t.id
         AND LOWER(email_users.email) = LOWER(${filters.q})
    )`);
  }

  const limit = options.limit ?? 51;
  const result = await database.execute(sql`
    WITH stats AS (
      SELECT tenant_id,
             MAX(created_at) AS last_conversation_at,
             COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days')::int AS conversation_count_30d
        FROM conversations
       GROUP BY tenant_id
    )
    SELECT t.id,
           t.name,
           t.slug,
           t.domain,
           t.plan,
           t.status,
           t.created_at,
           owner_user.email AS owner_email,
           stats.last_conversation_at,
           COALESCE(stats.conversation_count_30d, 0)::int AS conversation_count_30d
      FROM tenants t
      LEFT JOIN stats ON stats.tenant_id = t.id
      LEFT JOIN LATERAL (
        SELECT tenant_members.user_id
          FROM tenant_members
         WHERE tenant_members.tenant_id = t.id
         ORDER BY (tenant_members.role = 'owner') DESC, tenant_members.created_at ASC
         LIMIT 1
      ) owner_member ON true
      LEFT JOIN users owner_user ON owner_user.id = owner_member.user_id
     WHERE ${and(...where)}
     ORDER BY ${listOrder(filters.sort)}
     LIMIT ${limit}
  `);

  return (result.rows as RawTenantListRow[]).map(mapTenantListRow);
}

export async function loadTenants(
  filters: TenantListFilters,
  deps: TenantQueryDeps = {},
): Promise<TenantListResult> {
  const [rowsWithExtra, emailMatches] = await Promise.all([
    runTenantListQuery(filters, { limit: 51 }, deps),
    isEmailQuery(filters.q)
      ? runTenantListQuery({ ...filters, cursor: null }, { emailOnly: true, limit: 10 }, deps)
      : Promise.resolve([]),
  ]);
  const rows = rowsWithExtra.slice(0, 50);
  const extra = rowsWithExtra[50];
  const nextCursor = extra
    ? encodeTenantCursor({ createdAt: rows.at(-1)?.createdAt ?? extra.createdAt, id: rows.at(-1)?.id ?? extra.id })
    : null;

  return { rows, emailMatches, nextCursor };
}

export async function loadTenantDetail(
  tenantId: string,
  deps: TenantQueryDeps = {},
): Promise<TenantDetail> {
  const database = deps.database ?? db;
  const tenantResult = await database.execute(sql`
    SELECT t.id,
           t.name,
           t.slug,
           t.domain,
           t.plan,
           t.status,
           t.settings,
           t.stripe_customer_id,
           t.created_at,
           t.suspended_at,
           t.suspended_reason,
           suspended_by.email AS suspended_by_email,
           t.soft_deleted_at,
           t.soft_deleted_reason,
           soft_deleted_by.email AS soft_deleted_by_email
      FROM tenants t
      LEFT JOIN users suspended_by ON suspended_by.id = t.suspended_by
      LEFT JOIN users soft_deleted_by ON soft_deleted_by.id = t.soft_deleted_by
     WHERE t.id = ${tenantId}::uuid
     LIMIT 1
  `);
  const tenantRow = tenantResult.rows[0] as RawTenantDetailRow | undefined;
  if (!tenantRow) notFound();

  const [membersResult, timelineResult] = await Promise.all([
    database.execute(sql`
      SELECT tenant_members.id,
             tenant_members.user_id,
             users.email,
             tenant_members.role,
             tenant_members.created_at
        FROM tenant_members
        INNER JOIN users ON users.id = tenant_members.user_id
       WHERE tenant_members.tenant_id = ${tenantId}::uuid
       ORDER BY (tenant_members.role = 'owner') DESC, tenant_members.created_at ASC
    `),
    database.execute(sql`
      WITH member_events AS (
        SELECT tenant_members.id::text AS id,
               'member'::text AS kind,
               tenant_members.created_at AS at,
               users.email || ' joined' AS title,
               tenant_members.role::text AS detail,
               NULL::text AS href
          FROM tenant_members
          INNER JOIN users ON users.id = tenant_members.user_id
         WHERE tenant_members.tenant_id = ${tenantId}::uuid
      ),
      conversation_events AS (
        SELECT conversations.id::text AS id,
               'conversation'::text AS kind,
               conversations.created_at AS at,
               COALESCE(conversations.metadata->>'title', conversations.metadata->>'subject', '(no title)') AS title,
               conversations.status::text AS detail,
               '/platform-admin/tenants/' || ${tenantId} || '/conversations/' || conversations.id::text AS href
          FROM conversations
         WHERE conversations.tenant_id = ${tenantId}::uuid
         ORDER BY conversations.created_at DESC
         LIMIT 100
      ),
      audit_events AS (
        SELECT admin_audit_log.id::text AS id,
               CASE WHEN admin_audit_log.action LIKE 'tenant.plan%' THEN 'plan' ELSE 'admin_audit' END::text AS kind,
               admin_audit_log.created_at AS at,
               admin_audit_log.action AS title,
               admin_audit_log.actor_email || ' - ' || admin_audit_log.status AS detail,
               '/platform-admin/audit/' || admin_audit_log.correlation_id::text AS href
          FROM admin_audit_log
         WHERE admin_audit_log.target_type = 'tenant'
           AND admin_audit_log.target_id = ${tenantId}
         ORDER BY admin_audit_log.created_at DESC
         LIMIT 100
      )
      SELECT *
        FROM (
          SELECT * FROM member_events
          UNION ALL
          SELECT * FROM conversation_events
          UNION ALL
          SELECT * FROM audit_events
        ) timeline
       ORDER BY at DESC
       LIMIT 100
    `),
  ]);

  const members = (membersResult.rows as RawMemberRow[]).map((member) => ({
    id: member.id,
    userId: member.user_id,
    email: member.email,
    role: member.role,
    createdAt: toIso(member.created_at) ?? "",
  }));

  return {
    tenant: {
      id: tenantRow.id,
      name: tenantRow.name,
      slug: tenantRow.slug,
      domain: tenantRow.domain,
      plan: tenantRow.plan,
      status: tenantRow.status,
      settings: tenantRow.settings ?? {},
      stripeCustomerId: tenantRow.stripe_customer_id,
      createdAt: toIso(tenantRow.created_at) ?? "",
      suspendedAt: toIso(tenantRow.suspended_at),
      suspendedReason: tenantRow.suspended_reason,
      suspendedByEmail: tenantRow.suspended_by_email,
      softDeletedAt: toIso(tenantRow.soft_deleted_at),
      softDeletedReason: tenantRow.soft_deleted_reason,
      softDeletedByEmail: tenantRow.soft_deleted_by_email,
    },
    owner: members.find((member) => member.role === "owner") ?? members[0] ?? null,
    members,
    timeline: (timelineResult.rows as RawTimelineRow[]).map((item) => ({
      id: item.id,
      kind: item.kind,
      at: toIso(item.at) ?? "",
      title: item.title ?? "(no title)",
      detail: item.detail,
      href: item.href ?? undefined,
    })),
  };
}
