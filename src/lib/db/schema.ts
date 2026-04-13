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
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

// ============================================================
// ENUMS
// ============================================================

export const planEnum = pgEnum("plan", [
  "starter",
  "growth",
  "pro",
  "enterprise",
]);

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

// ============================================================
// TENANTS (organisations / sites)
// ============================================================

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 63 }).notNull().unique(),
  domain: varchar("domain", { length: 255 }), // the client website domain
  plan: planEnum("plan").default("starter").notNull(),
  settings: jsonb("settings").default({}).notNull(), // widget config, persona, guardrails, CMS creds
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
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
