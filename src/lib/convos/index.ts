import { and, desc, eq, sql, type SQL } from "drizzle-orm";

import { db as defaultDb } from "@/lib/db";
import {
  blogPosts,
  contacts,
  conversations,
  followUpCaseAttributes,
  followUpCases,
  followUpEvents,
  messages,
  users,
} from "@/lib/db/schema";
import { addCaseNote, type CaseStatus } from "@/lib/cases";
import type { CaseHelperOptions } from "@/lib/cases";

export interface ListConvosFilters {
  limit: number;
  offset: number;
  status?: "active" | "completed" | "archived";
  followUpRequired?: boolean;
  followUpStatus?: CaseStatus;
  persona?: string;
  sort: "lastActivityAt" | "startedAt" | "title";
  direction: "asc" | "desc";
}

export interface ConvoListItem {
  id: string;
  tenantId: string;
  title: string | null;
  topic: string | null;
  persona: string | null;
  status: "active" | "completed" | "archived";
  blogStatus: string | null;
  followUpRequired: boolean;
  followUpType: string | null;
  followUpStatus: CaseStatus | null;
  assignedOwnerId: string | null;
  assignedOwnerName: string | null;
  startedAt: Date;
  lastActivityAt: Date;
  messageCount: number;
}

export interface ConvoMessage {
  id: string;
  role: string;
  content: string;
  createdAt: Date;
}

export interface ConvoNote {
  id: string;
  bodyHtml: string;
  actorId: string | null;
  createdAt: Date;
}

export interface ConvoActivity {
  id: string;
  eventType: string;
  actorType: string;
  actorId: string | null;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export interface ConvoDetail {
  convo: ConvoListItem & {
    visitorId: string | null;
    metadata: Record<string, unknown>;
    completedAt: Date | null;
    summary: string | null;
    summaryGeneratedAt: Date | null;
  };
  transcript: ConvoMessage[];
  tags: Array<{ key: string; value: unknown }>;
  capturedCustomerDetails: {
    id: string;
    displayName: string | null;
    emailNormalised: string | null;
    phoneNormalised: string | null;
    preferredContactMethod: string | null;
    attributes: Record<string, unknown>;
  } | null;
  internalNotes: ConvoNote[];
  activityHistory: ConvoActivity[];
  linkedBlogArticle: {
    id: string;
    title: string;
    slug: string;
    status: string;
    publishedAt: Date | null;
  } | null;
}

export interface ConvosStore {
  listConvos(
    tenantId: string,
    filters: ListConvosFilters
  ): Promise<{ items: ConvoListItem[]; nextOffset: number | null }>;
  getConvoDetail(tenantId: string, convoId: string): Promise<ConvoDetail | null>;
  updateConvo(
    tenantId: string,
    convoId: string,
    patch: {
      followUpStatus?: CaseStatus;
      assignedOwnerId?: string | null;
    }
  ): Promise<ConvoListItem | null>;
  appendNote(
    tenantId: string,
    convoId: string,
    bodyHtml: string,
    actorId: string
  ): Promise<ConvoNote | null>;
}

type DrizzleDb = typeof defaultDb;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function dateFrom(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value));
}

function deriveTitle(row: {
  title: string | null;
  metadata: Record<string, unknown>;
  visitorId: string | null;
}): string | null {
  if (row.title) return row.title;
  const metadataTitle = row.metadata.title ?? row.metadata.pageTitle;
  if (typeof metadataTitle === "string" && metadataTitle.trim()) {
    return metadataTitle.trim();
  }
  return row.visitorId ? `Visitor ${row.visitorId}` : null;
}

function deriveTopic(row: {
  topic: string | null;
  metadata: Record<string, unknown>;
}): string | null {
  if (row.topic) return row.topic;
  const metadataTopic = row.metadata.topic ?? row.metadata.primaryTopic;
  return typeof metadataTopic === "string" && metadataTopic.trim()
    ? metadataTopic.trim()
    : null;
}

function derivePersona(row: {
  persona: string | null;
  metadata: Record<string, unknown>;
}): string | null {
  if (row.persona) return row.persona;
  const qualifying = asRecord(row.metadata.qualifying);
  const persona = asRecord(qualifying.persona);
  const candidate = persona.persona ?? persona.role ?? row.metadata.persona;
  return typeof candidate === "string" && candidate.trim()
    ? candidate.trim()
    : null;
}

function mapListRow(row: Record<string, unknown>): ConvoListItem {
  const metadata = asRecord(row.metadata);
  const base = {
    title: (row.title as string | null) ?? null,
    topic: (row.topic as string | null) ?? null,
    persona: (row.persona as string | null) ?? null,
    metadata,
    visitorId: (row.visitor_id as string | null) ?? null,
  };
  const caseStatus = (row.follow_up_status as CaseStatus | null) ?? null;
  const needsFollowup = row.needs_followup === true;
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    title: deriveTitle(base),
    topic: deriveTopic(base),
    persona: derivePersona(base),
    status: row.status as "active" | "completed" | "archived",
    blogStatus: (row.blog_status as string | null) ?? null,
    followUpRequired:
      needsFollowup ||
      (caseStatus !== null &&
        caseStatus !== "resolved" &&
        caseStatus !== "dismissed"),
    followUpType:
      (row.follow_up_type as string | null) ??
      (row.case_type as string | null) ??
      null,
    followUpStatus: caseStatus,
    assignedOwnerId: (row.assigned_to as string | null) ?? null,
    assignedOwnerName: (row.assigned_owner_name as string | null) ?? null,
    startedAt: dateFrom(row.started_at),
    lastActivityAt: dateFrom(row.last_activity_at),
    messageCount: Number(row.message_count ?? 0),
  };
}

function payloadToBodyHtml(payload: Record<string, unknown>): string {
  const value = payload.body_html ?? payload.bodyHtml ?? payload.note;
  return typeof value === "string" ? value : "";
}

function mapEventRow(row: Record<string, unknown>): ConvoActivity {
  return {
    id: String(row.id),
    eventType: String(row.event_type),
    actorType: String(row.actor_type),
    actorId: (row.actor_id as string | null) ?? null,
    payload: asRecord(row.payload),
    createdAt: dateFrom(row.created_at),
  };
}

export function createDrizzleConvosStore(db: DrizzleDb = defaultDb): ConvosStore {
  async function fetchListItem(
    tenantId: string,
    convoId: string
  ): Promise<ConvoListItem | null> {
    const result = await db.execute(sql`
      SELECT c."id",
             c."tenant_id",
             c."visitor_id",
             c."status",
             c."title",
             c."topic",
             c."persona",
             c."metadata",
             c."message_count",
             c."needs_followup",
             c."follow_up_type",
             c."started_at",
             c."last_activity_at",
             f."case_type",
             f."status" AS "follow_up_status",
             f."assigned_to",
             u."name" AS "assigned_owner_name",
             b."status" AS "blog_status"
        FROM ${conversations} c
        LEFT JOIN ${followUpCases} f
          ON f."conversation_id" = c."id"
         AND f."tenant_id" = ${tenantId}
        LEFT JOIN ${users} u
          ON u."id" = f."assigned_to"
        LEFT JOIN LATERAL (
          SELECT ${blogPosts.status} AS "status"
            FROM ${blogPosts}
           WHERE ${blogPosts.tenantId} = ${tenantId}
             AND ${blogPosts.threadId} = c."id"
           ORDER BY ${blogPosts.lastModified} DESC
           LIMIT 1
        ) b ON TRUE
       WHERE c."tenant_id" = ${tenantId}
         AND c."id" = ${convoId}
       LIMIT 1
    `);
    const rows =
      (result as unknown as { rows?: Record<string, unknown>[] }).rows ??
      (result as unknown as Record<string, unknown>[]);
    return rows[0] ? mapListRow(rows[0]) : null;
  }

  return {
    async listConvos(tenantId, filters) {
      const where: SQL[] = [sql`c."tenant_id" = ${tenantId}`];
      if (filters.status) where.push(sql`c."status" = ${filters.status}`);
      if (filters.followUpStatus) {
        where.push(sql`f."status" = ${filters.followUpStatus}`);
      }
      if (filters.followUpRequired !== undefined) {
        if (filters.followUpRequired) {
          where.push(sql`(c."needs_followup" = TRUE OR f."status" NOT IN ('resolved', 'dismissed'))`);
        } else {
          where.push(sql`(COALESCE(c."needs_followup", FALSE) = FALSE AND (f."status" IS NULL OR f."status" IN ('resolved', 'dismissed')))`);
        }
      }
      if (filters.persona) {
        where.push(sql`COALESCE(c."persona", fa."persona") = ${filters.persona}`);
      }

      const orderColumn =
        filters.sort === "startedAt"
          ? sql`c."started_at"`
          : filters.sort === "title"
            ? sql`c."title"`
            : sql`c."last_activity_at"`;
      const orderDirection =
        filters.direction === "asc" ? sql`ASC NULLS LAST` : sql`DESC NULLS LAST`;

      const result = await db.execute(sql`
        SELECT c."id",
               c."tenant_id",
               c."visitor_id",
               c."status",
               c."title",
               COALESCE(c."topic", fa."topic") AS "topic",
               COALESCE(c."persona", fa."persona") AS "persona",
               c."metadata",
               c."message_count",
               c."needs_followup",
               c."follow_up_type",
               c."started_at",
               c."last_activity_at",
               f."case_type",
               f."status" AS "follow_up_status",
               f."assigned_to",
               u."name" AS "assigned_owner_name",
               latest_blog."status" AS "blog_status"
          FROM "conversations" c
          LEFT JOIN "follow_up_cases" f
            ON f."conversation_id" = c."id"
           AND f."tenant_id" = ${tenantId}
          LEFT JOIN "users" u
            ON u."id" = f."assigned_to"
          LEFT JOIN LATERAL (
            SELECT bp."status"
              FROM "blog_posts" bp
             WHERE bp."tenant_id" = ${tenantId}
               AND bp."thread_id" = c."id"
             ORDER BY bp."last_modified" DESC
             LIMIT 1
          ) latest_blog ON TRUE
          LEFT JOIN LATERAL (
            SELECT
              MAX(a."value"->>'value') FILTER (WHERE a."key" = 'persona') AS "persona",
              MAX(a."value"->>'value') FILTER (WHERE a."key" = 'topic') AS "topic"
              FROM "follow_up_case_attributes" a
             WHERE a."tenant_id" = ${tenantId}
               AND a."case_id" = f."id"
          ) fa ON TRUE
         WHERE ${and(...where)}
         ORDER BY ${orderColumn} ${orderDirection}, c."started_at" DESC
         LIMIT ${filters.limit + 1}
        OFFSET ${filters.offset}
      `);
      const rows =
        (result as unknown as { rows?: Record<string, unknown>[] }).rows ??
        (result as unknown as Record<string, unknown>[]);
      const mapped = rows.map((row) => mapListRow(row));
      return {
        items: mapped.slice(0, filters.limit),
        nextOffset:
          mapped.length > filters.limit
            ? filters.offset + filters.limit
            : null,
      };
    },

    async getConvoDetail(tenantId, convoId) {
      const item = await fetchListItem(tenantId, convoId);
      if (!item) return null;

      const [conversationRow] = await db
        .select()
        .from(conversations)
        .where(
          and(eq(conversations.tenantId, tenantId), eq(conversations.id, convoId))
        )
        .limit(1);
      if (!conversationRow) return null;

      const [caseRow] = await db
        .select()
        .from(followUpCases)
        .where(
          and(
            eq(followUpCases.tenantId, tenantId),
            eq(followUpCases.conversationId, convoId)
          )
        )
        .limit(1);

      const [messageRows, attrRows, eventRows, blogRows, contactRows] =
        await Promise.all([
          db
            .select({
              id: messages.id,
              role: messages.role,
              content: messages.content,
              createdAt: messages.createdAt,
            })
            .from(messages)
            .where(eq(messages.conversationId, convoId))
            .orderBy(messages.createdAt),
          caseRow
            ? db
                .select()
                .from(followUpCaseAttributes)
                .where(
                  and(
                    eq(followUpCaseAttributes.tenantId, tenantId),
                    eq(followUpCaseAttributes.caseId, caseRow.id)
                  )
                )
            : Promise.resolve([]),
          db
            .select()
            .from(followUpEvents)
            .where(
              and(
                eq(followUpEvents.tenantId, tenantId),
                eq(followUpEvents.conversationId, convoId)
              )
            )
            .orderBy(desc(followUpEvents.createdAt)),
          db
            .select({
              id: blogPosts.id,
              title: blogPosts.title,
              slug: blogPosts.slug,
              status: blogPosts.status,
              publishedAt: blogPosts.publishedAt,
            })
            .from(blogPosts)
            .where(
              and(eq(blogPosts.tenantId, tenantId), eq(blogPosts.threadId, convoId))
            )
            .orderBy(desc(blogPosts.lastModified))
            .limit(1),
          caseRow?.contactId
            ? db
                .select({
                  id: contacts.id,
                  displayName: contacts.displayName,
                  emailNormalised: contacts.emailNormalised,
                  phoneNormalised: contacts.phoneNormalised,
                  preferredContactMethod: contacts.preferredContactMethod,
                  attributes: contacts.attributes,
                })
                .from(contacts)
                .where(
                  and(
                    eq(contacts.tenantId, tenantId),
                    eq(contacts.id, caseRow.contactId)
                  )
                )
                .limit(1)
            : Promise.resolve([]),
        ]);

      const tags = attrRows.map((attribute) => ({
        key: attribute.key,
        value: attribute.value,
      }));
      const events = eventRows.map((event) =>
        mapEventRow({
          id: event.id,
          event_type: event.eventType,
          actor_type: event.actorType,
          actor_id: event.actorId,
          payload: event.payload,
          created_at: event.createdAt,
        })
      );

      return {
        convo: {
          ...item,
          visitorId: conversationRow.visitorId,
          metadata: asRecord(conversationRow.metadata),
          completedAt: conversationRow.completedAt,
          summary: conversationRow.aiSummary,
          summaryGeneratedAt: conversationRow.summaryGeneratedAt,
        },
        transcript: messageRows.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          createdAt: message.createdAt,
        })),
        tags,
        capturedCustomerDetails: contactRows[0]
          ? {
              id: contactRows[0].id,
              displayName: contactRows[0].displayName,
              emailNormalised: contactRows[0].emailNormalised,
              phoneNormalised: contactRows[0].phoneNormalised,
              preferredContactMethod: contactRows[0].preferredContactMethod,
              attributes: asRecord(contactRows[0].attributes),
            }
          : null,
        internalNotes: events
          .filter((event) => event.eventType === "note_added")
          .map((event) => ({
            id: event.id,
            bodyHtml: payloadToBodyHtml(event.payload),
            actorId: event.actorId,
            createdAt: event.createdAt,
          })),
        activityHistory: events,
        linkedBlogArticle: blogRows[0]
          ? {
              id: blogRows[0].id,
              title: blogRows[0].title,
              slug: blogRows[0].slug,
              status: blogRows[0].status,
              publishedAt: blogRows[0].publishedAt,
            }
          : null,
      };
    },

    async updateConvo(tenantId, convoId, patch) {
      const [caseRow] = await db
        .select()
        .from(followUpCases)
        .where(
          and(
            eq(followUpCases.tenantId, tenantId),
            eq(followUpCases.conversationId, convoId)
          )
        )
        .limit(1);

      if (!caseRow) {
        if (
          patch.followUpStatus !== undefined ||
          patch.assignedOwnerId !== undefined
        ) {
          return null;
        }
        const [conversationRow] = await db
          .select({ id: conversations.id })
          .from(conversations)
          .where(
            and(eq(conversations.tenantId, tenantId), eq(conversations.id, convoId))
          )
          .limit(1);
        return conversationRow ? fetchListItem(tenantId, convoId) : null;
      }

      const update: Partial<typeof followUpCases.$inferInsert> = {};
      if (patch.followUpStatus !== undefined) {
        update.status = patch.followUpStatus;
        update.resolvedAt =
          patch.followUpStatus === "resolved" ? new Date() : null;
      }
      if (patch.assignedOwnerId !== undefined) {
        update.assignedTo = patch.assignedOwnerId;
      }
      if (Object.keys(update).length > 0) {
        await db
          .update(followUpCases)
          .set({ ...update, updatedAt: new Date() })
          .where(
            and(eq(followUpCases.tenantId, tenantId), eq(followUpCases.id, caseRow.id))
          );
      }

      return fetchListItem(tenantId, convoId);
    },

    async appendNote(tenantId, convoId, bodyHtml, actorId) {
      const [caseRow] = await db
        .select()
        .from(followUpCases)
        .where(
          and(
            eq(followUpCases.tenantId, tenantId),
            eq(followUpCases.conversationId, convoId)
          )
        )
        .limit(1);
      if (!caseRow) return null;

      const event = await addCaseNote(tenantId, caseRow.id, bodyHtml, actorId);
      if (!event) return null;
      return {
        id: event.id,
        bodyHtml: payloadToBodyHtml(asRecord(event.payload)),
        actorId: event.actorId,
        createdAt: event.createdAt,
      };
    },
  };
}

let defaultStore: ConvosStore | null = null;

export function getDefaultConvosStore(): ConvosStore {
  if (!defaultStore) defaultStore = createDrizzleConvosStore();
  return defaultStore;
}

export function setDefaultConvosStoreForTests(store: ConvosStore): void {
  defaultStore = store;
}

export function resetDefaultConvosStore(): void {
  defaultStore = null;
}

export async function appendConvoNote(
  tenantId: string,
  convoId: string,
  bodyHtml: string,
  actorId: string,
  opts?: CaseHelperOptions & { store?: ConvosStore }
): Promise<ConvoNote | null> {
  return (opts?.store ?? getDefaultConvosStore()).appendNote(
    tenantId,
    convoId,
    bodyHtml,
    actorId
  );
}
