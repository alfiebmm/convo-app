/**
 * HTTP self-call helpers for chaining sync batches across serverless
 * invocations (K-04 / CON-86).
 *
 * Each batch runs in its own /api/knowledge/site/sync-jobs/[id]/run-batch
 * invocation with a fresh 60s function budget. The first batch is kicked
 * off by the /resync endpoint via `kickOffSyncChain`. Subsequent batches
 * dispatch the next one via this same mechanism after they finish.
 *
 * Internal auth: shared secret in `x-sync-token` header, validated against
 * `process.env.SYNC_INTERNAL_TOKEN`.
 */
import { runBatchGuarded } from "@/lib/knowledge/sync-orchestrator";

export async function dispatchBatch(
  jobId: string,
  origin: string,
  token: string
): Promise<void> {
  const url = `${origin}/api/knowledge/site/sync-jobs/${jobId}/run-batch`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "x-sync-token": token, "content-type": "application/json" },
      // 5s timeout: fetch only needs to confirm dispatch; the actual batch
      // runs in its own invocation.
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    const e = err as { name?: string; message?: string } | null;
    if (e?.name !== "AbortError" && e?.name !== "TimeoutError") {
      console.warn(`[Sync] dispatch warning for ${jobId}:`, e?.message);
    }
  }
}

/**
 * Kick off a sync chain for a newly-enqueued job. Used by /resync.
 * If `SYNC_INTERNAL_TOKEN` isn't configured, falls back to running the
 * first batch inline (which on Vercel will still survive within after()
 * but won't chain further \u2014 only viable for small sites).
 */
export async function kickOffSyncChain(
  jobId: string,
  origin: string
): Promise<void> {
  const token = process.env.SYNC_INTERNAL_TOKEN;
  if (!token) {
    console.error(
      "[Sync] SYNC_INTERNAL_TOKEN not set; running first batch inline (no chain)."
    );
    await runBatchGuarded(jobId);
    return;
  }
  await dispatchBatch(jobId, origin, token);
}
