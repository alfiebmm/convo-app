import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
  varchar,
  real,
  primaryKey,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { AdapterAccountType } from "next-auth/adapters";

// ============================================================
// ENUMS
// ============================================================

export const planEnum = pgEnum("plan", ["starter", "growth", "scale"]);

export const contentStatusEnum = pgEnum("content_status", [
  "pending", // extracted, waiting for generation
  "generating", // LLM is producing the article
  "review", // in dashboard queue for human review
  "approved", // human approved, ready to publish
  "published", // pushed to CMS / hosted page
  "rejected", // human rejected
  "archived", // soft-deleted
]);

export const conversationStatusEnum = pgEnum("conversation_status", [
  "active",
  "completed",
  "archived",
]);

export const memberRoleEnum = pgEnum("member_role", [
  "owner",
  "admin",
  "editor",
  "viewer",
]);

export const tenantStatusEnum = pgEnum("tenant_status", [
  "active",
  "suspended",
  "deleted_soft",
]);

export const knowledgeItemTypeEnum = pgEnum("knowledge_item_type", [
  "page",
  "file",
]);

export const knowledgeItemStatusEnum = pgEnum("knowledge_item_status", [
  "pending",
  "processing",
  "indexed",
  "failed",
]);

export const knowledgeFileStatusEnum = pgEnum("knowledge_file_status", [
  "pending",
  "processing",
  "indexed",
  "failed",
]);

export const followUpCaseStatusEnum = pgEnum("follow_up_case_status", [
  "open",
  "in_progress",
  "waiting_on_customer",
  "resolved",
  "dismissed",
]);

export const connectorOutboxStatusEnum = pgEnum("connector_outbox_status", [
  "pending",
  "sent",
  "failed",
  "abandoned",
]);

// ============================================================
// TENANTS (organisations / sites)
// ============================================================

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 63 }).notNull().unique(),
  domain: varchar("domain", { length: 255 }), // the client website domain
  plan: planEnum("plan").default("starter").notNull(),
  status: tenantStatusEnum("status").default("active").notNull(),
  settings: jsonb("settings").default({}).notNull(), // widget config, persona, guardrails, CMS creds
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  suspendedBy: uuid("suspended_by").references(() => users.id, {
    onDelete: "set null",
  }),
  suspendedReason: text("suspended_reason"),
  softDeletedAt: timestamp("soft_deleted_at", { withTimezone: true }),
  softDeletedBy: uuid("soft_deleted_by").references(() => users.id, {
    onDelete: "set null",
  }),
  softDeletedReason: text("soft_deleted_reason"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ============================================================
// USERS
// ============================================================

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  externalId: text("external_id").unique(), // Legacy: Clerk/Auth provider ID
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }), // NextAuth adapter field
  name: varchar("name", { length: 255 }),
  image: text("image"), // NextAuth adapter field (avatar URL)
  avatarUrl: text("avatar_url"), // Legacy alias
  // CON-98: Convo-staff gate for the platform-admin injection-events page.
  // Nullable boolean default false — additive, no impact on auth flow.
  isPlatformStaff: boolean("is_platform_staff").default(false),
  totpEnrolledAt: timestamp("totp_enrolled_at", { withTimezone: true }),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ============================================================
// NEXTAUTH TABLES (accounts, sessions, verification tokens)
// ============================================================

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ]
);

export const sessions = pgTable("sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: uuid("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
);

// ============================================================
// TENANT MEMBERS (many-to-many: users ↔ tenants)
// ============================================================

export const tenantMembers = pgTable(
  "tenant_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    role: memberRoleEnum("role").default("viewer").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("tenant_members_unique").on(table.tenantId, table.userId),
  ]
);

// ============================================================
// CONVERSATIONS
// ============================================================

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    visitorId: varchar("visitor_id", { length: 255 }), // anonymous fingerprint / cookie ID
    status: conversationStatusEnum("status").default("active").notNull(),
    metadata: jsonb("metadata").default({}).notNull(), // page URL, referrer, device, etc.
    messageCount: integer("message_count").default(0).notNull(),
    // Human triage flags — independent of conversation lifecycle status.
    // A conversation can be `active` AND `needsFollowup`; resolving clears the flag.
    needsFollowup: boolean("needs_followup").default(false).notNull(),
    // CON-95: classifies the *kind* of follow-up. NULL when no follow-up needed.
    // 'lead' = a Lead was captured (see `metadata.lead`). 'manual' reserved.
    followUpType: varchar("follow_up_type", { length: 20 }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: uuid("resolved_by").references(() => users.id, {
      onDelete: "set null",
    }),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("conversations_tenant_idx").on(table.tenantId),
    index("conversations_status_idx").on(table.tenantId, table.status),
    index("conversations_followup_idx").on(table.tenantId, table.needsFollowup),
  ]
);

// ============================================================
// MESSAGES (individual chat messages within a conversation)
// ============================================================

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .references(() => conversations.id, { onDelete: "cascade" })
      .notNull(),
    role: varchar("role", { length: 20 }).notNull(), // 'user' | 'assistant'
    content: text("content").notNull(),
    tokenCount: integer("token_count"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("messages_conversation_idx").on(table.conversationId),
  ]
);

// ============================================================
// TOPICS (extracted from conversations by the content pipeline)
// ============================================================

export const topics = pgTable(
  "topics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    name: varchar("name", { length: 500 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    description: text("description"),
    frequency: integer("frequency").default(1).notNull(), // how many conversations mentioned this
    embedding: jsonb("embedding"), // vector embedding for dedup (pgvector in prod)
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("topics_tenant_idx").on(table.tenantId),
    uniqueIndex("topics_tenant_slug_unique").on(table.tenantId, table.slug),
  ]
);

// ============================================================
// CONTENT (generated articles / FAQ entries)
// ============================================================

export const content = pgTable(
  "content",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    topicId: uuid("topic_id").references(() => topics.id, {
      onDelete: "set null",
    }),
    conversationId: uuid("conversation_id").references(
      () => conversations.id,
      { onDelete: "set null" }
    ), // source conversation
    status: contentStatusEnum("status").default("pending").notNull(),
    type: varchar("type", { length: 50 }).notNull(), // 'blog' | 'faq' | 'page_section'
    title: varchar("title", { length: 500 }),
    slug: varchar("slug", { length: 255 }),
    metaDescription: text("meta_description"),
    body: text("body"), // markdown or HTML
    seoScore: real("seo_score"), // internal quality score 0-1
    publishedUrl: text("published_url"), // external CMS URL after publishing
    publishedAt: timestamp("published_at", { withTimezone: true }),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("content_tenant_idx").on(table.tenantId),
    index("content_status_idx").on(table.tenantId, table.status),
  ]
);

// ============================================================
// WIDGET SESSIONS (analytics: track widget loads & engagement)
// ============================================================

export const widgetSessions = pgTable(
  "widget_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    visitorId: varchar("visitor_id", { length: 255 }),
    pageUrl: text("page_url"),
    engaged: boolean("engaged").default(false).notNull(), // did they actually chat?
    conversationId: uuid("conversation_id").references(
      () => conversations.id
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("widget_sessions_tenant_idx").on(table.tenantId)]
);

// ============================================================
// CONTACTS (CON-160 / Epic B1)
// ============================================================
//
// Tenant-scoped people/company records created only after the visitor
// supplies configured contact details. Conversations can remain anonymous;
// a Contact is a durable entity that links multiple conversations/cases.

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    displayName: varchar("display_name", { length: 255 }),
    emailNormalised: varchar("email_normalised", { length: 320 }),
    phoneNormalised: varchar("phone_normalised", { length: 64 }),
    preferredContactMethod: varchar("preferred_contact_method", {
      length: 50,
    }),
    attributes: jsonb("attributes").default({}).notNull(),
    consentState: varchar("consent_state", { length: 50 }),
    privacyNoticeVersion: varchar("privacy_notice_version", { length: 100 }),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("contacts_tenant_email_idx").on(table.tenantId, table.emailNormalised),
    index("contacts_tenant_phone_idx").on(table.tenantId, table.phoneNormalised),
    index("contacts_tenant_display_name_idx").on(
      table.tenantId,
      table.displayName
    ),
  ]
);

export const contactIdentifiers = pgTable(
  "contact_identifiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    contactId: uuid("contact_id")
      .references(() => contacts.id, { onDelete: "cascade" })
      .notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    valueNormalised: text("value_normalised").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    source: varchar("source", { length: 50 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("contact_identifiers_tenant_type_value_unique").on(
      table.tenantId,
      table.type,
      table.valueNormalised
    ),
    index("contact_identifiers_contact_idx").on(table.contactId),
    index("contact_identifiers_tenant_contact_idx").on(
      table.tenantId,
      table.contactId
    ),
  ]
);

export const conversationContacts = pgTable(
  "conversation_contacts",
  {
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    conversationId: uuid("conversation_id")
      .references(() => conversations.id, { onDelete: "cascade" })
      .notNull(),
    contactId: uuid("contact_id")
      .references(() => contacts.id, { onDelete: "cascade" })
      .notNull(),
    relationship: varchar("relationship", { length: 50 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.conversationId, table.contactId],
    }),
    index("conversation_contacts_tenant_conversation_idx").on(
      table.tenantId,
      table.conversationId
    ),
    index("conversation_contacts_tenant_contact_idx").on(
      table.tenantId,
      table.contactId
    ),
  ]
);

// ============================================================
// FOLLOW-UP CASES (CON-161 / Epic B2)
// ============================================================
//
// Actionable tenant-scoped operational records created when configured
// follow-up rules fire or when staff manually flag a conversation.
// `contactId` stays nullable by design: a case may exist without captured
// personal details and still appear in the tenant inbox for staff review.

export const followUpCases = pgTable(
  "follow_up_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    conversationId: uuid("conversation_id")
      .references(() => conversations.id, { onDelete: "cascade" })
      .notNull(),
    contactId: uuid("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    caseType: varchar("case_type", { length: 50 }).notNull(),
    status: followUpCaseStatusEnum("status").default("open").notNull(),
    priority: varchar("priority", { length: 20 }),
    routingKey: varchar("routing_key", { length: 100 }),
    title: text("title"),
    summary: text("summary"),
    reason: text("reason"),
    source: varchar("source", { length: 50 }),
    ruleId: varchar("rule_id", { length: 100 }),
    classifierConfidence: real("classifier_confidence"),
    assignedTo: uuid("assigned_to").references(() => users.id, {
      onDelete: "set null",
    }),
    externalSystem: varchar("external_system", { length: 50 }),
    externalId: varchar("external_id", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("follow_up_cases_tenant_conversation_unique").on(
      table.tenantId,
      table.conversationId
    ),
    index("follow_up_cases_tenant_status_idx").on(table.tenantId, table.status),
    index("follow_up_cases_tenant_case_type_idx").on(
      table.tenantId,
      table.caseType
    ),
    index("follow_up_cases_tenant_contact_idx").on(table.tenantId, table.contactId),
    index("follow_up_cases_tenant_assigned_idx").on(
      table.tenantId,
      table.assignedTo
    ),
  ]
);

export const followUpCaseAttributes = pgTable(
  "follow_up_case_attributes",
  {
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    caseId: uuid("case_id")
      .references(() => followUpCases.id, { onDelete: "cascade" })
      .notNull(),
    key: varchar("key", { length: 100 }).notNull(),
    value: jsonb("value").notNull(),
    source: varchar("source", { length: 50 }),
    confidence: real("confidence"),
    detectedAt: timestamp("detected_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.caseId, table.key],
    }),
    index("follow_up_case_attributes_tenant_case_idx").on(
      table.tenantId,
      table.caseId
    ),
  ]
);

export const followUpEvents = pgTable(
  "follow_up_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    caseId: uuid("case_id")
      .references(() => followUpCases.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id")
      .references(() => conversations.id, { onDelete: "cascade" }),
    actorType: varchar("actor_type", { length: 50 }).notNull(),
    actorId: varchar("actor_id", { length: 255 }),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    payload: jsonb("payload").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("follow_up_events_tenant_case_idx").on(table.tenantId, table.caseId),
    index("follow_up_events_tenant_conversation_idx").on(
      table.tenantId,
      table.conversationId
    ),
    index("follow_up_events_event_type_idx").on(table.eventType),
  ]
);

// ============================================================
// CONNECTOR OUTBOX (CON-162 / Epic B3)
// ============================================================

export const connectorOutbox = pgTable(
  "connector_outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    caseId: uuid("case_id")
      .references(() => followUpCases.id, { onDelete: "cascade" })
      .notNull(),
    connectorType: varchar("connector_type", { length: 50 }).notNull(),
    destinationId: varchar("destination_id", { length: 255 }),
    payloadVersion: varchar("payload_version", { length: 20 }).notNull(),
    payload: jsonb("payload").notNull(),
    status: connectorOutboxStatusEnum("status").default("pending").notNull(),
    attemptCount: integer("attempt_count").default(0).notNull(),
    lastError: text("last_error"),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    idempotencyKey: varchar("idempotency_key", { length: 255 }).notNull(),
  },
  (table) => [
    uniqueIndex("connector_outbox_tenant_idempotency_unique").on(
      table.tenantId,
      table.idempotencyKey
    ),
    index("connector_outbox_status_next_attempt_idx").on(
      table.status,
      table.nextAttemptAt
    ),
    index("connector_outbox_tenant_case_idx").on(table.tenantId, table.caseId),
  ]
);

// ============================================================
// KNOWLEDGE ITEMS (site scraper + file upload RAG)
// ============================================================

export const knowledgeItems = pgTable(
  "knowledge_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    type: knowledgeItemTypeEnum("type").notNull(),
    // For 'page': source URL; for 'file': null (parent_id links to knowledge_files)
    sourceUrl: text("source_url"),
    // For 'file' chunks: links to parent file record. CASCADE so deleting a file
    // wipes its chunks atomically (used by DELETE /api/knowledge/files/[id]).
    parentId: uuid("parent_id").references((): AnyPgColumn => knowledgeFiles.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    contentHash: text("content_hash").notNull(), // SHA-256 for change detection
    // Metadata: for 'page': { meta_description, h1, internal_links: [], chunk_index? }
    //           for 'file': { chunk_index, original_filename }
    metadata: jsonb("metadata").default({}).notNull(),
    // Embedding: vector(1536) if pgvector available, else stored as jsonb array
    // Using text for now as drizzle-orm's vector type support varies
    embedding: text("embedding"), // Will be cast to vector(1536) at DB level
    status: knowledgeItemStatusEnum("status").default("pending").notNull(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("knowledge_items_tenant_type_idx").on(table.tenantId, table.type),
    index("knowledge_items_tenant_url_idx").on(table.tenantId, table.sourceUrl),
    index("knowledge_items_tenant_parent_idx").on(table.tenantId, table.parentId),
    index("knowledge_items_status_idx").on(table.tenantId, table.status),
  ]
);

// ============================================================
// KNOWLEDGE FILES (K-05 File Upload)
// ============================================================

export const knowledgeFiles = pgTable(
  "knowledge_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    originalFilename: text("original_filename").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    storagePath: text("storage_path").notNull(),
    status: knowledgeFileStatusEnum("status").default("pending").notNull(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    indexedAt: timestamp("indexed_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("knowledge_files_tenant_idx").on(table.tenantId),
    index("knowledge_files_status_idx").on(table.tenantId, table.status),
  ]
);



// ============================================================
// SITE SYNC JOBS (K-04 / CON-86)
// ============================================================
//
// One row per re-sync run. The UI polls the latest row for the tenant to
// show progress + completion. The job orchestrator chains processSyncBatch()
// invocations via after() and bumps the counters as it goes.

export const siteSyncJobStatusEnum = pgEnum("site_sync_job_status", [
  "queued",
  "running",
  "completed",
  "failed",
]);

export const siteSyncUrlStatusEnum = pgEnum("site_sync_url_status", [
  "pending",
  "processing",
  "done",
  "failed",
  "skipped",
]);

export const siteSyncJobs = pgTable(
  "site_sync_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    status: siteSyncJobStatusEnum("status").default("queued").notNull(),
    pagesTotal: integer("pages_total").default(0).notNull(),
    pagesProcessed: integer("pages_processed").default(0).notNull(),
    pagesAdded: integer("pages_added").default(0).notNull(),
    pagesUpdated: integer("pages_updated").default(0).notNull(),
    pagesUnchanged: integer("pages_unchanged").default(0).notNull(),
    pagesFailed: integer("pages_failed").default(0).notNull(),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("site_sync_jobs_tenant_idx").on(table.tenantId, table.createdAt),
  ]
);

export const siteSyncUrls = pgTable(
  "site_sync_urls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .references(() => siteSyncJobs.id, { onDelete: "cascade" })
      .notNull(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    url: text("url").notNull(),
    status: siteSyncUrlStatusEnum("status").default("pending").notNull(),
    position: integer("position").notNull(),
    errorMessage: text("error_message"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("site_sync_urls_job_status_idx").on(table.jobId, table.status),
    index("site_sync_urls_job_position_idx").on(table.jobId, table.position),
  ]
);

// ============================================================
// PLATFORM INJECTION EVENTS (CON-98)
// ============================================================
//
// Audit log for prompt-injection-defence triggers. Convo-platform-internal
// only — NO tenant-role read policy on this table. The migration enables
// RLS with no SELECT policy for `authenticated`, so tenant users cannot
// query it. Service-role reads only (future platform-admin dashboard).
//
// One row per detection event (regex pre-filter match OR output guard hit).
// References tenant + (optionally) conversation/message for triage context.
// `raw_message_redacted` is truncated + PII-light (see redactForAudit).

export const platformInjectionEvents = pgTable(
  "platform_injection_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    conversationId: uuid("conversation_id").references(
      () => conversations.id,
      { onDelete: "set null" }
    ),
    messageId: uuid("message_id").references(() => messages.id, {
      onDelete: "set null",
    }),
    visitorId: varchar("visitor_id", { length: 255 }),
    // e.g. "regex:ignore_previous", "output_guard:section_header"
    patternMatched: text("pattern_matched").notNull(),
    // Truncated to 500 chars + light PII redaction (emails / long digit runs).
    rawMessageRedacted: text("raw_message_redacted").notNull(),
    detectedAt: timestamp("detected_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("platform_injection_events_tenant_idx").on(
      table.tenantId,
      table.detectedAt
    ),
    index("platform_injection_events_detected_idx").on(table.detectedAt),
  ]
);

// ============================================================
// PLATFORM ADMIN AUDIT LOG (CON-218)
// ============================================================
//
// Append-only admin audit trail. Mutations are represented as intent and
// outcome rows linked by correlationId. UPDATE/DELETE are revoked in SQL.

export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id")
      .references(() => users.id)
      .notNull(),
    actorEmail: text("actor_email").notNull(),
    actorIp: text("actor_ip"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    status: text("status")
      .$type<"intent" | "outcome:success" | "outcome:error">()
      .notNull(),
    beforeState: jsonb("before_state"),
    afterState: jsonb("after_state"),
    metadata: jsonb("metadata"),
    reason: text("reason"),
    supportContext: text("support_context"),
    correlationId: uuid("correlation_id").notNull(),
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("admin_audit_log_intent_idempotency_unique")
      .on(table.actorUserId, table.action, table.targetId, table.idempotencyKey)
      .where(sql`idempotency_key IS NOT NULL AND status = 'intent'`),
    index("admin_audit_log_correlation_idx").on(table.correlationId),
    index("admin_audit_log_action_created_idx").on(table.action, table.createdAt),
    index("admin_audit_log_target_created_idx").on(
      table.targetType,
      table.targetId,
      table.createdAt
    ),
  ]
);

// ============================================================
// PLATFORM ADMIN MFA (CON-219)
// ============================================================

export const adminTotpSecrets = pgTable("admin_totp_secrets", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  secretEncrypted: text("secret_encrypted").notNull(),
  enrolledAt: timestamp("enrolled_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  recoveryCodesHashed: jsonb("recovery_codes_hashed")
    .$type<string[]>()
    .notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const adminTotpAttempts = pgTable(
  "admin_totp_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    success: boolean("success").notNull(),
    attemptedAt: timestamp("attempted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    ip: text("ip"),
  },
  (table) => [
    index("admin_totp_attempts_user_attempted_idx").on(
      table.userId,
      table.attemptedAt
    ),
  ]
);

// ============================================================
// DASHBOARD ERROR CAPTURE (CON-error-logging)
// ============================================================
//
// In-app replacement for Vercel runtime logs (which age out at ~100
// invocations on the free tier). Every dashboard server-component /
// dashboard API-handler exception is captured here at the route boundary
// before being rethrown so Next.js's error.tsx still renders.
//
// Writes only via the server-side service-role Supabase client. RLS is
// enabled with no tenant policies (deny-all to anon/authenticated). The
// `request_meta` jsonb is sanitised at write time — see
// `src/lib/errors/log.ts` for the allow-list (no bodies, no PII, no auth).

export const dashboardErrors = pgTable(
  "dashboard_errors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    digest: text("digest"),
    errorClass: text("error_class"),
    message: text("message"),
    stack: text("stack"),
    route: text("route"),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    tenantId: uuid("tenant_id").references(() => tenants.id, {
      onDelete: "set null",
    }),
    requestMeta: jsonb("request_meta").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("dashboard_errors_digest_idx").on(table.digest),
    index("dashboard_errors_created_at_idx").on(table.createdAt),
    index("dashboard_errors_route_created_at_idx").on(
      table.route,
      table.createdAt
    ),
  ]
);
