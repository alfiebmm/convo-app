import { after, NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { z } from "zod";

import {
  requestBlogPipeline,
  type BlogTriggerResult,
  type ScheduleBlogTask,
} from "@/lib/blog/trigger";
import { db } from "@/lib/db";
import { blogPosts, conversations, messages } from "@/lib/db/schema";
import { withApiErrorLogging } from "@/lib/errors/wrap";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  tenantId: z.string().uuid(),
  limit: z.number().int().min(1).max(50).default(20),
  mode: z.enum(["retry_failed", "top_n"]).default("retry_failed"),
});

type ReprocessFailedBlogRequest = {
  headers: Pick<Headers, "get">;
  json: () => Promise<unknown>;
};

type ReprocessFailedBlogBody = z.infer<typeof bodySchema>;

type ExecuteResult =
  | { rows?: Record<string, unknown>[] }
  | Record<string, unknown>[];

type FailedPostPurge = {
  purged: number;
  conversationIds: string[];
};

export type ReprocessFailedBlogDeps = {
  schedule: ScheduleBlogTask;
  purgeFailedPosts: (tenantId: string) => Promise<FailedPostPurge>;
  resetConversationStates: (conversationIds: string[]) => Promise<void>;
  findNewestConversationIds: (args: {
    tenantId: string;
    limit: number;
  }) => Promise<string[]>;
  requestPipeline: typeof requestBlogPipeline;
};

export type ReprocessFailedBlogSummary = {
  tenantId: string;
  purged: number;
  queued: number;
  skipped: number;
  notFound: number;
  conversationIds: string[];
};

const defaultDeps: ReprocessFailedBlogDeps = {
  schedule: (task) => after(task),

  async purgeFailedPosts(tenantId) {
    const result = await db.execute(sql`
      DELETE FROM ${blogPosts}
       WHERE ${blogPosts.tenantId} = ${tenantId}
         AND ${blogPosts.status} = 'generation_failed'
       RETURNING ${blogPosts.threadId} AS thread_id
    `);

    const rows = rowsOf<{ thread_id: string | null }>(result);
    return {
      purged: rows.length,
      conversationIds: rows
        .map((row) => row.thread_id)
        .filter((id): id is string => Boolean(id)),
    };
  },

  async resetConversationStates(conversationIds) {
    if (conversationIds.length === 0) return;

    await db.execute(sql`
      UPDATE ${conversations}
         SET ${conversations.metadata} = jsonb_set(
               ${conversations.metadata},
               '{blogConversion,state}',
               '"reset"'::jsonb,
               true
             )
       WHERE ${conversations.id} = ANY(${uuidArray(conversationIds)})
    `);
  },

  async findNewestConversationIds({ tenantId, limit }) {
    const result = await db.execute(sql`
      WITH latest_messages AS (
        SELECT ${conversations.id} AS conversation_id,
               MAX(${messages.createdAt}) AS latest_message_at
          FROM ${conversations}
          LEFT JOIN ${messages} ON ${messages.conversationId} = ${conversations.id}
         WHERE ${conversations.tenantId} = ${tenantId}
         GROUP BY ${conversations.id}
      )
      SELECT ${conversations.id} AS id
        FROM ${conversations}
        INNER JOIN latest_messages
          ON latest_messages.conversation_id = ${conversations.id}
        LEFT JOIN ${blogPosts}
          ON ${blogPosts.threadId} = ${conversations.id}
       WHERE ${conversations.tenantId} = ${tenantId}
         AND ${conversations.status} <> 'archived'
         AND ${blogPosts.id} IS NULL
         AND COALESCE(
               ${conversations.metadata}->'blogConversion'->>'state',
               ''
             ) <> 'converted_to_blog'
       ORDER BY COALESCE(latest_messages.latest_message_at, ${conversations.startedAt}) DESC
       LIMIT ${limit}
    `);

    return rowsOf<{ id: string }>(result).map((row) => row.id);
  },

  requestPipeline: requestBlogPipeline,
};

function rowsOf<Row extends Record<string, unknown>>(result: ExecuteResult): Row[] {
  return (Array.isArray(result) ? result : result.rows ?? []) as Row[];
}

function uuidArray(ids: string[]) {
  return sql`ARRAY[${sql.join(
    ids.map((id) => sql`${id}::uuid`),
    sql`, `
  )}]::uuid[]`;
}

function isAuthorised(req: ReprocessFailedBlogRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true;
  return req.headers.get("authorization") === `Bearer ${expected}`;
}

function summariseTrigger(
  summary: ReprocessFailedBlogSummary,
  result: BlogTriggerResult
) {
  if (result.status === "queued") summary.queued++;
  else if (result.status === "skipped") summary.skipped++;
  else summary.notFound++;
}

async function parseBody(req: ReprocessFailedBlogRequest) {
  try {
    return bodySchema.safeParse(await req.json());
  } catch {
    return bodySchema.safeParse(null);
  }
}

export async function handleReprocessFailedBlogPosts(
  req: ReprocessFailedBlogRequest,
  deps: ReprocessFailedBlogDeps = defaultDeps
) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseBody(req);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { tenantId, limit, mode }: ReprocessFailedBlogBody = parsed.data;
  const purge =
    mode === "retry_failed"
      ? await deps.purgeFailedPosts(tenantId)
      : { purged: 0, conversationIds: [] };

  await deps.resetConversationStates(purge.conversationIds);

  const conversationIds = await deps.findNewestConversationIds({
    tenantId,
    limit,
  });

  const summary: ReprocessFailedBlogSummary = {
    tenantId,
    purged: purge.purged,
    queued: 0,
    skipped: 0,
    notFound: 0,
    conversationIds,
  };

  for (const conversationId of conversationIds) {
    const result = await deps.requestPipeline(conversationId, {
      source: "manual",
      tenantId,
      markCompleted: true,
      schedule: deps.schedule,
    });
    summariseTrigger(summary, result);
  }

  return NextResponse.json(summary);
}

async function postImpl(req: NextRequest) {
  return handleReprocessFailedBlogPosts(req);
}

export const POST = withApiErrorLogging(postImpl, {
  route: "/api/blog/reprocess-failed",
});
