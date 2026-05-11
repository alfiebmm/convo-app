/**
 * Site sync orchestrator (K-04 / CON-86).
 *
 * Replaces the V1 "wipe + recrawl in one after() invocation" approach with an
 * incremental sync that fits Vercel Hobby's 60s function cap by chaining
 * after() invocations. Per-URL upsert keeps chat retrieval continuous during
 * a re-sync.
 *
 * Lifecycle:
 *   enqueueSyncJob(tenantId, domain)
 *     -> fetches sitemap + seeds the site_sync_urls work queue
 *     -> creates site_sync_jobs row, status='queued'
 *     -> schedules processSyncBatch(jobId) via after()
 *
 *   processSyncBatch(jobId)
 *     -> claims up to BATCH_SIZE pending URLs (marks them 'processing')
 *     -> fetches each, chunks, embeds, upserts into knowledge_items
 *     -> marks URLs 'done' / 'failed' / 'skipped'
 *     -> if more URLs remain, schedules itself again via after()
 *     -> if queue empty, marks job 'completed'
 *
 * Concurrency: a single job runs sequentially through batches. Two concurrent
 * re-syncs for the same tenant are prevented at the API layer (caller refuses
 * to enqueue if a job is already running for the tenant).
 */
import { createHash } from "crypto";
import { db } from "@/lib/db";
import {
  knowledgeItems,
  siteSyncJobs,
  siteSyncUrls,
} from "@/lib/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { chunkText, generateEmbeddings, formatEmbeddingForDB } from "./embeddings";
import { fetchSinglePage, fetchSitemapFromBase, resolveCanonicalOrigin } from "./crawler";

/** Pages claimed per batch invocation. Sized to fit a 60s function cap
 * including the OpenAI embedding round-trip — ~25 pages averages ~30-45s. */
const BATCH_SIZE = 25;

/**
 * Compute SHA-256 of normalised page text. Used for change detection so
 * unchanged pages skip re-embedding entirely.
 */
function hashContent(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/**
 * Enqueue a fresh sync job for a tenant. Returns the job id immediately so
 * the API can hand it back to the UI for polling.
 *
 * Throws if a job is already running for this tenant (one-at-a-time policy).
 */
export async function enqueueSyncJob(
  tenantId: string,
  domain: string
): Promise<string> {
  // Block concurrent jobs per tenant.
  const existing = await db
    .select({ id: siteSyncJobs.id, status: siteSyncJobs.status })
    .from(siteSyncJobs)
    .where(
      and(
        eq(siteSyncJobs.tenantId, tenantId),
        inArray(siteSyncJobs.status, ["queued", "running"])
      )
    )
    .limit(1);
  if (existing.length) {
    throw Object.assign(new Error("A sync is already running for this tenant"), {
      code: "sync_already_running",
      jobId: existing[0].id,
    });
  }

  // Resolve canonical origin (apex -> www, etc.) and fetch sitemap.
  const { origin, baseUrl } = await resolveCanonicalOrigin(domain);
  const sitemapUrls = await fetchSitemapFromBase(baseUrl);
  // Prepend the homepage and dedupe.
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const u of [baseUrl, ...sitemapUrls]) {
    try {
      const parsed = new URL(u);
      // Same-origin (apex == www).
      const apex = (h: string) => (h.startsWith("www.") ? h.slice(4) : h);
      if (apex(parsed.hostname.toLowerCase()) !== apex(new URL(origin).hostname.toLowerCase())) continue;
    } catch {
      continue;
    }
    if (!seen.has(u)) {
      seen.add(u);
      urls.push(u);
    }
  }

  // Cap to a sane upper bound to prevent runaway jobs on mega-sitemaps.
  // 500 is enough for almost every tenant and still tractable in a few minutes
  // of background work.
  const capped = urls.slice(0, 500);

  // Insert the job row.
  const [job] = await db
    .insert(siteSyncJobs)
    .values({
      tenantId,
      status: "queued",
      pagesTotal: capped.length,
    })
    .returning();

  // Bulk-insert the URL queue. Drizzle's batch insert handles 500 rows fine.
  if (capped.length > 0) {
    await db.insert(siteSyncUrls).values(
      capped.map((url, idx) => ({
        jobId: job.id,
        tenantId,
        url,
        position: idx,
      }))
    );
  }

  // Note: actually kicking the first batch is the caller's job. The API
  // route wraps `processSyncBatch(job.id)` in `next/server`'s `after()` so
  // it survives the response. Standalone scripts can call processSyncBatch
  // directly in a loop to drain a job synchronously.
  return job.id;
}

/**
 * Run the batch in a guarded wrapper that marks the job 'failed' if anything
 * escapes. Exposed for the API route to drop into `after()`.
 */
export async function runBatchGuarded(jobId: string): Promise<void> {
  try {
    await processSyncBatch(jobId);
  } catch (err) {
    console.error(`[Sync] batch failed for ${jobId}:`, err);
    try {
      await db
        .update(siteSyncJobs)
        .set({
          status: "failed",
          errorMessage: err instanceof Error ? err.message : String(err),
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(siteSyncJobs.id, jobId));
    } catch (markErr) {
      console.error(`[Sync] failed to mark ${jobId} failed:`, markErr);
    }
  }
}

/**
 * Process a single batch of pending URLs for a sync job. Self-chains via
 * after() until the queue is empty.
 */
export async function processSyncBatch(jobId: string): Promise<void> {
  // Mark job 'running' on first batch.
  const [job] = await db
    .select()
    .from(siteSyncJobs)
    .where(eq(siteSyncJobs.id, jobId))
    .limit(1);
  if (!job) {
    console.warn(`[Sync] job ${jobId} not found, skipping batch`);
    return;
  }
  if (job.status === "completed" || job.status === "failed") {
    return;
  }
  if (job.status === "queued") {
    await db
      .update(siteSyncJobs)
      .set({ status: "running", startedAt: new Date(), updatedAt: new Date() })
      .where(eq(siteSyncJobs.id, jobId));
  }

  // Claim a batch atomically: select pending URLs ordered by position, then
  // mark them 'processing'.
  const claimed = await db.execute(sql`
    WITH next_batch AS (
      SELECT id FROM site_sync_urls
       WHERE job_id = ${jobId} AND status = 'pending'
       ORDER BY position ASC
       LIMIT ${BATCH_SIZE}
       FOR UPDATE SKIP LOCKED
    )
    UPDATE site_sync_urls AS u
       SET status = 'processing'
      FROM next_batch
     WHERE u.id = next_batch.id
    RETURNING u.id, u.url, u.position;
  `);

  const claimedRows = (
    (claimed as unknown as { rows?: Array<{ id: string; url: string; position: number }> }).rows
      ?? (claimed as unknown as Array<{ id: string; url: string; position: number }>)
  ) ?? [];

  if (claimedRows.length === 0) {
    // No more work — finalise the job.
    await db
      .update(siteSyncJobs)
      .set({
        status: "completed",
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(siteSyncJobs.id, jobId));
    console.log(`[Sync] job ${jobId} completed`);
    return;
  }

  console.log(`[Sync] job ${jobId} processing batch of ${claimedRows.length} URLs (positions ${claimedRows[0].position}-${claimedRows[claimedRows.length - 1].position})`);

  let added = 0;
  let updated = 0;
  let unchanged = 0;
  let failed = 0;

  for (const row of claimedRows) {
    try {
      const result = await processOneUrl(job.tenantId, row.url);
      if (result === "added") added++;
      else if (result === "updated") updated++;
      else if (result === "unchanged") unchanged++;
      else if (result === "skipped") {
        // Skipped (404 / non-html) — still mark done, no chunks counted.
      }
      await db
        .update(siteSyncUrls)
        .set({ status: "done", processedAt: new Date() })
        .where(eq(siteSyncUrls.id, row.id));
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Sync] ${row.url} failed:`, msg);
      await db
        .update(siteSyncUrls)
        .set({
          status: "failed",
          errorMessage: msg.slice(0, 500),
          processedAt: new Date(),
        })
        .where(eq(siteSyncUrls.id, row.id));
    }
  }

  // Update job counters in one go.
  await db
    .update(siteSyncJobs)
    .set({
      pagesProcessed: sql`${siteSyncJobs.pagesProcessed} + ${claimedRows.length}`,
      pagesAdded: sql`${siteSyncJobs.pagesAdded} + ${added}`,
      pagesUpdated: sql`${siteSyncJobs.pagesUpdated} + ${updated}`,
      pagesUnchanged: sql`${siteSyncJobs.pagesUnchanged} + ${unchanged}`,
      pagesFailed: sql`${siteSyncJobs.pagesFailed} + ${failed}`,
      updatedAt: new Date(),
    })
    .where(eq(siteSyncJobs.id, jobId));

  // Chaining is the caller's responsibility. The API route invokes a
  // self-fetch to /api/knowledge/site/sync-jobs/<jobId>/run-batch after
  // each batch returns; each invocation gets a fresh function budget so
  // big sites complete on Vercel Hobby's 60s cap. Standalone scripts can
  // simply call processSyncBatch in a loop.
}

export interface NextBatchHint {
  /** true when this job has remaining pending URLs. */
  hasMore: boolean;
  /** Snapshot of the job after this batch (for callers that don't re-fetch). */
  status: string;
}

/**
 * Return whether more URLs remain to process for a job. Cheap query the
 * chaining caller uses to decide whether to schedule another batch.
 */
export async function jobHasMoreWork(jobId: string): Promise<NextBatchHint> {
  const [job] = await db
    .select({ status: siteSyncJobs.status })
    .from(siteSyncJobs)
    .where(eq(siteSyncJobs.id, jobId))
    .limit(1);
  if (!job) return { hasMore: false, status: "unknown" };
  if (job.status === "completed" || job.status === "failed") {
    return { hasMore: false, status: job.status };
  }
  // "queued" or "running" - check the queue.
  const [{ pending }] = (await db.execute(sql`
    SELECT COUNT(*)::int AS pending FROM site_sync_urls
     WHERE job_id = ${jobId} AND status = 'pending'
  `)).rows as unknown as Array<{ pending: number }>;
  return { hasMore: pending > 0, status: job.status };
}

function unused_keepImports() {
  // tsc/eslint silencer for the inArray import which is only used in one
  // path; touching it directly keeps both honest.
  return inArray;
}
void unused_keepImports;

/**
 * Process a single URL: fetch, chunk, embed, upsert.
 * Returns the disposition for counters.
 */
type ProcessResult = "added" | "updated" | "unchanged" | "skipped";
async function processOneUrl(
  tenantId: string,
  url: string
): Promise<ProcessResult> {
  // We need to know the canonical origin to keep internal-link extraction
  // happy, but for a single-page fetch we just use the URL's own origin.
  const origin = new URL(url).origin;
  const page = await fetchSinglePage(url, origin);
  if (!page) return "skipped";

  const fullText = `${page.title}\n\n${page.h1 ?? ""}\n${page.metaDescription ?? ""}\n\n${page.bodyText}`.trim();
  if (fullText.length < 50) return "skipped";

  const newHash = hashContent(fullText);

  // Check if any existing rows for this URL have an unchanged content hash.
  const existing = await db
    .select({ contentHash: knowledgeItems.contentHash })
    .from(knowledgeItems)
    .where(
      and(
        eq(knowledgeItems.tenantId, tenantId),
        eq(knowledgeItems.sourceUrl, url),
        eq(knowledgeItems.type, "page")
      )
    )
    .limit(1);

  const wasPresent = existing.length > 0;
  if (wasPresent && existing[0].contentHash === newHash) {
    // Bump last_synced_at on existing rows so the dashboard reflects the
    // refresh, but skip the expensive re-embedding.
    await db
      .update(knowledgeItems)
      .set({ lastSyncedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(knowledgeItems.tenantId, tenantId),
          eq(knowledgeItems.sourceUrl, url),
          eq(knowledgeItems.type, "page")
        )
      );
    return "unchanged";
  }

  // Chunk + embed. chunkText uses the module-level CHUNK_SIZE / CHUNK_OVERLAP
  // constants in embeddings.ts so chunking is consistent with the initial
  // index pipeline.
  const chunks = chunkText(page.bodyText);
  if (chunks.length === 0) return "skipped";
  const embeddings = await generateEmbeddings(chunks.map((c) => c.text));

  // Wipe-then-insert per URL is simpler and correct, since the upsert key is
  // (tenant_id, source_url, chunk_index) and chunk counts may differ between
  // syncs. Wrap in a transaction so we don't leave half a page indexed if
  // anything fails mid-write.
  await db.transaction(async (tx) => {
    await tx
      .delete(knowledgeItems)
      .where(
        and(
          eq(knowledgeItems.tenantId, tenantId),
          eq(knowledgeItems.sourceUrl, url),
          eq(knowledgeItems.type, "page")
        )
      );

    const rows = chunks.map((chunk, idx) => ({
      tenantId,
      type: "page" as const,
      sourceUrl: url,
      title: page.title,
      content: chunk.text,
      contentHash: newHash,
      metadata: {
        chunk_index: idx,
        meta_description: page.metaDescription,
        h1: page.h1,
        internal_links: page.internalLinks.slice(0, 50),
      },
      embedding: formatEmbeddingForDB(embeddings[idx]),
      status: "indexed" as const,
      lastSyncedAt: new Date(),
    }));
    await tx.insert(knowledgeItems).values(rows);
  });

  return wasPresent ? "updated" : "added";
}
