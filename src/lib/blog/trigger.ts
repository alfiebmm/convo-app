import { and, eq, sql } from "drizzle-orm";

import { resolveBlogIdleMinutes } from "@/lib/blog/config";
import { runBlogPipeline } from "@/lib/blog/pipeline";
import { db } from "@/lib/db";
import { blogPosts, conversations, messages, tenants } from "@/lib/db/schema";

export type BlogTriggerSource = "manual" | "idle";

export type BlogTriggerResult =
  | { status: "queued"; conversationId: string }
  | {
      status: "skipped";
      conversationId: string;
      reason: "duplicate_thread_id" | "already_triggered";
    }
  | { status: "not_found"; conversationId: string };

type ConversationForTrigger = {
  id: string;
  tenantId: string;
  status: string;
  metadata: Record<string, unknown>;
  completedAt: Date | null;
};

export type ScheduleBlogTask = (task: () => Promise<void>) => void;

export type BlogTriggerDeps = {
  findConversation: (
    conversationId: string,
    tenantId?: string
  ) => Promise<ConversationForTrigger | null>;
  hasBlogPostForThread: (conversationId: string) => Promise<boolean>;
  saveTriggerState: (
    conversation: ConversationForTrigger,
    source: BlogTriggerSource,
    markCompleted: boolean,
    now: Date
  ) => Promise<void>;
  runBlogPipeline: (conversationId: string) => Promise<unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

export function getBlogConversionState(
  metadata: Record<string, unknown>
): string | null {
  const value = metadata.blogConversion;
  if (!isRecord(value)) return null;
  return typeof value.state === "string" ? value.state : null;
}

const defaultDeps: BlogTriggerDeps = {
  async findConversation(conversationId, tenantId) {
    const where = tenantId
      ? and(eq(conversations.id, conversationId), eq(conversations.tenantId, tenantId))
      : eq(conversations.id, conversationId);
    const [row] = await db
      .select({
        id: conversations.id,
        tenantId: conversations.tenantId,
        status: conversations.status,
        metadata: conversations.metadata,
        completedAt: conversations.completedAt,
      })
      .from(conversations)
      .where(where)
      .limit(1);

    if (!row) return null;
    return {
      ...row,
      metadata: asRecord(row.metadata),
    };
  },

  async hasBlogPostForThread(conversationId) {
    const [post] = await db
      .select({ id: blogPosts.id })
      .from(blogPosts)
      .where(eq(blogPosts.threadId, conversationId))
      .limit(1);
    return Boolean(post);
  },

  async saveTriggerState(conversation, source, markCompleted, now) {
    const existing = asRecord(conversation.metadata.blogConversion);
    const nextMetadata = {
      ...conversation.metadata,
      blogConversion: {
        ...existing,
        state: "converted_to_blog",
        source,
        triggeredAt: now.toISOString(),
      },
    };
    await db
      .update(conversations)
      .set({
        metadata: nextMetadata,
        ...(markCompleted && conversation.status !== "completed"
          ? { status: "completed" as const, completedAt: conversation.completedAt ?? now }
          : {}),
      })
      .where(eq(conversations.id, conversation.id));
  },

  runBlogPipeline,
};

export async function requestBlogPipeline(
  conversationId: string,
  {
    source,
    tenantId,
    markCompleted = false,
    schedule,
    deps = defaultDeps,
    now = new Date(),
  }: {
    source: BlogTriggerSource;
    tenantId?: string;
    markCompleted?: boolean;
    schedule: ScheduleBlogTask;
    deps?: BlogTriggerDeps;
    now?: Date;
  }
): Promise<BlogTriggerResult> {
  const conversation = await deps.findConversation(conversationId, tenantId);
  if (!conversation) return { status: "not_found", conversationId };

  if (await deps.hasBlogPostForThread(conversationId)) {
    console.info("[blog] trigger skipped", {
      conversationId,
      reason: "duplicate_thread_id",
    });
    return { status: "skipped", conversationId, reason: "duplicate_thread_id" };
  }

  if (getBlogConversionState(conversation.metadata) === "converted_to_blog") {
    console.info("[blog] trigger skipped", {
      conversationId,
      reason: "already_triggered",
    });
    return { status: "skipped", conversationId, reason: "already_triggered" };
  }

  await deps.saveTriggerState(conversation, source, markCompleted, now);

  schedule(async () => {
    try {
      await deps.runBlogPipeline(conversationId);
    } catch (error) {
      console.error("[blog] pipeline failed", {
        conversationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return { status: "queued", conversationId };
}

export type IdleBlogTriggerSummary = {
  scannedTenants: number;
  queued: number;
  skipped: number;
  notFound: number;
};

export async function triggerIdleBlogPipelines({
  schedule,
  now = new Date(),
  limit = 50,
}: {
  schedule: ScheduleBlogTask;
  now?: Date;
  limit?: number;
}): Promise<IdleBlogTriggerSummary> {
  const tenantRows = await db
    .select({ id: tenants.id, settings: tenants.settings })
    .from(tenants)
    .where(eq(tenants.status, "active"));

  const summary: IdleBlogTriggerSummary = {
    scannedTenants: tenantRows.length,
    queued: 0,
    skipped: 0,
    notFound: 0,
  };

  for (const tenant of tenantRows) {
    const idleMinutes = resolveBlogIdleMinutes(asRecord(tenant.settings));
    const cutoff = new Date(now.getTime() - idleMinutes * 60_000);
    const remaining = Math.max(0, limit - summary.queued);
    if (remaining === 0) break;

    const result = await db.execute(sql`
      WITH latest_messages AS (
        SELECT ${conversations.id} AS conversation_id,
               MAX(${messages.createdAt}) AS latest_message_at
          FROM ${conversations}
          LEFT JOIN ${messages} ON ${messages.conversationId} = ${conversations.id}
         WHERE ${conversations.tenantId} = ${tenant.id}
         GROUP BY ${conversations.id}
      )
      SELECT ${conversations.id} AS id
        FROM ${conversations}
        INNER JOIN latest_messages
          ON latest_messages.conversation_id = ${conversations.id}
        LEFT JOIN ${blogPosts}
          ON ${blogPosts.threadId} = ${conversations.id}
       WHERE ${conversations.tenantId} = ${tenant.id}
         AND ${conversations.status} <> 'archived'
         AND ${blogPosts.id} IS NULL
         AND COALESCE(
               latest_messages.latest_message_at,
               ${conversations.startedAt}
             ) <= ${cutoff}
         AND COALESCE(
               ${conversations.metadata}->'blogConversion'->>'state',
               ''
             ) <> 'converted_to_blog'
       ORDER BY COALESCE(latest_messages.latest_message_at, ${conversations.startedAt}) ASC
       LIMIT ${remaining}
    `);

    const rows =
      (result as unknown as { rows?: Array<{ id: string }> }).rows ??
      (result as unknown as Array<{ id: string }>);

    for (const row of rows) {
      const trigger = await requestBlogPipeline(row.id, {
        source: "idle",
        tenantId: tenant.id,
        markCompleted: true,
        schedule,
        now,
      });
      if (trigger.status === "queued") summary.queued++;
      else if (trigger.status === "skipped") summary.skipped++;
      else summary.notFound++;
    }
  }

  return summary;
}
