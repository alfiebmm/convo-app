import {
  and,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";

import { assertTenantId, assertUuid } from "@/lib/cases/tenant-guard";
import { db as defaultDb } from "@/lib/db";
import { followUpEvents } from "@/lib/db/schema";
import {
  type AuditEventType,
  type LogAuditEventInput,
} from "@/lib/audit/log-event";

export const AUDIT_PAGE_SIZE = 50;

export const AUDIT_EVENT_TYPES = [
  "pii_reveal",
  "export",
  "assignment_change",
  "status_change",
  "connector_delivery_attempt",
  "privacy_notice_shown",
  "consent_granted",
  "consent_declined",
] as const satisfies readonly AuditEventType[];

export interface AuditEventRow extends LogAuditEventInput {
  id: string;
  caseId: string | null;
  conversationId: string | null;
  actorId: string | null;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export interface AuditEventFilters {
  eventTypes?: AuditEventType[];
  actorId?: string;
  from?: Date;
  to?: Date;
}

export interface AuditCursor {
  createdAt: string;
  id: string;
}

export interface ListAuditEventsResult {
  rows: AuditEventRow[];
  nextCursor: AuditCursor | null;
}

export interface AuditEventsStore {
  list(
    tenantId: string,
    filters: AuditEventFilters,
    cursor: AuditCursor | null,
    limit: number,
  ): Promise<ListAuditEventsResult>;
  getById(tenantId: string, eventId: string): Promise<AuditEventRow | null>;
}

type DrizzleDb = typeof defaultDb;

function parsePayload(payload: unknown): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

function mapRow(row: {
  id: string;
  tenantId: string;
  caseId: string | null;
  conversationId: string | null;
  actorType: string;
  actorId: string | null;
  eventType: string;
  payload: unknown;
  createdAt: Date;
}): AuditEventRow {
  return {
    id: row.id,
    tenantId: row.tenantId,
    caseId: row.caseId,
    conversationId: row.conversationId,
    actorType: row.actorType as AuditEventRow["actorType"],
    actorId: row.actorId,
    eventType: row.eventType as AuditEventType,
    payload: parsePayload(row.payload),
    createdAt: row.createdAt,
  };
}

export function createDrizzleAuditEventsStore(
  db: DrizzleDb = defaultDb,
): AuditEventsStore {
  return {
    async list(tenantId, filters, cursor, limit) {
      assertTenantId(tenantId);
      const predicates = [eq(followUpEvents.tenantId, tenantId)];
      const eventTypes = filters.eventTypes?.filter((eventType) =>
        AUDIT_EVENT_TYPES.includes(eventType),
      );
      if (eventTypes?.length) {
        predicates.push(inArray(followUpEvents.eventType, eventTypes));
      }
      if (filters.actorId?.trim()) {
        predicates.push(eq(followUpEvents.actorId, filters.actorId.trim()));
      }
      if (filters.from) {
        predicates.push(gte(followUpEvents.createdAt, filters.from));
      }
      if (filters.to) {
        predicates.push(lte(followUpEvents.createdAt, filters.to));
      }
      if (cursor) {
        const cursorDate = new Date(cursor.createdAt);
        predicates.push(
          or(
            lt(followUpEvents.createdAt, cursorDate),
            and(
              eq(followUpEvents.createdAt, cursorDate),
              gt(followUpEvents.id, cursor.id),
            ),
          )!,
        );
      }

      const rows = await db
        .select()
        .from(followUpEvents)
        .where(and(...predicates))
        .orderBy(desc(followUpEvents.createdAt), sql`${followUpEvents.id} asc`)
        .limit(limit + 1);

      const mapped = rows.map(mapRow);
      const page = mapped.slice(0, limit);
      const last = page.at(-1);
      return {
        rows: page,
        nextCursor:
          mapped.length > limit && last
            ? { createdAt: last.createdAt.toISOString(), id: last.id }
            : null,
      };
    },

    async getById(tenantId, eventId) {
      assertTenantId(tenantId);
      assertUuid(eventId, "eventId");
      const [row] = await db
        .select()
        .from(followUpEvents)
        .where(and(eq(followUpEvents.tenantId, tenantId), eq(followUpEvents.id, eventId)))
        .limit(1);
      return row ? mapRow(row) : null;
    },
  };
}

let defaultStore: AuditEventsStore | null = null;

function resolveStore(store?: AuditEventsStore): AuditEventsStore {
  if (store) return store;
  if (!defaultStore) {
    defaultStore = createDrizzleAuditEventsStore();
  }
  return defaultStore;
}

export function parseAuditCursor(value: string | undefined | null): AuditCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (
      typeof parsed?.createdAt === "string" &&
      typeof parsed?.id === "string"
    ) {
      return { createdAt: parsed.createdAt, id: parsed.id };
    }
  } catch {
    return null;
  }
  return null;
}

export function encodeAuditCursor(cursor: AuditCursor | null): string | null {
  if (!cursor) return null;
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function parseAuditEventTypes(values: string[] = []): AuditEventType[] {
  return values.filter((value): value is AuditEventType =>
    AUDIT_EVENT_TYPES.includes(value as AuditEventType),
  );
}

export async function listAuditEventsForTenant(
  tenantId: string,
  filters: AuditEventFilters = {},
  cursor: AuditCursor | null = null,
  opts: { store?: AuditEventsStore; limit?: number } = {},
): Promise<ListAuditEventsResult> {
  assertTenantId(tenantId);
  return resolveStore(opts.store).list(
    tenantId,
    filters,
    cursor,
    opts.limit ?? AUDIT_PAGE_SIZE,
  );
}

export async function getAuditEventDetailForTenant(
  tenantId: string,
  eventId: string,
  opts: { store?: AuditEventsStore } = {},
): Promise<AuditEventRow | null> {
  assertTenantId(tenantId);
  return resolveStore(opts.store).getById(tenantId, eventId);
}
