import { getAdminAuditLogClient, type AuditRow, type AuditStatus } from "./audit";

export type AuditFilters = {
  actor?: string;
  actions: string[];
  targetType?: string;
  targetId?: string;
  from?: string;
  to?: string;
  correlationId?: string;
  status?: AuditStatus;
  cursor?: string;
};

export type AuditListResult = {
  rows: AuditRow[];
  nextCursor: string | null;
};

const validStatuses = new Set(["intent", "outcome:success", "outcome:error"]);

type AuditQueryBuilder = {
  eq(column: string, value: string): AuditQueryBuilder;
  in(column: string, values: string[]): AuditQueryBuilder;
  ilike(column: string, pattern: string): AuditQueryBuilder;
  gte(column: string, value: string): AuditQueryBuilder;
  lte(column: string, value: string): AuditQueryBuilder;
  or(filter: string): AuditQueryBuilder;
};

type AuditQueryPromise = AuditQueryBuilder &
  PromiseLike<{
    data: unknown[] | null;
    error: Error | null;
  }>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function allParams(value: string | string[] | undefined) {
  if (!value) return [];
  return (Array.isArray(value) ? value : value.split(","))
    .map((item) => item.trim())
    .filter(Boolean);
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

export function parseAuditFilters(
  params: Record<string, string | string[] | undefined>,
): AuditFilters {
  const status = firstParam(params.status);
  return {
    actor: firstParam(params.actor)?.trim() || undefined,
    actions: allParams(params.action),
    targetType: firstParam(params.target_type)?.trim() || undefined,
    targetId: firstParam(params.target_id)?.trim() || undefined,
    from: firstParam(params.from) || daysAgo(7),
    to: firstParam(params.to) || undefined,
    correlationId: firstParam(params.correlation_id)?.trim() || undefined,
    status: status && validStatuses.has(status) ? (status as AuditStatus) : undefined,
    cursor: firstParam(params.cursor) || undefined,
  };
}

function applyFilters(query: AuditQueryPromise, filters: AuditFilters) {
  let next: AuditQueryBuilder = query;
  if (filters.actor) next = next.eq("actor_email", filters.actor);
  if (filters.actions.length > 0) next = next.in("action", filters.actions);
  if (filters.targetType) next = next.eq("target_type", filters.targetType);
  if (filters.targetId) next = next.ilike("target_id", `%${filters.targetId}%`);
  if (filters.from) next = next.gte("created_at", `${filters.from}T00:00:00.000Z`);
  if (filters.to) next = next.lte("created_at", `${filters.to}T23:59:59.999Z`);
  if (filters.correlationId) next = next.eq("correlation_id", filters.correlationId);
  if (filters.status) next = next.eq("status", filters.status);
  if (filters.cursor) {
    const [createdAt, id] = filters.cursor.split("|");
    if (createdAt && id) {
      next = next.or(`created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`);
    }
  }
  return next as AuditQueryPromise;
}

export async function listAuditRows(
  filters: AuditFilters,
  { limit = 100 }: { limit?: number } = {},
): Promise<AuditListResult> {
  const table = await getAdminAuditLogClient();
  const query = applyFilters(
    table
      .select("*")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1),
    filters,
  );

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as AuditRow[];
  const visibleRows = rows.slice(0, limit);
  const last = visibleRows.at(-1);
  return {
    rows: visibleRows,
    nextCursor:
      rows.length > limit && last ? `${last.created_at}|${last.id}` : null,
  };
}

export async function listAuditFilterOptions() {
  const table = await getAdminAuditLogClient();
  const { data, error } = await table
    .select("actor_email,action,target_type")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;

  const rows = (data ?? []) as Array<{
    actor_email: string | null;
    action: string | null;
    target_type: string | null;
  }>;

  return {
    actors: [
      ...new Set(rows.map((row) => row.actor_email).filter((value): value is string => Boolean(value))),
    ].sort(),
    actions: [
      ...new Set(rows.map((row) => row.action).filter((value): value is string => Boolean(value))),
    ].sort(),
    targetTypes: [
      ...new Set(rows.map((row) => row.target_type).filter((value): value is string => Boolean(value))),
    ].sort(),
  };
}
