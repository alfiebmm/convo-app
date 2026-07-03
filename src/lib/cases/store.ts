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

import { and, desc, eq, sql, type SQL } from "drizzle-orm";

import { db as defaultDb } from "@/lib/db";
import {
  connectorOutbox,
  contacts,
  conversations,
  followUpCaseAttributes,
  followUpCases,
  followUpEvents,
  messages,
  tenants,
  users,
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

export interface ListCasesWithActivityFilters {
  caseType?: string;
  followUpRequired?: boolean;
  status?: CaseStatus;
  priority?: string;
  assignedTo?: string | null;
  routingKey?: string;
  ruleId?: string;
  persona?: string;
  marketplaceSide?: string;
  topic?: string;
  connectorDestination?: string;
  connectorDeliveryState?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

export interface CaseListItemRow extends CaseRow {
  conversationStatus: string;
  conversationVisitorId: string | null;
  conversationMessageCount: number;
  conversationStartedAt: Date;
  latestMessageAt: Date | null;
  latestCaseEventAt: Date | null;
  lastActivityAt: Date;
  contactDisplayName: string | null;
  assignedOwnerName: string | null;
  latestConnectorType: string | null;
  latestConnectorDestinationId: string | null;
  latestConnectorStatus: string | null;
}

export interface ConversationFilterOptionsRow {
  routingKeys: string[];
  ruleIds: string[];
  personas: string[];
  marketplaceSides: string[];
  topics: string[];
  connectorDestinations: string[];
}

export interface CaseDetailMessageRow {
  id: string;
  role: string;
  content: string;
  createdAt: Date;
}

export interface CaseDetailContactRow {
  id: string;
  displayName: string | null;
  emailNormalised: string | null;
  phoneNormalised: string | null;
  preferredContactMethod: string | null;
  attributes: Record<string, unknown>;
  consentState: string | null;
  privacyNoticeVersion: string | null;
  privacyNoticeRecordedAt: Date | null;
}

export interface CaseDetailConnectorRow {
  id: string;
  connectorType: string;
  destinationId: string | null;
  payloadVersion: string;
  payload: Record<string, unknown>;
  status: string;
  attemptCount: number;
  lastError: string | null;
  nextAttemptAt: Date;
  createdAt: Date;
  deliveredAt: Date | null;
}

export interface ConnectorOutboxRow extends CaseDetailConnectorRow {
  tenantId: string;
  caseId: string;
  idempotencyKey: string;
}

export interface CaseDetailRow {
  case: CaseRow;
  conversation: {
    id: string;
    status: string;
    visitorId: string | null;
    messageCount: number;
    metadata: Record<string, unknown>;
    startedAt: Date;
    completedAt: Date | null;
    createdAt: Date;
  };
  contact: CaseDetailContactRow | null;
  assignedOwnerName: string | null;
  tenantSettings: Record<string, unknown> | null;
  messages: CaseDetailMessageRow[];
  attributes: CaseAttributeRow[];
  events: CaseEventRow[];
  connectors: CaseDetailConnectorRow[];
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

  /**
   * Look up the (at most one) case for a (tenant, conversation) pair. The
   * unique index `follow_up_cases_tenant_conversation_unique` from CON-161
   * guarantees at most one row. Returns `null` when no case exists yet.
   *
   * Used by the chat-route lifecycle (CON-170 / D2a) to keep persistence
   * idempotent across re-eval turns within the same conversation: the
   * first re-eval that resolves a case-creating action inserts the row;
   * subsequent turns find-and-return the existing row instead of racing
   * the unique-index constraint.
   */
  findCaseByConversation(
    tenantId: string,
    conversationId: string
  ): Promise<CaseRow | null>;

  listCases(tenantId: string, filters: ListCasesFilters): Promise<CaseRow[]>;

  listCasesWithActivity(
    tenantId: string,
    filters: ListCasesWithActivityFilters
  ): Promise<CaseListItemRow[]>;

  /**
   * Return the distinct values a tenant has ever seen for the columns
   * that back the Conversations page filter dropdowns. Used to swap
   * free-text inputs for `<select>` menus so tenants can only pick a
   * value that will actually match a case (Bug 1, 3 Jul 2026 — Cam).
   *
   * Each list is deduped, sorted alphabetically ascending, and capped so
   * a busy tenant doesn't ship 10,000-option `<select>`s to the browser.
   * Empty strings and NULLs are filtered out on the SQL side.
   */
  listConversationFilterOptions(
    tenantId: string,
    limitPerField?: number,
  ): Promise<ConversationFilterOptionsRow>;

  getCaseDetailById(
    tenantId: string,
    caseId: string
  ): Promise<CaseDetailRow | null>;

  insertEvent(tenantId: string, input: RecordCaseEventInput): Promise<CaseEventRow>;

  upsertAttribute(
    tenantId: string,
    input: SetCaseAttributeInput
  ): Promise<CaseAttributeRow>;

  listAttributes(tenantId: string, caseId: string): Promise<CaseAttributeRow[]>;

  findConnectorOutboxRow(
    tenantId: string,
    outboxId: string
  ): Promise<ConnectorOutboxRow | null>;

  requeueFailedConnectorOutboxRow(
    tenantId: string,
    outboxId: string
  ): Promise<ConnectorOutboxRow | null>;
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

    async findCaseByConversation(tenantId, conversationId) {
      const [row] = await db
        .select()
        .from(followUpCases)
        .where(
          and(
            eq(followUpCases.tenantId, tenantId),
            eq(followUpCases.conversationId, conversationId)
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

    async listCasesWithActivity(tenantId, filters) {
      const where: SQL[] = [sql`base.tenant_id = ${tenantId}`];

      if (filters.caseType) {
        where.push(sql`base.case_type = ${filters.caseType}`);
      }
      if (filters.followUpRequired !== undefined) {
        if (filters.followUpRequired) {
          where.push(sql`base.status NOT IN ('resolved', 'dismissed')`);
        } else {
          where.push(sql`base.status IN ('resolved', 'dismissed')`);
        }
      }
      if (filters.status) {
        where.push(sql`base.status = ${filters.status}`);
      }
      if (filters.priority) {
        where.push(sql`base.priority = ${filters.priority}`);
      }
      if (filters.assignedTo !== undefined) {
        if (filters.assignedTo === null) {
          where.push(sql`base.assigned_to IS NULL`);
        } else {
          where.push(sql`base.assigned_to = ${filters.assignedTo}::uuid`);
        }
      }
      if (filters.routingKey) {
        where.push(sql`base.routing_key = ${filters.routingKey}`);
      }
      if (filters.ruleId) {
        where.push(sql`base.rule_id = ${filters.ruleId}`);
      }
      if (filters.persona) {
        where.push(sql`base.persona = ${filters.persona}`);
      }
      if (filters.marketplaceSide) {
        where.push(sql`base.marketplace_side = ${filters.marketplaceSide}`);
      }
      if (filters.topic) {
        where.push(sql`base.topic = ${filters.topic}`);
      }
      if (filters.connectorDestination) {
        where.push(
          sql`base.latest_connector_destination_id = ${filters.connectorDestination}`
        );
      }
      if (filters.connectorDeliveryState) {
        where.push(sql`base.latest_connector_status = ${filters.connectorDeliveryState}`);
      }
      if (filters.from) {
        where.push(sql`base.last_activity_at >= ${filters.from}`);
      }
      if (filters.to) {
        where.push(sql`base.last_activity_at <= ${filters.to}`);
      }

      const limit = filters.limit ?? 100;
      const offset = filters.offset ?? 0;

      const result = await db.execute(sql`
        WITH latest_messages AS (
          SELECT ${messages.conversationId} AS conversation_id,
                 MAX(${messages.createdAt}) AS latest_message_at
            FROM ${messages}
           GROUP BY ${messages.conversationId}
        ),
        latest_case_events AS (
          SELECT ${followUpEvents.caseId} AS case_id,
                 MAX(${followUpEvents.createdAt}) AS latest_case_event_at
            FROM ${followUpEvents}
           WHERE ${followUpEvents.tenantId} = ${tenantId}
           GROUP BY ${followUpEvents.caseId}
        ),
        latest_connectors AS (
          SELECT DISTINCT ON (${connectorOutbox.caseId})
                 ${connectorOutbox.caseId} AS case_id,
                 ${connectorOutbox.connectorType} AS connector_type,
                 ${connectorOutbox.destinationId} AS destination_id,
                 ${connectorOutbox.status} AS status
            FROM ${connectorOutbox}
           WHERE ${connectorOutbox.tenantId} = ${tenantId}
           ORDER BY ${connectorOutbox.caseId}, ${connectorOutbox.createdAt} DESC
        ),
        case_attributes AS (
          SELECT ${followUpCaseAttributes.caseId} AS case_id,
                 MAX(${followUpCaseAttributes.value} #>> '{}')
                   FILTER (WHERE ${followUpCaseAttributes.key} = 'persona') AS persona,
                 MAX(${followUpCaseAttributes.value} #>> '{}')
                   FILTER (WHERE ${followUpCaseAttributes.key} = 'marketplace_side') AS marketplace_side,
                 MAX(${followUpCaseAttributes.value} #>> '{}')
                   FILTER (WHERE ${followUpCaseAttributes.key} = 'topic') AS topic
            FROM ${followUpCaseAttributes}
           WHERE ${followUpCaseAttributes.tenantId} = ${tenantId}
             AND ${followUpCaseAttributes.key} IN ('persona', 'marketplace_side', 'topic')
           GROUP BY ${followUpCaseAttributes.caseId}
        ),
        base AS (
          SELECT ${followUpCases.id} AS "id",
                 ${followUpCases.tenantId} AS "tenant_id",
                 ${followUpCases.conversationId} AS "conversation_id",
                 ${followUpCases.contactId} AS "contact_id",
                 ${followUpCases.caseType} AS "case_type",
                 ${followUpCases.status} AS "status",
                 ${followUpCases.priority} AS "priority",
                 ${followUpCases.routingKey} AS "routing_key",
                 ${followUpCases.title} AS "title",
                 ${followUpCases.summary} AS "summary",
                 ${followUpCases.reason} AS "reason",
                 ${followUpCases.source} AS "source",
                 ${followUpCases.ruleId} AS "rule_id",
                 ${followUpCases.classifierConfidence} AS "classifier_confidence",
                 ${followUpCases.assignedTo} AS "assigned_to",
                 ${followUpCases.externalSystem} AS "external_system",
                 ${followUpCases.externalId} AS "external_id",
                 ${followUpCases.createdAt} AS "created_at",
                 ${followUpCases.updatedAt} AS "updated_at",
                 ${followUpCases.resolvedAt} AS "resolved_at",
                 ${conversations.status} AS "conversation_status",
                 ${conversations.visitorId} AS "conversation_visitor_id",
                 ${conversations.messageCount} AS "conversation_message_count",
                 ${conversations.startedAt} AS "conversation_started_at",
                 latest_messages.latest_message_at AS "latest_message_at",
                 latest_case_events.latest_case_event_at AS "latest_case_event_at",
                 GREATEST(
                   COALESCE(latest_messages.latest_message_at, ${conversations.startedAt}),
                   COALESCE(latest_case_events.latest_case_event_at, ${conversations.startedAt})
                 ) AS "last_activity_at",
                 ${contacts.displayName} AS "contact_display_name",
                 ${users.name} AS "assigned_owner_name",
                 latest_connectors.connector_type AS "latest_connector_type",
                 latest_connectors.destination_id AS "latest_connector_destination_id",
                 latest_connectors.status AS "latest_connector_status",
                 case_attributes.persona AS "persona",
                 case_attributes.marketplace_side AS "marketplace_side",
                 case_attributes.topic AS "topic"
            FROM ${followUpCases}
            INNER JOIN ${conversations}
              ON ${conversations.id} = ${followUpCases.conversationId}
             AND ${conversations.tenantId} = ${tenantId}
            LEFT JOIN latest_messages
              ON latest_messages.conversation_id = ${followUpCases.conversationId}
            LEFT JOIN latest_case_events
              ON latest_case_events.case_id = ${followUpCases.id}
            LEFT JOIN ${contacts}
              ON ${contacts.id} = ${followUpCases.contactId}
             AND ${contacts.tenantId} = ${tenantId}
            LEFT JOIN ${users}
              ON ${users.id} = ${followUpCases.assignedTo}
            LEFT JOIN latest_connectors
              ON latest_connectors.case_id = ${followUpCases.id}
            LEFT JOIN case_attributes
              ON case_attributes.case_id = ${followUpCases.id}
           WHERE ${followUpCases.tenantId} = ${tenantId}
        )
        SELECT *
          FROM base
         WHERE ${and(...where)}
         ORDER BY base.last_activity_at DESC, base.created_at DESC
         LIMIT ${limit}
        OFFSET ${offset}
      `);

      const raw =
        (result as unknown as { rows?: Record<string, unknown>[] }).rows ??
        (result as unknown as Record<string, unknown>[]);

      return raw.map((row) => ({
        id: String(row.id),
        tenantId: String(row.tenant_id),
        conversationId: String(row.conversation_id),
        contactId: (row.contact_id as string | null) ?? null,
        caseType: String(row.case_type),
        status: row.status as CaseStatus,
        priority: (row.priority as string | null) ?? null,
        routingKey: (row.routing_key as string | null) ?? null,
        title: (row.title as string | null) ?? null,
        summary: (row.summary as string | null) ?? null,
        reason: (row.reason as string | null) ?? null,
        source: (row.source as string | null) ?? null,
        ruleId: (row.rule_id as string | null) ?? null,
        classifierConfidence:
          row.classifier_confidence === null || row.classifier_confidence === undefined
            ? null
            : Number(row.classifier_confidence),
        assignedTo: (row.assigned_to as string | null) ?? null,
        externalSystem: (row.external_system as string | null) ?? null,
        externalId: (row.external_id as string | null) ?? null,
        createdAt: new Date(String(row.created_at)),
        updatedAt: new Date(String(row.updated_at)),
        resolvedAt: row.resolved_at ? new Date(String(row.resolved_at)) : null,
        conversationStatus: String(row.conversation_status),
        conversationVisitorId: (row.conversation_visitor_id as string | null) ?? null,
        conversationMessageCount: Number(row.conversation_message_count ?? 0),
        conversationStartedAt: new Date(String(row.conversation_started_at)),
        latestMessageAt: row.latest_message_at
          ? new Date(String(row.latest_message_at))
          : null,
        latestCaseEventAt: row.latest_case_event_at
          ? new Date(String(row.latest_case_event_at))
          : null,
        lastActivityAt: new Date(String(row.last_activity_at)),
        contactDisplayName: (row.contact_display_name as string | null) ?? null,
        assignedOwnerName: (row.assigned_owner_name as string | null) ?? null,
        latestConnectorType: (row.latest_connector_type as string | null) ?? null,
        latestConnectorDestinationId:
          (row.latest_connector_destination_id as string | null) ?? null,
        latestConnectorStatus: (row.latest_connector_status as string | null) ?? null,
      }));
    },

    async listConversationFilterOptions(tenantId, limitPerField = 200) {
      // Distinct-value queries for the filter dropdowns on
      // /dashboard/conversations. Each query is tenant-scoped and
      // filters out NULLs / empty strings on the SQL side. Sorted
      // alphabetically ascending for a stable UI order.
      //
      // We intentionally split into 6 small queries instead of one
      // giant UNION so a slow-index on one column doesn't drag the
      // others. The whole helper still runs in parallel below.
      const cap = Math.max(1, Math.min(limitPerField, 1000));

      const routingKeysP = db.execute(sql`
        SELECT DISTINCT ${followUpCases.routingKey} AS v
          FROM ${followUpCases}
         WHERE ${followUpCases.tenantId} = ${tenantId}
           AND ${followUpCases.routingKey} IS NOT NULL
           AND ${followUpCases.routingKey} <> ''
         ORDER BY v ASC
         LIMIT ${cap}
      `);
      const ruleIdsP = db.execute(sql`
        SELECT DISTINCT ${followUpCases.ruleId} AS v
          FROM ${followUpCases}
         WHERE ${followUpCases.tenantId} = ${tenantId}
           AND ${followUpCases.ruleId} IS NOT NULL
           AND ${followUpCases.ruleId} <> ''
         ORDER BY v ASC
         LIMIT ${cap}
      `);
      // persona / marketplace_side / topic all live in the
      // follow_up_case_attributes table under a per-key row. Each
      // attribute value is a `{ "value": string }` jsonb payload.
      const attributeDistinct = (key: string) => sql`
        SELECT DISTINCT ${followUpCaseAttributes.value}->>'value' AS v
          FROM ${followUpCaseAttributes}
         WHERE ${followUpCaseAttributes.tenantId} = ${tenantId}
           AND ${followUpCaseAttributes.key} = ${key}
           AND ${followUpCaseAttributes.value}->>'value' IS NOT NULL
           AND ${followUpCaseAttributes.value}->>'value' <> ''
         ORDER BY v ASC
         LIMIT ${cap}
      `;
      const personasP = db.execute(attributeDistinct("persona"));
      const marketplaceSidesP = db.execute(attributeDistinct("marketplace_side"));
      const topicsP = db.execute(attributeDistinct("topic"));
      const destinationsP = db.execute(sql`
        SELECT DISTINCT ${connectorOutbox.destinationId} AS v
          FROM ${connectorOutbox}
         WHERE ${connectorOutbox.tenantId} = ${tenantId}
           AND ${connectorOutbox.destinationId} IS NOT NULL
           AND ${connectorOutbox.destinationId} <> ''
         ORDER BY v ASC
         LIMIT ${cap}
      `);

      const [
        routingKeysR,
        ruleIdsR,
        personasR,
        marketplaceSidesR,
        topicsR,
        destinationsR,
      ] = await Promise.all([
        routingKeysP,
        ruleIdsP,
        personasP,
        marketplaceSidesP,
        topicsP,
        destinationsP,
      ]);

      const toStrings = (r: { rows: Record<string, unknown>[] }): string[] =>
        r.rows
          .map((row) => (typeof row.v === "string" ? row.v : null))
          .filter((v): v is string => !!v);

      return {
        routingKeys: toStrings(routingKeysR),
        ruleIds: toStrings(ruleIdsR),
        personas: toStrings(personasR),
        marketplaceSides: toStrings(marketplaceSidesR),
        topics: toStrings(topicsR),
        connectorDestinations: toStrings(destinationsR),
      };
    },

    async getCaseDetailById(tenantId, caseId) {
      const result = await db.execute(sql`
        WITH base AS (
          SELECT ${followUpCases.id} AS "id",
                 ${followUpCases.tenantId} AS "tenant_id",
                 ${followUpCases.conversationId} AS "conversation_id",
                 ${followUpCases.contactId} AS "contact_id",
                 ${followUpCases.caseType} AS "case_type",
                 ${followUpCases.status} AS "status",
                 ${followUpCases.priority} AS "priority",
                 ${followUpCases.routingKey} AS "routing_key",
                 ${followUpCases.title} AS "title",
                 ${followUpCases.summary} AS "summary",
                 ${followUpCases.reason} AS "reason",
                 ${followUpCases.source} AS "source",
                 ${followUpCases.ruleId} AS "rule_id",
                 ${followUpCases.classifierConfidence} AS "classifier_confidence",
                 ${followUpCases.assignedTo} AS "assigned_to",
                 ${followUpCases.externalSystem} AS "external_system",
                 ${followUpCases.externalId} AS "external_id",
                 ${followUpCases.createdAt} AS "created_at",
                 ${followUpCases.updatedAt} AS "updated_at",
                 ${followUpCases.resolvedAt} AS "resolved_at",
                 ${conversations.status} AS "conversation_status",
                 ${conversations.visitorId} AS "conversation_visitor_id",
                 ${conversations.messageCount} AS "conversation_message_count",
                 ${conversations.metadata} AS "conversation_metadata",
                 ${conversations.startedAt} AS "conversation_started_at",
                 ${conversations.completedAt} AS "conversation_completed_at",
                 ${conversations.createdAt} AS "conversation_created_at",
                 ${contacts.id} AS "contact_row_id",
                 ${contacts.displayName} AS "contact_display_name",
                 ${contacts.emailNormalised} AS "contact_email_normalised",
                 ${contacts.phoneNormalised} AS "contact_phone_normalised",
                 ${contacts.preferredContactMethod} AS "contact_preferred_contact_method",
                 ${contacts.attributes} AS "contact_attributes",
                 ${contacts.consentState} AS "contact_consent_state",
                 ${contacts.privacyNoticeVersion} AS "contact_privacy_notice_version",
                 ${contacts.updatedAt} AS "contact_updated_at",
                 ${users.name} AS "assigned_owner_name",
                 ${tenants.settings} AS "tenant_settings"
            FROM ${followUpCases}
            INNER JOIN ${conversations}
              ON ${conversations.id} = ${followUpCases.conversationId}
             AND ${conversations.tenantId} = ${tenantId}
            INNER JOIN ${tenants}
              ON ${tenants.id} = ${followUpCases.tenantId}
            LEFT JOIN ${contacts}
              ON ${contacts.id} = ${followUpCases.contactId}
             AND ${contacts.tenantId} = ${tenantId}
            LEFT JOIN ${users}
              ON ${users.id} = ${followUpCases.assignedTo}
           WHERE ${followUpCases.tenantId} = ${tenantId}
             AND ${followUpCases.id} = ${caseId}
           LIMIT 1
        )
        SELECT base.*,
               COALESCE((
                 SELECT json_agg(json_build_object(
                   'id', ${messages.id},
                   'role', ${messages.role},
                   'content', ${messages.content},
                   'createdAt', ${messages.createdAt}
                 ) ORDER BY ${messages.createdAt} ASC)
                   FROM ${messages}
                  WHERE ${messages.conversationId} = base.conversation_id
               ), '[]'::json) AS "messages_json",
               COALESCE((
                 SELECT json_agg(json_build_object(
                   'tenantId', ${followUpCaseAttributes.tenantId},
                   'caseId', ${followUpCaseAttributes.caseId},
                   'key', ${followUpCaseAttributes.key},
                   'value', ${followUpCaseAttributes.value},
                   'source', ${followUpCaseAttributes.source},
                   'confidence', ${followUpCaseAttributes.confidence},
                   'detectedAt', ${followUpCaseAttributes.detectedAt}
                 ) ORDER BY ${followUpCaseAttributes.key} ASC)
                   FROM ${followUpCaseAttributes}
                  WHERE ${followUpCaseAttributes.tenantId} = ${tenantId}
                    AND ${followUpCaseAttributes.caseId} = base.id
               ), '[]'::json) AS "attributes_json",
               COALESCE((
                 SELECT json_agg(json_build_object(
                   'id', ${followUpEvents.id},
                   'tenantId', ${followUpEvents.tenantId},
                   'caseId', ${followUpEvents.caseId},
                   'conversationId', ${followUpEvents.conversationId},
                   'actorType', ${followUpEvents.actorType},
                   'actorId', ${followUpEvents.actorId},
                   'eventType', ${followUpEvents.eventType},
                   'payload', ${followUpEvents.payload},
                   'createdAt', ${followUpEvents.createdAt}
                 ) ORDER BY ${followUpEvents.createdAt} DESC)
                   FROM ${followUpEvents}
                  WHERE ${followUpEvents.tenantId} = ${tenantId}
                    AND ${followUpEvents.caseId} = base.id
               ), '[]'::json) AS "events_json",
               COALESCE((
                 SELECT json_agg(json_build_object(
                   'id', ${connectorOutbox.id},
                   'connectorType', ${connectorOutbox.connectorType},
                   'destinationId', ${connectorOutbox.destinationId},
                   'payloadVersion', ${connectorOutbox.payloadVersion},
                   'payload', ${connectorOutbox.payload},
                   'status', ${connectorOutbox.status},
                   'attemptCount', ${connectorOutbox.attemptCount},
                   'lastError', ${connectorOutbox.lastError},
                   'nextAttemptAt', ${connectorOutbox.nextAttemptAt},
                   'createdAt', ${connectorOutbox.createdAt},
                   'deliveredAt', ${connectorOutbox.deliveredAt}
                 ) ORDER BY ${connectorOutbox.createdAt} DESC)
                   FROM ${connectorOutbox}
                  WHERE ${connectorOutbox.tenantId} = ${tenantId}
                    AND ${connectorOutbox.caseId} = base.id
               ), '[]'::json) AS "connectors_json"
          FROM base
      `);

      const rawRows =
        (result as unknown as { rows?: Record<string, unknown>[] }).rows ??
        (result as unknown as Record<string, unknown>[]);
      const row = rawRows[0];
      if (!row) return null;

      const parseJsonArray = <T>(value: unknown): T[] => {
        if (Array.isArray(value)) return value as T[];
        if (typeof value === "string") return JSON.parse(value) as T[];
        return [];
      };
      const asRecord = (value: unknown): Record<string, unknown> =>
        value && typeof value === "object" && !Array.isArray(value)
          ? (value as Record<string, unknown>)
          : {};

      const caseRow: CaseRow = {
        id: String(row.id),
        tenantId: String(row.tenant_id),
        conversationId: String(row.conversation_id),
        contactId: (row.contact_id as string | null) ?? null,
        caseType: String(row.case_type),
        status: row.status as CaseStatus,
        priority: (row.priority as string | null) ?? null,
        routingKey: (row.routing_key as string | null) ?? null,
        title: (row.title as string | null) ?? null,
        summary: (row.summary as string | null) ?? null,
        reason: (row.reason as string | null) ?? null,
        source: (row.source as string | null) ?? null,
        ruleId: (row.rule_id as string | null) ?? null,
        classifierConfidence:
          row.classifier_confidence === null || row.classifier_confidence === undefined
            ? null
            : Number(row.classifier_confidence),
        assignedTo: (row.assigned_to as string | null) ?? null,
        externalSystem: (row.external_system as string | null) ?? null,
        externalId: (row.external_id as string | null) ?? null,
        createdAt: new Date(String(row.created_at)),
        updatedAt: new Date(String(row.updated_at)),
        resolvedAt: row.resolved_at ? new Date(String(row.resolved_at)) : null,
      };

      return {
        case: caseRow,
        conversation: {
          id: String(row.conversation_id),
          status: String(row.conversation_status),
          visitorId: (row.conversation_visitor_id as string | null) ?? null,
          messageCount: Number(row.conversation_message_count ?? 0),
          metadata: asRecord(row.conversation_metadata),
          startedAt: new Date(String(row.conversation_started_at)),
          completedAt: row.conversation_completed_at
            ? new Date(String(row.conversation_completed_at))
            : null,
          createdAt: new Date(String(row.conversation_created_at)),
        },
        contact: row.contact_row_id
          ? {
              id: String(row.contact_row_id),
              displayName: (row.contact_display_name as string | null) ?? null,
              emailNormalised:
                (row.contact_email_normalised as string | null) ?? null,
              phoneNormalised:
                (row.contact_phone_normalised as string | null) ?? null,
              preferredContactMethod:
                (row.contact_preferred_contact_method as string | null) ?? null,
              attributes: asRecord(row.contact_attributes),
              consentState: (row.contact_consent_state as string | null) ?? null,
              privacyNoticeVersion:
                (row.contact_privacy_notice_version as string | null) ?? null,
              privacyNoticeRecordedAt: row.contact_updated_at
                ? new Date(String(row.contact_updated_at))
                : null,
            }
          : null,
        assignedOwnerName: (row.assigned_owner_name as string | null) ?? null,
        tenantSettings: asRecord(row.tenant_settings),
        messages: parseJsonArray<Record<string, unknown>>(row.messages_json).map(
          (message) => ({
            id: String(message.id),
            role: String(message.role),
            content: String(message.content),
            createdAt: new Date(String(message.createdAt)),
          })
        ),
        attributes: parseJsonArray<Record<string, unknown>>(
          row.attributes_json
        ).map((attribute) => ({
          tenantId: String(attribute.tenantId),
          caseId: String(attribute.caseId),
          key: String(attribute.key),
          value: attribute.value,
          source: (attribute.source as string | null) ?? null,
          confidence:
            attribute.confidence === null || attribute.confidence === undefined
              ? null
              : Number(attribute.confidence),
          detectedAt: new Date(String(attribute.detectedAt)),
        })),
        events: parseJsonArray<Record<string, unknown>>(row.events_json).map(
          (event) => ({
            id: String(event.id),
            tenantId: String(event.tenantId),
            caseId: String(event.caseId),
            conversationId: String(event.conversationId),
            actorType: String(event.actorType),
            actorId: (event.actorId as string | null) ?? null,
            eventType: String(event.eventType),
            payload: asRecord(event.payload),
            createdAt: new Date(String(event.createdAt)),
          })
        ),
        connectors: parseJsonArray<Record<string, unknown>>(
          row.connectors_json
        ).map((connector) => ({
          id: String(connector.id),
          connectorType: String(connector.connectorType),
          destinationId: (connector.destinationId as string | null) ?? null,
          payloadVersion: String(connector.payloadVersion),
          payload: asRecord(connector.payload),
          status: String(connector.status),
          attemptCount: Number(connector.attemptCount ?? 0),
          lastError: (connector.lastError as string | null) ?? null,
          nextAttemptAt: new Date(String(connector.nextAttemptAt)),
          createdAt: new Date(String(connector.createdAt)),
          deliveredAt: connector.deliveredAt
            ? new Date(String(connector.deliveredAt))
            : null,
        })),
      };
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

    async findConnectorOutboxRow(tenantId, outboxId) {
      const [row] = await db
        .select()
        .from(connectorOutbox)
        .where(
          and(
            eq(connectorOutbox.tenantId, tenantId),
            eq(connectorOutbox.id, outboxId)
          )
        )
        .limit(1);
      return row ? (row as ConnectorOutboxRow) : null;
    },

    async requeueFailedConnectorOutboxRow(tenantId, outboxId) {
      const [row] = await db
        .update(connectorOutbox)
        .set({
          status: "pending",
          nextAttemptAt: new Date(),
        })
        .where(
          and(
            eq(connectorOutbox.tenantId, tenantId),
            eq(connectorOutbox.id, outboxId),
            eq(connectorOutbox.status, "failed")
          )
        )
        .returning();
      return row ? (row as ConnectorOutboxRow) : null;
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
