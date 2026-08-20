import { after, NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { z } from "zod";

import {
  requestBlogPipeline,
  type BlogTriggerResult,
  type ScheduleBlogTask,
} from "@/lib/blog/trigger";
import { db } from "@/lib/db";
import { blogPosts, conversations } from "@/lib/db/schema";
import { withApiErrorLogging } from "@/lib/errors/wrap";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  tenantId: z.string().uuid(),
  limit: z.number().int().min(1).max(50).default(20),
  dryRun: z.boolean().default(true),
});

type BackfillOrphansRequest = {
  headers: Pick<Headers, "get">;
  json: () => Promise<unknown>;
};

type BackfillOrphansBody = z.infer<typeof bodySchema>;

type ExecuteResult =
  | { rows?: Record<string, unknown>[] }
  | Record<string, unknown>[];

export type BackfillOrphansDeps = {
  schedule: ScheduleBlogTask;
  findOrphanConversationIds: (args: {
    tenantId: string;
    limit: number;
  }) => Promise<string[]>;
  resetConversationStates: (args: {
    tenantId: string;
    conversationIds: string[];
  }) => Promise<void>;
  requestPipeline: typeof requestBlogPipeline;
};

export type BackfillOrphansSummary = {
  tenantId: string;
  dryRun: boolean;
  found: number;
  queued: number;
  skipped: number;
  notFound: number;
  conversationIds: string[];
};

const defaultDeps: BackfillOrphansDeps = {
  schedule: (task) => after(task),

  async findOrphanConversationIds({ tenantId, limit }) {
    const result = await db.execute(sql`
      SELECT ${conversations.id} AS id
        FROM ${conversations}
        LEFT JOIN ${blogPosts}
          ON ${blogPosts.threadId} = ${conversations.id}
       WHERE ${conversations.tenantId} = ${tenantId}
         AND COALESCE(
               ${conversations.metadata}->'blogConversion'->>'state',
               ''
             ) = 'converted_to_blog'
         AND ${blogPosts.id} IS NULL
       ORDER BY ${conversations.startedAt} ASC
       LIMIT ${limit}
    `);

    return rowsOf<{ id: string }>(result).map((row) => row.id);
  },

  async resetConversationStates({ tenantId, conversationIds }) {
    if (conversationIds.length === 0) return;

    await db.execute(sql`
      UPDATE ${conversations}
         SET metadata = jsonb_set(
               ${conversations.metadata},
               '{blogConversion,state}',
               '"reset"'::jsonb,
               true
             )
       WHERE ${conversations.tenantId} = ${tenantId}
         AND ${conversations.id} = ANY(${uuidArray(conversationIds)})
    `);
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

function isAuthorised(req: BackfillOrphansRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true;
  return req.headers.get("authorization") === `Bearer ${expected}`;
}

function summariseTrigger(
  summary: BackfillOrphansSummary,
  result: BlogTriggerResult
) {
  if (result.status === "queued") summary.queued++;
  else if (result.status === "skipped") summary.skipped++;
  else summary.notFound++;
}

async function parseBody(req: BackfillOrphansRequest) {
  try {
    return bodySchema.safeParse(await req.json());
  } catch {
    return bodySchema.safeParse(null);
  }
}

export async function handleBackfillOrphans(
  req: BackfillOrphansRequest,
  deps: BackfillOrphansDeps = defaultDeps
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

  const { tenantId, limit, dryRun }: BackfillOrphansBody = parsed.data;
  const conversationIds = await deps.findOrphanConversationIds({
    tenantId,
    limit,
  });

  const summary: BackfillOrphansSummary = {
    tenantId,
    dryRun,
    found: conversationIds.length,
    queued: 0,
    skipped: 0,
    notFound: 0,
    conversationIds,
  };

  if (dryRun) return NextResponse.json(summary);

  await deps.resetConversationStates({ tenantId, conversationIds });

  for (const conversationId of conversationIds) {
    const result = await deps.requestPipeline(conversationId, {
      source: "backfill",
      tenantId,
      markCompleted: true,
      schedule: deps.schedule,
    });
    summariseTrigger(summary, result);
  }

  return NextResponse.json(summary);
}

async function postImpl(req: NextRequest) {
  return handleBackfillOrphans(req);
}

export const POST = withApiErrorLogging(postImpl, {
  route: "/api/blog/backfill-orphans",
});
