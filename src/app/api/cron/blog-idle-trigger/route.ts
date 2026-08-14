import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  triggerIdleBlogPipelines,
  type ScheduleBlogTask,
} from "@/lib/blog/trigger";
import { withApiErrorLogging } from "@/lib/errors/wrap";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const tenantIdSchema = z.string().uuid();

type BlogIdleTriggerRequest = {
  headers: Pick<Headers, "get">;
  nextUrl: { searchParams: URLSearchParams };
};

export type BlogIdleTriggerDeps = {
  schedule: ScheduleBlogTask;
  triggerIdleBlogPipelines: typeof triggerIdleBlogPipelines;
};

const defaultDeps: BlogIdleTriggerDeps = {
  schedule: (task) => after(task),
  triggerIdleBlogPipelines,
};

function isAuthorised(req: BlogIdleTriggerRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true;
  return req.headers.get("authorization") === `Bearer ${expected}`;
}

export async function handleBlogIdleTrigger(
  req: BlogIdleTriggerRequest,
  deps: BlogIdleTriggerDeps = defaultDeps
) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = req.nextUrl.searchParams.get("tenantId") ?? undefined;
  if (tenantId && !tenantIdSchema.safeParse(tenantId).success) {
    return NextResponse.json({ error: "invalid_tenant_id" }, { status: 400 });
  }

  const summary = await deps.triggerIdleBlogPipelines({
    schedule: deps.schedule,
    tenantId,
  });

  return NextResponse.json(summary);
}

async function getImpl(req: NextRequest) {
  return handleBlogIdleTrigger(req);
}

export const GET = withApiErrorLogging(getImpl, {
  route: "/api/cron/blog-idle-trigger",
});
