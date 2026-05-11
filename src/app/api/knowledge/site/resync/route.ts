/**
 * POST /api/knowledge/site/resync
 *
 * Kicks off an incremental sync job for the current tenant. Returns the
 * jobId immediately so the UI can poll
 * GET /api/knowledge/site/sync-jobs/[id] for progress.
 *
 * The actual sync work happens in chained after() invocations (K-04 / CON-86).
 * Per-URL upsert keeps chat retrieval continuous during the sync — old chunks
 * stay queryable until the new ones replace them in a transaction.
 *
 * Tenant-scoped via session auth.
 */
import { NextResponse, after } from "next/server";
import { getCurrentTenant } from "@/lib/auth-context";
import { enqueueSyncJob } from "@/lib/knowledge/sync-orchestrator";
import { kickOffSyncChain } from "@/lib/knowledge/sync-chain";

export const runtime = "nodejs";
export const maxDuration = 30; // sitemap fetch + URL queue insert only

export async function POST(req: Request) {
  const tenant = await getCurrentTenant();
  if (!tenant) {
    return NextResponse.json({ error: "No active tenant" }, { status: 401 });
  }
  if (!tenant.domain) {
    return NextResponse.json(
      { error: "No domain configured for this tenant. Add one in Settings." },
      { status: 400 }
    );
  }

  try {
    const jobId = await enqueueSyncJob(tenant.id, tenant.domain);

    // Kick off the chain. Each batch self-dispatches the next one via HTTP
    // self-call so the work survives Vercel Hobby's 60s function cap.
    const origin = new URL(req.url).origin;
    after(async () => {
      await kickOffSyncChain(jobId, origin);
    });

    return NextResponse.json({ success: true, jobId });
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === "sync_already_running") {
      return NextResponse.json(
        {
          error: "A sync is already running for this tenant.",
          jobId: (err as { jobId?: string }).jobId,
        },
        { status: 409 }
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Resync] failed to enqueue:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
