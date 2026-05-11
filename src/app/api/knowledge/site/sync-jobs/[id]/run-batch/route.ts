/**
 * POST /api/knowledge/site/sync-jobs/[id]/run-batch
 *
 * Internal endpoint that processes one batch of a sync job and self-chains
 * the next batch via a background HTTP self-call. Each batch lands in its
 * own serverless invocation with a fresh 60s budget, which is the only
 * reliable way to run long jobs on Vercel Hobby.
 *
 * Auth: shared secret in `x-sync-token` header, validated against
 * `process.env.SYNC_INTERNAL_TOKEN`. Not user-facing.
 */
import { NextResponse, after } from "next/server";
import { processSyncBatch, jobHasMoreWork } from "@/lib/knowledge/sync-orchestrator";
import { dispatchBatch } from "@/lib/knowledge/sync-chain";
import { db } from "@/lib/db";
import { siteSyncJobs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const maxDuration = 60; // Hobby plan max

function isAuthorized(req: Request): boolean {
  const expected = process.env.SYNC_INTERNAL_TOKEN;
  if (!expected) return false;
  const provided = req.headers.get("x-sync-token");
  return provided !== null && provided === expected;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  // Confirm the job exists before doing work.
  const [job] = await db
    .select({ id: siteSyncJobs.id })
    .from(siteSyncJobs)
    .where(eq(siteSyncJobs.id, id))
    .limit(1);
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await processSyncBatch(id);
  const next = await jobHasMoreWork(id);

  if (next.hasMore) {
    const origin = new URL(req.url).origin;
    const token = process.env.SYNC_INTERNAL_TOKEN!;
    // Schedule the dispatch via after() so the response returns first.
    after(async () => {
      await dispatchBatch(id, origin, token);
    });
  }

  return NextResponse.json({
    ok: true,
    status: next.status,
    hasMore: next.hasMore,
  });
}
