/**
 * CasesStore — data-access seam for the case helpers (CON-164).
 *
 * Why a store interface?
 *   The public helpers in `src/lib/cases/*` are pure orchestration: validate
 *   tenantId, marshal arguments, call the store. By pushing the Drizzle calls
 *   behind a tiny typed interface, the helpers stay 100% deterministic and
 *   the unit tests can substitute an in-memory implementation without
 *   booting Postgres. The production wiring (`createDrizzleCasesStore`) is
 *   the thin layer that translates store calls into `eq(table.tenantId, …)`
 *   WHERE clauses — every method takes `tenantId` as its first argument so
 *   the convention is unmissable.
 *
 * Tenant-scope rule:
 *   - EVERY method on this interface takes `tenantId` as its first arg.
 *   - The Drizzle implementation MUST include `eq(table.tenantId, tenantId)`
 *     in every WHERE clause. No exceptions, no escape hatches.
 *   - The in-memory test implementation keys storage by tenantId so the
 *     test fake naturally rejects cross-tenant access.
 */

import { and, desc, eq, sql } from "drizzle-orm";

import { db as defaultDb } from "@/lib/db";
import {
  followUpCaseAttributes,
  followUpCases,
  followUpEvents,
} from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// Row types (mirror the schema, narrow to what the helpers expose)
// ---------------------------------------------------------------------------

export type CaseStatus =
  | "open"
  | "in_progress"
  | "waiting_on_customer"
  | "resolved"
  | "dismissed";

export interface CaseRow {
  id: string;
  tenantId: string;
  conversationId: string;
  contactId: string | null;
  caseType: string;
  status: CaseStatus;
  priority: string | null;
  routingKey: string | null;
  title: string | null;
  summary: string | null;
  reason: string | null;
  source: string | null;
  ruleId: string | null;
  classifierConfidence: number | null;
  assignedTo: string | null;
  externalSystem: string | null;
  externalId: string | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
}

export interface CreateCaseInput {
  conversationId: string;
  contactId?: string | null;
  caseType: string;
  status?: CaseStatus;
  priority?: string | null;
  routingKey?: string | null;
  title?: string | null;
  summary?: string | null;
  reason?: string | null;
  source?: string | null;
  ruleId?: string | null;
  classifierConfidence?: number | null;
  assignedTo?: string | null;
  externalSystem?: string | null;
  externalId?: string | null;
}

export interface ListCasesFilters {
  status?: CaseStatus;
  caseType?: string;
  assignedTo?: string | null;
  limit?: number;
  offset?: number;
}

export interface CaseEventRow {
  id: string;
  tenantId: string;
  caseId: string;
  conversationId: string;
  actorType: string;
  actorId: string | null;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export interface RecordCaseEventInput {
  caseId: string;
  conversationId: string;
  actorType: string;
  actorId?: string | null;
  eventType: string;
  payload?: Record<string, unknown>;
}

export interface CaseAttributeRow {
  tenantId: string;
  caseId: string;
  key: string;
  value: unknown;
  source: string | null;
  confidence: number | null;
  detectedAt: Date;
}

export interface SetCaseAttributeInput {
  caseId: string;
  key: string;
  value: unknown;
  source?: string | null;
  confidence?: number | null;
}

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

export interface CasesStore {
  insertCase(tenantId: string, input: CreateCaseInput): Promise<CaseRow>;

  /**
   * Returns the updated row, or `null` if no row matched (tenant scope miss
   * OR unknown id). Callers MUST treat null as "not found" — never retry
   * with a different tenant scope.
   */
  updateCase(
    tenantId: string,
    caseId: string,
    patch: Partial<
      Pick<
        CaseRow,
        | "status"
        | "assignedTo"
        | "priority"
        | "routingKey"
        | "title"
        | "summary"
        | "reason"
        | "resolvedAt"
        | "externalSystem"
        | "externalId"
        | "contactId"
      >
    >
  ): Promise<CaseRow | null>;

  findCaseById(tenantId: string, caseId: string): Promise<CaseRow | null>;

  listCases(tenantId: string, filters: ListCasesFilters): Promise<CaseRow[]>;

  insertEvent(tenantId: string, input: RecordCaseEventInput): Promise<CaseEventRow>;

  upsertAttribute(
    tenantId: string,
    input: SetCaseAttributeInput
  ): Promise<CaseAttributeRow>;

  listAttributes(tenantId: string, caseId: string): Promise<CaseAttributeRow[]>;
}

// ---------------------------------------------------------------------------
// Drizzle implementation
// ---------------------------------------------------------------------------

type DrizzleDb = typeof defaultDb;

/**
 * Build a CasesStore backed by Drizzle. Defaults to the app's singleton db
 * client; pass a custom one for integration tests that hit a throwaway
 * Postgres instance.
 *
 * Every method MUST include `eq(table.tenantId, tenantId)` in its WHERE
 * clause. The helper layer (`src/lib/cases/index.ts` etc.) trusts this.
 */
export function createDrizzleCasesStore(db: DrizzleDb = defaultDb): CasesStore {
  return {
    async insertCase(tenantId, input) {
      const [row] = await db
        .insert(followUpCases)
        .values({
          tenantId,
          conversationId: input.conversationId,
          contactId: input.contactId ?? null,
          caseType: input.caseType,
          status: input.status ?? "open",
          priority: input.priority ?? null,
          routingKey: input.routingKey ?? null,
          title: input.title ?? null,
          summary: input.summary ?? null,
          reason: input.reason ?? null,
          source: input.source ?? null,
          ruleId: input.ruleId ?? null,
          classifierConfidence: input.classifierConfidence ?? null,
          assignedTo: input.assignedTo ?? null,
          externalSystem: input.externalSystem ?? null,
          externalId: input.externalId ?? null,
        })
        .returning();
      return row as CaseRow;
    },

    async updateCase(tenantId, caseId, patch) {
      const [row] = await db
        .update(followUpCases)
        .set({ ...patch, updatedAt: new Date() })
        .where(
          and(
            eq(followUpCases.tenantId, tenantId),
            eq(followUpCases.id, caseId)
          )
        )
        .returning();
      return (row as CaseRow) ?? null;
    },

    async findCaseById(tenantId, caseId) {
      const [row] = await db
        .select()
        .from(followUpCases)
        .where(
          and(
            eq(followUpCases.tenantId, tenantId),
            eq(followUpCases.id, caseId)
          )
        )
        .limit(1);
      return (row as CaseRow) ?? null;
    },

    async listCases(tenantId, filters) {
      const conditions = [eq(followUpCases.tenantId, tenantId)];
      if (filters.status) {
        conditions.push(eq(followUpCases.status, filters.status));
      }
      if (filters.caseType) {
        conditions.push(eq(followUpCases.caseType, filters.caseType));
      }
      if (filters.assignedTo !== undefined) {
        if (filters.assignedTo === null) {
          conditions.push(sql`${followUpCases.assignedTo} IS NULL`);
        } else {
          conditions.push(eq(followUpCases.assignedTo, filters.assignedTo));
        }
      }
      const limit = filters.limit ?? 50;
      const offset = filters.offset ?? 0;

      const rows = await db
        .select()
        .from(followUpCases)
        .where(and(...conditions))
        .orderBy(desc(followUpCases.createdAt))
        .limit(limit)
        .offset(offset);
      return rows as CaseRow[];
    },

    async insertEvent(tenantId, input) {
      const [row] = await db
        .insert(followUpEvents)
        .values({
          tenantId,
          caseId: input.caseId,
          conversationId: input.conversationId,
          actorType: input.actorType,
          actorId: input.actorId ?? null,
          eventType: input.eventType,
          payload: input.payload ?? {},
        })
        .returning();
      return row as CaseEventRow;
    },

    async upsertAttribute(tenantId, input) {
      // Upsert keyed by (case_id, key) — matches the primary key in the
      // migration. tenantId is asserted in the ON CONFLICT WHERE clause
      // so a cross-tenant case_id with the same key cannot accidentally
      // overwrite a real attribute (defensive: case_id is globally unique
      // anyway, but the WHERE guards it explicitly).
      const [row] = await db
        .insert(followUpCaseAttributes)
        .values({
          tenantId,
          caseId: input.caseId,
          key: input.key,
          value: input.value,
          source: input.source ?? null,
          confidence: input.confidence ?? null,
        })
        .onConflictDoUpdate({
          target: [followUpCaseAttributes.caseId, followUpCaseAttributes.key],
          set: {
            value: input.value,
            source: input.source ?? null,
            confidence: input.confidence ?? null,
            detectedAt: new Date(),
          },
          setWhere: eq(followUpCaseAttributes.tenantId, tenantId),
        })
        .returning();
      return row as CaseAttributeRow;
    },

    async listAttributes(tenantId, caseId) {
      const rows = await db
        .select()
        .from(followUpCaseAttributes)
        .where(
          and(
            eq(followUpCaseAttributes.tenantId, tenantId),
            eq(followUpCaseAttributes.caseId, caseId)
          )
        );
      return rows as CaseAttributeRow[];
    },
  };
}

// ---------------------------------------------------------------------------
// Default singleton (used by the public helpers when no override is passed)
// ---------------------------------------------------------------------------

let defaultStore: CasesStore | null = null;

export function getDefaultCasesStore(): CasesStore {
  if (!defaultStore) {
    defaultStore = createDrizzleCasesStore();
  }
  return defaultStore;
}

/**
 * Test-only seam — swap the default store for an in-memory fake. The
 * helpers will pick this up on their next call. Always pair with a reset
 * (`resetDefaultCasesStore()`) in a teardown hook.
 */
export function setDefaultCasesStoreForTests(store: CasesStore): void {
  defaultStore = store;
}

export function resetDefaultCasesStore(): void {
  defaultStore = null;
}
