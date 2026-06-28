import { NextRequest, NextResponse } from "next/server";

import { deliverPendingWebhooks } from "@/lib/connectors/webhook/deliver";
import { withApiErrorLogging } from "@/lib/errors/wrap";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorised(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return req.headers.get("authorization") === `Bearer ${expected}`;
}

async function getImpl(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await deliverPendingWebhooks({ limit: 50 });
  return NextResponse.json(summary);
}

export const GET = withApiErrorLogging(getImpl, {
  route: "/api/connectors/webhook/run",
});
