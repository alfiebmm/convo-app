import { after, NextRequest, NextResponse } from "next/server";

import { triggerIdleBlogPipelines } from "@/lib/blog/trigger";
import { withApiErrorLogging } from "@/lib/errors/wrap";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorised(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true;
  return req.headers.get("authorization") === `Bearer ${expected}`;
}

async function getImpl(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await triggerIdleBlogPipelines({
    schedule: (task) => after(task),
  });

  return NextResponse.json(summary);
}

export const GET = withApiErrorLogging(getImpl, {
  route: "/api/cron/blog-idle-trigger",
});

