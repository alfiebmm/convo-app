/**
 * In-memory CasesStore for unit tests (CON-164).
 *
 * Naturally tenant-scoped: every method takes `tenantId` and filters its
 * internal arrays by it. There is no internal helper that bypasses the
 * tenant filter, so writes from tenant A cannot be read from tenant B
 * unless the helper layer itself leaks (which is what these tests check).
 *
 * Not exported from the package — strictly a test fixture.
 */

import { randomUUID } from "node:crypto";

import type {
  CaseAttributeRow,
  CaseEventRow,
  CaseRow,
  CaseStatus,
  CasesStore,
  CreateCaseInput,
  ListCasesFilters,
  RecordCaseEventInput,
  SetCaseAttributeInput,
} from "../store";

export interface InMemoryCasesStore extends CasesStore {
  /** Test affordance: dump everything currently stored. */
  _dump(): {
    cases: CaseRow[];
    events: CaseEventRow[];
    attributes: CaseAttributeRow[];
  };
}

export function createInMemoryCasesStore(): InMemoryCasesStore {
  const cases: CaseRow[] = [];
  const events: CaseEventRow[] = [];
  const attributes: CaseAttributeRow[] = [];

  return {
    async insertCase(tenantId, input: CreateCaseInput): Promise<CaseRow> {
      const now = new Date();
      const row: CaseRow = {
        id: randomUUID(),
        tenantId,
        conversationId: input.conversationId,
        contactId: input.contactId ?? null,
        caseType: input.caseType,
        status: (input.status ?? "open") as CaseStatus,
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
        createdAt: now,
        updatedAt: now,
        resolvedAt: null,
      };
      cases.push(row);
      return { ...row };
    },

    async updateCase(tenantId, caseId, patch): Promise<CaseRow | null> {
      const idx = cases.findIndex(
        (c) => c.tenantId === tenantId && c.id === caseId
      );
      if (idx === -1) return null;
      const updated: CaseRow = {
        ...cases[idx],
        ...patch,
        updatedAt: new Date(),
      };
      cases[idx] = updated;
      return { ...updated };
    },

    async findCaseById(tenantId, caseId): Promise<CaseRow | null> {
      const row = cases.find(
        (c) => c.tenantId === tenantId && c.id === caseId
      );
      return row ? { ...row } : null;
    },

    async listCases(tenantId, filters: ListCasesFilters): Promise<CaseRow[]> {
      let rows = cases.filter((c) => c.tenantId === tenantId);
      if (filters.status) {
        rows = rows.filter((c) => c.status === filters.status);
      }
      if (filters.caseType) {
        rows = rows.filter((c) => c.caseType === filters.caseType);
      }
      if (filters.assignedTo !== undefined) {
        if (filters.assignedTo === null) {
          rows = rows.filter((c) => c.assignedTo === null);
        } else {
          rows = rows.filter((c) => c.assignedTo === filters.assignedTo);
        }
      }
      rows = rows
        .slice()
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const offset = filters.offset ?? 0;
      const limit = filters.limit ?? 50;
      return rows.slice(offset, offset + limit).map((r) => ({ ...r }));
    },

    async insertEvent(
      tenantId,
      input: RecordCaseEventInput
    ): Promise<CaseEventRow> {
      const row: CaseEventRow = {
        id: randomUUID(),
        tenantId,
        caseId: input.caseId,
        conversationId: input.conversationId,
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        eventType: input.eventType,
        payload: input.payload ?? {},
        createdAt: new Date(),
      };
      events.push(row);
      return { ...row };
    },

    async upsertAttribute(
      tenantId,
      input: SetCaseAttributeInput
    ): Promise<CaseAttributeRow> {
      const existingIdx = attributes.findIndex(
        (a) =>
          a.tenantId === tenantId &&
          a.caseId === input.caseId &&
          a.key === input.key
      );
      const row: CaseAttributeRow = {
        tenantId,
        caseId: input.caseId,
        key: input.key,
        value: input.value,
        source: input.source ?? null,
        confidence: input.confidence ?? null,
        detectedAt: new Date(),
      };
      if (existingIdx === -1) {
        attributes.push(row);
      } else {
        attributes[existingIdx] = row;
      }
      return { ...row };
    },

    async listAttributes(tenantId, caseId): Promise<CaseAttributeRow[]> {
      return attributes
        .filter((a) => a.tenantId === tenantId && a.caseId === caseId)
        .map((r) => ({ ...r }));
    },

    _dump() {
      return {
        cases: cases.map((r) => ({ ...r })),
        events: events.map((r) => ({ ...r })),
        attributes: attributes.map((r) => ({ ...r })),
      };
    },
  };
}
