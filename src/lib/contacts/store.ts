/**
 * ContactsStore — data-access seam for the contact helpers (CON-164).
 *
 * See `src/lib/cases/store.ts` for the rationale behind the store pattern.
 * Tenant-scope rule: every method takes `tenantId` first and the Drizzle
 * implementation includes `eq(table.tenantId, tenantId)` in every WHERE
 * clause. No escape hatches.
 */

import { and, eq, sql, type SQL } from "drizzle-orm";

import { db as defaultDb } from "@/lib/db";
import {
  connectorOutbox,
  contactIdentifiers,
  contacts,
  conversationContacts,
  conversations,
  followUpCases,
  followUpEvents,
} from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export interface ContactRow {
  id: string;
  tenantId: string;
  displayName: string | null;
  emailNormalised: string | null;
  phoneNormalised: string | null;
  preferredContactMethod: string | null;
  attributes: Record<string, unknown>;
  consentState: string | null;
  privacyNoticeVersion: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type ContactListSort =
  | "name-asc"
  | "name-desc"
  | "last-seen-desc"
  | "last-seen-asc";

export interface ListContactsByTenantFilters {
  q?: string;
  persona?: string;

  caseType?: string;
  caseStatus?: string;
  from?: Date;
  to?: Date;
  page?: number;
  sort?: ContactListSort;
}

export interface ContactListItemRow extends ContactRow {
  company: string | null;
  location: string | null;
  persona: string | null;
  serviceOrProduct: string | null;
  relatedCaseType: string | null;
  openCaseStatus: string | null;
}

export interface ContactIdentifierRow {
  id: string;
  tenantId: string;
  contactId: string;
  type: string;
  valueNormalised: string;
  verifiedAt: Date | null;
  source: string | null;
  createdAt: Date;
}

export interface ContactConversationHistoryRow {
  id: string;
  status: string;
  visitorId: string | null;
  messageCount: number;
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  relationship: string;
  linkedAt: Date;
  caseId: string | null;
  caseType: string | null;
  caseStatus: string | null;
}

export interface ContactCaseHistoryRow {
  id: string;
  tenantId: string;
  conversationId: string;
  contactId: string | null;
  caseType: string;
  status: string;
  priority: string | null;
  title: string | null;
  summary: string | null;
  reason: string | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
}

export interface ContactConnectorSummaryRow {
  connectorType: string;
  status: string;
  destinationId: string | null;
  caseId: string;
  attemptCount: number;
  lastError: string | null;
  createdAt: Date;
  deliveredAt: Date | null;
}

export interface ContactAuditEventRow {
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

export interface ContactDetailRow {
  contact: ContactRow;
  identifiers: ContactIdentifierRow[];
  conversations: ContactConversationHistoryRow[];
  cases: ContactCaseHistoryRow[];
  connectors: ContactConnectorSummaryRow[];
  events: ContactAuditEventRow[];
}

export interface UpsertContactInput {
  /**
   * Lowercased + trimmed e-mail. Caller normalises; the store just stores.
   */
  emailNormalised?: string | null;
  /**
   * E.164 phone. Caller normalises; the store just stores.
   */
  phoneNormalised?: string | null;
  displayName?: string | null;
  preferredContactMethod?: string | null;
  attributes?: Record<string, unknown>;
  consentState?: string | null;
  privacyNoticeVersion?: string | null;
}

export interface ConversationContactLinkRow {
  tenantId: string;
  conversationId: string;
  contactId: string;
  relationship: string;
  createdAt: Date;
}

export interface LinkContactInput {
  conversationId: string;
  contactId: string;
  /**
   * Free-form for v1 — e.g. "primary", "cc". The Convo product currently
   * uses "primary" everywhere; downstream tickets may introduce more.
   */
  relationship: string;
}

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

export interface ContactsStore {
  /**
   * Find an existing contact for this tenant by normalised email/phone, or
   * insert a new one. Returns the canonical row and whether it was newly
   * created. Matching prefers email over phone when both are supplied.
   */
  upsertContact(
    tenantId: string,
    input: UpsertContactInput,
  ): Promise<{ contact: ContactRow; created: boolean }>;

  findContactById(
    tenantId: string,
    contactId: string,
  ): Promise<ContactRow | null>;

  listContactsByTenant(
    tenantId: string,
    filters: ListContactsByTenantFilters,
  ): Promise<{ rows: ContactListItemRow[]; totalCount: number }>;

  getContactDetailById(
    tenantId: string,
    contactId: string,
  ): Promise<ContactDetailRow | null>;

  findLatestCaseForContact(
    tenantId: string,
    contactId: string,
  ): Promise<ContactCaseHistoryRow | null>;

  linkContactToConversation(
    tenantId: string,
    input: LinkContactInput,
  ): Promise<ConversationContactLinkRow>;
}

// ---------------------------------------------------------------------------
// Drizzle implementation
// ---------------------------------------------------------------------------

type DrizzleDb = typeof defaultDb;

export function createDrizzleContactsStore(
  db: DrizzleDb = defaultDb,
): ContactsStore {
  return {
    async upsertContact(tenantId, input) {
      // Match precedence: email > phone. Both lookups are tenant-scoped via
      // the `contacts_tenant_email_idx` / `contacts_tenant_phone_idx`
      // indexes (see schema).
      let existing: ContactRow | null = null;
      if (input.emailNormalised) {
        const [row] = await db
          .select()
          .from(contacts)
          .where(
            and(
              eq(contacts.tenantId, tenantId),
              eq(contacts.emailNormalised, input.emailNormalised),
            ),
          )
          .limit(1);
        existing = (row as ContactRow) ?? null;
      }
      if (!existing && input.phoneNormalised) {
        const [row] = await db
          .select()
          .from(contacts)
          .where(
            and(
              eq(contacts.tenantId, tenantId),
              eq(contacts.phoneNormalised, input.phoneNormalised),
            ),
          )
          .limit(1);
        existing = (row as ContactRow) ?? null;
      }

      if (existing) {
        const now = new Date();
        // Idempotent merge: first-win for PII fields, last-write for
        // mutable preferences. attributes shallow-merge so callers can add
        // structured signals over time without clobbering prior keys.
        const mergedAttributes = {
          ...existing.attributes,
          ...(input.attributes ?? {}),
        };
        const [updated] = await db
          .update(contacts)
          .set({
            displayName: existing.displayName ?? input.displayName ?? null,
            emailNormalised:
              existing.emailNormalised ?? input.emailNormalised ?? null,
            phoneNormalised:
              existing.phoneNormalised ?? input.phoneNormalised ?? null,
            preferredContactMethod:
              input.preferredContactMethod ?? existing.preferredContactMethod,
            attributes: mergedAttributes,
            consentState: input.consentState ?? existing.consentState,
            privacyNoticeVersion:
              input.privacyNoticeVersion ?? existing.privacyNoticeVersion,
            lastSeenAt: now,
            updatedAt: now,
          })
          .where(
            and(eq(contacts.tenantId, tenantId), eq(contacts.id, existing.id)),
          )
          .returning();
        return { contact: updated as ContactRow, created: false };
      }

      const [inserted] = await db
        .insert(contacts)
        .values({
          tenantId,
          displayName: input.displayName ?? null,
          emailNormalised: input.emailNormalised ?? null,
          phoneNormalised: input.phoneNormalised ?? null,
          preferredContactMethod: input.preferredContactMethod ?? null,
          attributes: input.attributes ?? {},
          consentState: input.consentState ?? null,
          privacyNoticeVersion: input.privacyNoticeVersion ?? null,
        })
        .returning();
      return { contact: inserted as ContactRow, created: true };
    },

    async findContactById(tenantId, contactId) {
      const [row] = await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.tenantId, tenantId), eq(contacts.id, contactId)))
        .limit(1);
      return (row as ContactRow) ?? null;
    },

    async listContactsByTenant(tenantId, filters) {
      const where: SQL[] = [sql`base.tenant_id = ${tenantId}`];
      const q = filters.q?.trim();
      if (q) {
        const like = `%${q}%`;
        where.push(sql`(
          base.display_name ILIKE ${like}
          OR base.email_normalised ILIKE ${like}
          OR base.phone_normalised ILIKE ${like}
          OR base.company ILIKE ${like}
          OR base.location ILIKE ${like}
        )`);
      }
      if (filters.persona) {
        where.push(sql`base.persona = ${filters.persona}`);
      }
      if (filters.caseType) {
        where.push(sql`base.related_case_type = ${filters.caseType}`);
      }
      if (filters.caseStatus) {
        where.push(sql`base.open_case_status = ${filters.caseStatus}`);
      }
      if (filters.from) {
        where.push(sql`base.last_seen_at >= ${filters.from}`);
      }
      if (filters.to) {
        where.push(sql`base.last_seen_at <= ${filters.to}`);
      }

      const page = Math.max(1, filters.page ?? 1);
      const limit = 50;
      const offset = (page - 1) * limit;
      const sort = filters.sort ?? "last-seen-desc";
      const orderBy =
        sort === "name-asc"
          ? sql`LOWER(COALESCE(filtered.display_name, '')) ASC, filtered.last_seen_at DESC`
          : sort === "name-desc"
            ? sql`LOWER(COALESCE(filtered.display_name, '')) DESC, filtered.last_seen_at DESC`
            : sort === "last-seen-asc"
              ? sql`filtered.last_seen_at ASC, LOWER(COALESCE(filtered.display_name, '')) ASC`
              : sql`filtered.last_seen_at DESC, LOWER(COALESCE(filtered.display_name, '')) ASC`;

      const result = await db.execute(sql`
        WITH latest_open_cases AS (
          SELECT DISTINCT ON (${followUpCases.contactId})
                 ${followUpCases.contactId} AS contact_id,
                 ${followUpCases.caseType} AS case_type,
                 ${followUpCases.status} AS status
            FROM ${followUpCases}
           WHERE ${followUpCases.tenantId} = ${tenantId}
             AND ${followUpCases.contactId} IS NOT NULL
             AND ${followUpCases.status} IN ('open', 'in_progress', 'waiting_on_customer')
           ORDER BY ${followUpCases.contactId}, ${followUpCases.updatedAt} DESC, ${followUpCases.createdAt} DESC
        ),
        base AS (
          SELECT ${contacts.id} AS "id",
                 ${contacts.tenantId} AS "tenant_id",
                 ${contacts.displayName} AS "display_name",
                 ${contacts.emailNormalised} AS "email_normalised",
                 ${contacts.phoneNormalised} AS "phone_normalised",
                 ${contacts.preferredContactMethod} AS "preferred_contact_method",
                 ${contacts.attributes} AS "attributes",
                 ${contacts.consentState} AS "consent_state",
                 ${contacts.privacyNoticeVersion} AS "privacy_notice_version",
                 ${contacts.firstSeenAt} AS "first_seen_at",
                 ${contacts.lastSeenAt} AS "last_seen_at",
                 ${contacts.createdAt} AS "created_at",
                 ${contacts.updatedAt} AS "updated_at",
                 ${contacts.attributes}->>'company' AS "company",
                 ${contacts.attributes}->>'location' AS "location",
                 ${contacts.attributes}->>'persona' AS "persona",
                 COALESCE(
                   ${contacts.attributes}->>'service_or_product',
                   ${contacts.attributes}->>'service',
                   ${contacts.attributes}->>'product'
                 ) AS "service_or_product",
                 latest_open_cases.case_type AS "related_case_type",
                 latest_open_cases.status AS "open_case_status"
            FROM ${contacts}
            LEFT JOIN latest_open_cases
              ON latest_open_cases.contact_id = ${contacts.id}
           WHERE ${contacts.tenantId} = ${tenantId}
        ),
        filtered AS (
          SELECT *
            FROM base
           WHERE ${and(...where)}
        ),
        counted AS (
          SELECT COUNT(*)::int AS total_count
            FROM filtered
        ),
        paged AS (
          SELECT *
            FROM filtered
           ORDER BY ${orderBy}
           LIMIT ${limit}
          OFFSET ${offset}
        )
        SELECT counted.total_count, paged.*
          FROM counted
          LEFT JOIN paged ON true
      `);

      const raw =
        (result as unknown as { rows?: Record<string, unknown>[] }).rows ??
        (result as unknown as Record<string, unknown>[]);
      const totalCount = Number(raw[0]?.total_count ?? 0);
      const rows = raw
        .filter((row) => row.id)
        .map((row) => ({
          id: String(row.id),
          tenantId: String(row.tenant_id),
          displayName: (row.display_name as string | null) ?? null,
          emailNormalised: (row.email_normalised as string | null) ?? null,
          phoneNormalised: (row.phone_normalised as string | null) ?? null,
          preferredContactMethod:
            (row.preferred_contact_method as string | null) ?? null,
          attributes: (row.attributes as Record<string, unknown> | null) ?? {},
          consentState: (row.consent_state as string | null) ?? null,
          privacyNoticeVersion:
            (row.privacy_notice_version as string | null) ?? null,
          firstSeenAt: new Date(String(row.first_seen_at)),
          lastSeenAt: new Date(String(row.last_seen_at)),
          createdAt: new Date(String(row.created_at)),
          updatedAt: new Date(String(row.updated_at)),
          company: (row.company as string | null) ?? null,
          location: (row.location as string | null) ?? null,
          persona: (row.persona as string | null) ?? null,
          serviceOrProduct: (row.service_or_product as string | null) ?? null,
          relatedCaseType: (row.related_case_type as string | null) ?? null,
          openCaseStatus: (row.open_case_status as string | null) ?? null,
        }));

      return { rows, totalCount };
    },

    async getContactDetailById(tenantId, contactId) {
      const result = await db.execute(sql`
        WITH base_contact AS (
          SELECT ${contacts.id} AS "id",
                 ${contacts.tenantId} AS "tenant_id",
                 ${contacts.displayName} AS "display_name",
                 ${contacts.emailNormalised} AS "email_normalised",
                 ${contacts.phoneNormalised} AS "phone_normalised",
                 ${contacts.preferredContactMethod} AS "preferred_contact_method",
                 ${contacts.attributes} AS "attributes",
                 ${contacts.consentState} AS "consent_state",
                 ${contacts.privacyNoticeVersion} AS "privacy_notice_version",
                 ${contacts.firstSeenAt} AS "first_seen_at",
                 ${contacts.lastSeenAt} AS "last_seen_at",
                 ${contacts.createdAt} AS "created_at",
                 ${contacts.updatedAt} AS "updated_at"
            FROM ${contacts}
           WHERE ${contacts.tenantId} = ${tenantId}
             AND ${contacts.id} = ${contactId}
           LIMIT 1
        ),
        contact_cases AS (
          SELECT ${followUpCases.id},
                 ${followUpCases.tenantId},
                 ${followUpCases.conversationId},
                 ${followUpCases.contactId},
                 ${followUpCases.caseType},
                 ${followUpCases.status},
                 ${followUpCases.priority},
                 ${followUpCases.title},
                 ${followUpCases.summary},
                 ${followUpCases.reason},
                 ${followUpCases.createdAt},
                 ${followUpCases.updatedAt},
                 ${followUpCases.resolvedAt}
            FROM ${followUpCases}
           WHERE ${followUpCases.tenantId} = ${tenantId}
             AND ${followUpCases.contactId} = ${contactId}
        ),
        latest_case_by_conversation AS (
          SELECT DISTINCT ON (${followUpCases.conversationId})
                 ${followUpCases.conversationId} AS conversation_id,
                 ${followUpCases.id} AS case_id,
                 ${followUpCases.caseType} AS case_type,
                 ${followUpCases.status} AS case_status
            FROM ${followUpCases}
           WHERE ${followUpCases.tenantId} = ${tenantId}
             AND ${followUpCases.contactId} = ${contactId}
           ORDER BY ${followUpCases.conversationId},
                    ${followUpCases.updatedAt} DESC,
                    ${followUpCases.createdAt} DESC
        ),
        latest_connector_by_type AS (
          SELECT DISTINCT ON (${connectorOutbox.connectorType})
                 ${connectorOutbox.connectorType},
                 ${connectorOutbox.status},
                 ${connectorOutbox.destinationId},
                 ${connectorOutbox.caseId},
                 ${connectorOutbox.attemptCount},
                 ${connectorOutbox.lastError},
                 ${connectorOutbox.createdAt},
                 ${connectorOutbox.deliveredAt}
            FROM ${connectorOutbox}
            INNER JOIN contact_cases
              ON contact_cases.id = ${connectorOutbox.caseId}
           WHERE ${connectorOutbox.tenantId} = ${tenantId}
           ORDER BY ${connectorOutbox.connectorType},
                    ${connectorOutbox.createdAt} DESC
        )
        SELECT base_contact.*,
               COALESCE((
                 SELECT json_agg(json_build_object(
                   'id', ${contactIdentifiers.id},
                   'tenantId', ${contactIdentifiers.tenantId},
                   'contactId', ${contactIdentifiers.contactId},
                   'type', ${contactIdentifiers.type},
                   'valueNormalised', ${contactIdentifiers.valueNormalised},
                   'verifiedAt', ${contactIdentifiers.verifiedAt},
                   'source', ${contactIdentifiers.source},
                   'createdAt', ${contactIdentifiers.createdAt}
                 ) ORDER BY ${contactIdentifiers.createdAt} ASC)
                   FROM ${contactIdentifiers}
                  WHERE ${contactIdentifiers.tenantId} = ${tenantId}
                    AND ${contactIdentifiers.contactId} = base_contact.id
               ), '[]'::json) AS "identifiers_json",
               COALESCE((
                 SELECT json_agg(json_build_object(
                   'id', ${conversations.id},
                   'status', ${conversations.status},
                   'visitorId', ${conversations.visitorId},
                   'messageCount', ${conversations.messageCount},
                   'startedAt', ${conversations.startedAt},
                   'completedAt', ${conversations.completedAt},
                   'createdAt', ${conversations.createdAt},
                   'relationship', ${conversationContacts.relationship},
                   'linkedAt', ${conversationContacts.createdAt},
                   'caseId', latest_case_by_conversation.case_id,
                   'caseType', latest_case_by_conversation.case_type,
                   'caseStatus', latest_case_by_conversation.case_status
                 ) ORDER BY ${conversations.startedAt} DESC, ${conversationContacts.createdAt} DESC)
                   FROM ${conversationContacts}
                   INNER JOIN ${conversations}
                     ON ${conversations.id} = ${conversationContacts.conversationId}
                    AND ${conversations.tenantId} = ${tenantId}
                   LEFT JOIN latest_case_by_conversation
                     ON latest_case_by_conversation.conversation_id = ${conversationContacts.conversationId}
                  WHERE ${conversationContacts.tenantId} = ${tenantId}
                    AND ${conversationContacts.contactId} = base_contact.id
               ), '[]'::json) AS "conversations_json",
               COALESCE((
                 SELECT json_agg(json_build_object(
                   'id', contact_cases.id,
                   'tenantId', contact_cases.tenant_id,
                   'conversationId', contact_cases.conversation_id,
                   'contactId', contact_cases.contact_id,
                   'caseType', contact_cases.case_type,
                   'status', contact_cases.status,
                   'priority', contact_cases.priority,
                   'title', contact_cases.title,
                   'summary', contact_cases.summary,
                   'reason', contact_cases.reason,
                   'createdAt', contact_cases.created_at,
                   'updatedAt', contact_cases.updated_at,
                   'resolvedAt', contact_cases.resolved_at
                 ) ORDER BY contact_cases.updated_at DESC, contact_cases.created_at DESC)
                   FROM contact_cases
               ), '[]'::json) AS "cases_json",
               COALESCE((
                 SELECT json_agg(json_build_object(
                   'connectorType', latest_connector_by_type.connector_type,
                   'status', latest_connector_by_type.status,
                   'destinationId', latest_connector_by_type.destination_id,
                   'caseId', latest_connector_by_type.case_id,
                   'attemptCount', latest_connector_by_type.attempt_count,
                   'lastError', latest_connector_by_type.last_error,
                   'createdAt', latest_connector_by_type.created_at,
                   'deliveredAt', latest_connector_by_type.delivered_at
                 ) ORDER BY latest_connector_by_type.connector_type ASC)
                   FROM latest_connector_by_type
               ), '[]'::json) AS "connectors_json",
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
                   INNER JOIN contact_cases
                     ON contact_cases.id = ${followUpEvents.caseId}
                  WHERE ${followUpEvents.tenantId} = ${tenantId}
               ), '[]'::json) AS "events_json"
          FROM base_contact
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

      return {
        contact: {
          id: String(row.id),
          tenantId: String(row.tenant_id),
          displayName: (row.display_name as string | null) ?? null,
          emailNormalised: (row.email_normalised as string | null) ?? null,
          phoneNormalised: (row.phone_normalised as string | null) ?? null,
          preferredContactMethod:
            (row.preferred_contact_method as string | null) ?? null,
          attributes: asRecord(row.attributes),
          consentState: (row.consent_state as string | null) ?? null,
          privacyNoticeVersion:
            (row.privacy_notice_version as string | null) ?? null,
          firstSeenAt: new Date(String(row.first_seen_at)),
          lastSeenAt: new Date(String(row.last_seen_at)),
          createdAt: new Date(String(row.created_at)),
          updatedAt: new Date(String(row.updated_at)),
        },
        identifiers: parseJsonArray<Record<string, unknown>>(
          row.identifiers_json,
        ).map((identifier) => ({
          id: String(identifier.id),
          tenantId: String(identifier.tenantId),
          contactId: String(identifier.contactId),
          type: String(identifier.type),
          valueNormalised: String(identifier.valueNormalised),
          verifiedAt: identifier.verifiedAt
            ? new Date(String(identifier.verifiedAt))
            : null,
          source: (identifier.source as string | null) ?? null,
          createdAt: new Date(String(identifier.createdAt)),
        })),
        conversations: parseJsonArray<Record<string, unknown>>(
          row.conversations_json,
        ).map((conversation) => ({
          id: String(conversation.id),
          status: String(conversation.status),
          visitorId: (conversation.visitorId as string | null) ?? null,
          messageCount: Number(conversation.messageCount ?? 0),
          startedAt: new Date(String(conversation.startedAt)),
          completedAt: conversation.completedAt
            ? new Date(String(conversation.completedAt))
            : null,
          createdAt: new Date(String(conversation.createdAt)),
          relationship: String(conversation.relationship),
          linkedAt: new Date(String(conversation.linkedAt)),
          caseId: (conversation.caseId as string | null) ?? null,
          caseType: (conversation.caseType as string | null) ?? null,
          caseStatus: (conversation.caseStatus as string | null) ?? null,
        })),
        cases: parseJsonArray<Record<string, unknown>>(row.cases_json).map(
          (caseRow) => ({
            id: String(caseRow.id),
            tenantId: String(caseRow.tenantId),
            conversationId: String(caseRow.conversationId),
            contactId: (caseRow.contactId as string | null) ?? null,
            caseType: String(caseRow.caseType),
            status: String(caseRow.status),
            priority: (caseRow.priority as string | null) ?? null,
            title: (caseRow.title as string | null) ?? null,
            summary: (caseRow.summary as string | null) ?? null,
            reason: (caseRow.reason as string | null) ?? null,
            createdAt: new Date(String(caseRow.createdAt)),
            updatedAt: new Date(String(caseRow.updatedAt)),
            resolvedAt: caseRow.resolvedAt
              ? new Date(String(caseRow.resolvedAt))
              : null,
          }),
        ),
        connectors: parseJsonArray<Record<string, unknown>>(
          row.connectors_json,
        ).map((connector) => ({
          connectorType: String(connector.connectorType),
          status: String(connector.status),
          destinationId: (connector.destinationId as string | null) ?? null,
          caseId: String(connector.caseId),
          attemptCount: Number(connector.attemptCount ?? 0),
          lastError: (connector.lastError as string | null) ?? null,
          createdAt: new Date(String(connector.createdAt)),
          deliveredAt: connector.deliveredAt
            ? new Date(String(connector.deliveredAt))
            : null,
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
          }),
        ),
      };
    },

    async findLatestCaseForContact(tenantId, contactId) {
      const [row] = await db
        .select()
        .from(followUpCases)
        .where(
          and(
            eq(followUpCases.tenantId, tenantId),
            eq(followUpCases.contactId, contactId),
          ),
        )
        .orderBy(sql`${followUpCases.updatedAt} DESC`, sql`${followUpCases.createdAt} DESC`)
        .limit(1);
      return row ? (row as ContactCaseHistoryRow) : null;
    },

    async linkContactToConversation(tenantId, input) {
      // Composite PK (conversation_id, contact_id) — upsert as no-op so the
      // helper is idempotent. Always re-asserts tenantId in the WHERE so a
      // cross-tenant collision (defensive: not possible because the PK is
      // global) cannot mutate a link in another tenant's scope.
      const [row] = await db
        .insert(conversationContacts)
        .values({
          tenantId,
          conversationId: input.conversationId,
          contactId: input.contactId,
          relationship: input.relationship,
        })
        .onConflictDoUpdate({
          target: [
            conversationContacts.conversationId,
            conversationContacts.contactId,
          ],
          set: { relationship: input.relationship },
          setWhere: eq(conversationContacts.tenantId, tenantId),
        })
        .returning();
      return row as ConversationContactLinkRow;
    },
  };
}

// ---------------------------------------------------------------------------
// Default singleton
// ---------------------------------------------------------------------------

let defaultStore: ContactsStore | null = null;

export function getDefaultContactsStore(): ContactsStore {
  if (!defaultStore) {
    defaultStore = createDrizzleContactsStore();
  }
  return defaultStore;
}

export function setDefaultContactsStoreForTests(store: ContactsStore): void {
  defaultStore = store;
}

export function resetDefaultContactsStore(): void {
  defaultStore = null;
}
