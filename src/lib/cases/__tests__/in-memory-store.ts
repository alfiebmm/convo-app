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
  CaseDetailContactRow,
  CaseDetailConnectorRow,
  ConnectorOutboxRow,
  CaseDetailMessageRow,
  CaseDetailRow,
  CaseEventRow,
  CaseRow,
  CaseStatus,
  CaseListItemRow,
  CasesStore,
  CreateCaseInput,
  ListCasesFilters,
  ListCasesWithActivityFilters,
  RecordCaseEventInput,
  SetCaseAttributeInput,
} from "../store";

export interface InMemoryCasesStore extends CasesStore {
  _seedCaseDetail(caseId: string, detail: {
    contact?: CaseDetailContactRow | null;
    messages?: CaseDetailMessageRow[];
    connectors?: CaseDetailConnectorRow[];
    assignedOwnerName?: string | null;
    tenantSettings?: Record<string, unknown> | null;
  }): void;
  _seedConnector(row: ConnectorOutboxRow): void;
  /** Test affordance: dump everything currently stored. */
  _dump(): {
    cases: CaseRow[];
    events: CaseEventRow[];
    attributes: CaseAttributeRow[];
    connectors: ConnectorOutboxRow[];
  };
}

export function createInMemoryCasesStore(): InMemoryCasesStore {
  const cases: CaseRow[] = [];
  const events: CaseEventRow[] = [];
  const attributes: CaseAttributeRow[] = [];
  const connectors: ConnectorOutboxRow[] = [];
  const detailSeeds = new Map<
    string,
    {
      contact?: CaseDetailContactRow | null;
      messages?: CaseDetailMessageRow[];
      connectors?: CaseDetailConnectorRow[];
      assignedOwnerName?: string | null;
      tenantSettings?: Record<string, unknown> | null;
    }
  >();

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

    async findCaseByConversation(
      tenantId,
      conversationId
    ): Promise<CaseRow | null> {
      // Mirrors the unique-index guarantee from CON-161:
      // (tenant_id, conversation_id) is unique → at most one row.
      const row = cases.find(
        (c) => c.tenantId === tenantId && c.conversationId === conversationId
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

    async listCasesWithActivity(
      tenantId,
      filters: ListCasesWithActivityFilters
    ): Promise<CaseListItemRow[]> {
      let rows = cases.filter((c) => c.tenantId === tenantId);
      if (filters.caseType) {
        rows = rows.filter((c) => c.caseType === filters.caseType);
      }
      if (filters.followUpRequired !== undefined) {
        rows = rows.filter((c) =>
          filters.followUpRequired
            ? c.status !== "resolved" && c.status !== "dismissed"
            : c.status === "resolved" || c.status === "dismissed"
        );
      }
      if (filters.status) {
        rows = rows.filter((c) => c.status === filters.status);
      }
      if (filters.priority) {
        rows = rows.filter((c) => c.priority === filters.priority);
      }
      if (filters.assignedTo !== undefined) {
        rows = rows.filter((c) => c.assignedTo === filters.assignedTo);
      }
      if (filters.routingKey) {
        rows = rows.filter((c) => c.routingKey === filters.routingKey);
      }
      if (filters.ruleId) {
        rows = rows.filter((c) => c.ruleId === filters.ruleId);
      }
      if (filters.persona || filters.marketplaceSide || filters.topic) {
        rows = rows.filter((c) => {
          const attrs = attributes.filter(
            (a) => a.tenantId === tenantId && a.caseId === c.id
          );
          const attrValue = (key: string) =>
            attrs.find((a) => a.key === key)?.value;
          return (
            (!filters.persona || attrValue("persona") === filters.persona) &&
            (!filters.marketplaceSide ||
              attrValue("marketplace_side") === filters.marketplaceSide) &&
            (!filters.topic || attrValue("topic") === filters.topic)
          );
        });
      }

      const enriched = rows.map((c) => {
        const latestCaseEventAt =
          events
            .filter((e) => e.tenantId === tenantId && e.caseId === c.id)
            .map((e) => e.createdAt)
            .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
        const lastActivityAt =
          latestCaseEventAt && latestCaseEventAt > c.createdAt
            ? latestCaseEventAt
            : c.createdAt;
        return {
          ...c,
          conversationStatus: "active",
          conversationVisitorId: null,
          conversationMessageCount: 0,
          conversationStartedAt: c.createdAt,
          latestMessageAt: null,
          latestCaseEventAt,
          lastActivityAt,
          contactDisplayName: null,
          assignedOwnerName: null,
          latestConnectorType: null,
          latestConnectorDestinationId: null,
          latestConnectorStatus: null,
        };
      });

      const filtered = enriched.filter((c) => {
        if (filters.from && c.lastActivityAt < filters.from) return false;
        if (filters.to && c.lastActivityAt > filters.to) return false;
        return true;
      });

      const offset = filters.offset ?? 0;
      const limit = filters.limit ?? 50;
      return filtered
        .sort(
          (a, b) =>
            b.lastActivityAt.getTime() - a.lastActivityAt.getTime() ||
            b.createdAt.getTime() - a.createdAt.getTime()
        )
        .slice(offset, offset + limit)
        .map((r) => ({ ...r }));
    },

    async getCaseDetailById(
      tenantId,
      caseId
    ): Promise<CaseDetailRow | null> {
      const row = cases.find(
        (candidate) => candidate.tenantId === tenantId && candidate.id === caseId
      );
      if (!row) return null;

      const seed = detailSeeds.get(caseId) ?? {};
      const caseAttributes = attributes
        .filter((a) => a.tenantId === tenantId && a.caseId === caseId)
        .map((a) => ({ ...a }));
      const caseEvents = events
        .filter((e) => e.tenantId === tenantId && e.caseId === caseId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((e) => ({ ...e }));

      return {
        case: { ...row },
        conversation: {
          id: row.conversationId,
          status: "active",
          visitorId: null,
          messageCount: seed.messages?.length ?? 0,
          metadata: {},
          startedAt: row.createdAt,
          completedAt: null,
          createdAt: row.createdAt,
        },
        contact: seed.contact ?? null,
        assignedOwnerName: seed.assignedOwnerName ?? null,
        tenantSettings: seed.tenantSettings ?? null,
        messages: (seed.messages ?? []).map((message) => ({ ...message })),
        attributes: caseAttributes,
        events: caseEvents,
        connectors: [
          ...connectors.filter(
            (connector) =>
              connector.tenantId === tenantId && connector.caseId === caseId
          ),
          ...(seed.connectors ?? []),
        ].map((connector) => ({
          ...connector,
          payload: { ...connector.payload },
        })),
      };
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

    async findConnectorOutboxRow(tenantId, outboxId) {
      const row = connectors.find(
        (connector) => connector.tenantId === tenantId && connector.id === outboxId
      );
      return row ? { ...row, payload: { ...row.payload } } : null;
    },

    async requeueFailedConnectorOutboxRow(tenantId, outboxId) {
      const idx = connectors.findIndex(
        (connector) =>
          connector.tenantId === tenantId &&
          connector.id === outboxId &&
          connector.status === "failed"
      );
      if (idx === -1) return null;
      connectors[idx] = {
        ...connectors[idx],
        status: "pending",
        nextAttemptAt: new Date(),
      };
      return { ...connectors[idx], payload: { ...connectors[idx].payload } };
    },

    _seedCaseDetail(caseId, detail) {
      detailSeeds.set(caseId, detail);
    },

    _seedConnector(row) {
      connectors.push({ ...row, payload: { ...row.payload } });
    },

    _dump() {
      return {
        cases: cases.map((r) => ({ ...r })),
        events: events.map((r) => ({ ...r })),
        attributes: attributes.map((r) => ({ ...r })),
        connectors: connectors.map((r) => ({ ...r, payload: { ...r.payload } })),
      };
    },
  };
}
