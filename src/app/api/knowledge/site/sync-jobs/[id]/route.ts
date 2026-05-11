/**
 * GET /api/knowledge/site/sync-jobs/[id]
 *
 * Poll endpoint for the UI. Returns the current job status + progress
 * counters so the ResyncButton can render a live progress indicator.
 *
 * Tenant-scoped: returns 404 if the job belongs to a different tenant.
 */
import { NextResponse } from "next/server";
import { getCurrentTenant } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { siteSyncJobs } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenant = await getCurrentTenant();
  if (!tenant) {
    return NextResponse.json({ error: "No active tenant" }, { status: 401 });
  }
  const { id } = await params;

  const [job] = await db
    .select()
    .from(siteSyncJobs)
    .where(and(eq(siteSyncJobs.id, id), eq(siteSyncJobs.tenantId, tenant.id)))
    .limit(1);

  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: job.id,
    status: job.status,
    pagesTotal: job.pagesTotal,
    pagesProcessed: job.pagesProcessed,
    pagesAdded: job.pagesAdded,
    pagesUpdated: job.pagesUpdated,
    pagesUnchanged: job.pagesUnchanged,
    pagesFailed: job.pagesFailed,
    errorMessage: job.errorMessage,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    createdAt: job.createdAt,
  });
}
