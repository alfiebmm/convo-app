/**
 * Smoke test for the K-04 incremental sync orchestrator (CON-86).
 *
 * Creates a throwaway test tenant, enqueues a sync job, polls until done,
 * verifies per-URL upsert (re-runs and confirms 'unchanged' count rises),
 * then tears down.
 */
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const log = (...a) => console.log(...a);

async function getJob(jobId) {
  const { rows } = await pool.query(
    `SELECT * FROM site_sync_jobs WHERE id = $1`,
    [jobId]
  );
  return rows[0];
}

async function waitForJob(jobId, maxMs = 30 * 60 * 1000) {
  const t0 = Date.now();
  let last = null;
  while (Date.now() - t0 < maxMs) {
    const job = await getJob(jobId);
    if (!job) throw new Error('job vanished');
    const snap = `${job.status} ${job.pages_processed}/${job.pages_total} (added=${job.pages_added} updated=${job.pages_updated} unchanged=${job.pages_unchanged} failed=${job.pages_failed})`;
    if (snap !== last) {
      log(' [' + ((Date.now() - t0) / 1000).toFixed(0) + 's]', snap);
      last = snap;
    }
    if (job.status === 'completed' || job.status === 'failed') return job;
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error('timeout waiting for job ' + jobId);
}

async function main() {
  const slug = `qa-k04-${Date.now().toString(36)}`;
  const domain = 'convoapp.com.au';
  const { rows: [tenant] } = await pool.query(
    "INSERT INTO tenants (name, slug, domain) VALUES ($1, $2, $3) RETURNING id, slug",
    ['QA K04 Sync', slug, domain]
  );
  log('1. created test tenant', tenant.slug, tenant.id);

  try {
    const { enqueueSyncJob } = await import('../src/lib/knowledge/sync-orchestrator.ts');

    log('2. first sync (cold) ...');
    const jobId1 = await enqueueSyncJob(tenant.id, domain);
    log('   jobId:', jobId1);
    // The orchestrator schedules processSyncBatch via after(), but in a
    // standalone script there's no Vercel runtime, so after() runs inline
    // on response close. We need to manually drive the chain by polling
    // the job and calling processSyncBatch directly until completion.
    const { processSyncBatch } = await import('../src/lib/knowledge/sync-orchestrator.ts');
    while (true) {
      const job = await getJob(jobId1);
      if (!job) throw new Error('vanished');
      if (job.status === 'completed' || job.status === 'failed') break;
      log(' batch tick:', job.status, job.pages_processed + '/' + job.pages_total);
      await processSyncBatch(jobId1);
    }
    const final1 = await getJob(jobId1);
    log('3. first sync result:', {
      status: final1.status,
      total: final1.pages_total,
      processed: final1.pages_processed,
      added: final1.pages_added,
      updated: final1.pages_updated,
      unchanged: final1.pages_unchanged,
      failed: final1.pages_failed,
    });
    if (final1.status !== 'completed') throw new Error('first sync did not complete: ' + final1.error_message);
    if (final1.pages_added === 0) throw new Error('first sync added 0 pages');

    // Verify rows landed
    const r1 = await pool.query(
      "SELECT COUNT(DISTINCT source_url)::int AS p, COUNT(*)::int AS c FROM knowledge_items WHERE tenant_id=$1 AND type='page'",
      [tenant.id]
    );
    log('   knowledge_items:', r1.rows[0]);

    log('4. second sync (warm, should be mostly unchanged) ...');
    const jobId2 = await enqueueSyncJob(tenant.id, domain);
    while (true) {
      const job = await getJob(jobId2);
      if (!job) throw new Error('vanished');
      if (job.status === 'completed' || job.status === 'failed') break;
      await processSyncBatch(jobId2);
    }
    const final2 = await getJob(jobId2);
    log('5. second sync result:', {
      status: final2.status,
      total: final2.pages_total,
      processed: final2.pages_processed,
      added: final2.pages_added,
      updated: final2.pages_updated,
      unchanged: final2.pages_unchanged,
      failed: final2.pages_failed,
    });
    if (final2.status !== 'completed') throw new Error('second sync did not complete');
    if (final2.pages_unchanged === 0) {
      throw new Error('second sync should mostly skip via content-hash; got 0 unchanged');
    }

    log('6. concurrent enqueue guard ...');
    // Start a job, then immediately try to start another while the first is queued.
    const jobId3 = await enqueueSyncJob(tenant.id, domain);
    try {
      await enqueueSyncJob(tenant.id, domain);
      throw new Error('expected sync_already_running error');
    } catch (e) {
      if (e.code !== 'sync_already_running') throw e;
      log('   correctly blocked:', e.message);
    }
    // Drain it.
    while (true) {
      const job = await getJob(jobId3);
      if (!job) break;
      if (job.status === 'completed' || job.status === 'failed') break;
      await processSyncBatch(jobId3);
    }

    log('\n✅ K-04 SYNC ORCHESTRATOR SMOKE TEST PASS');
  } finally {
    await pool.query('DELETE FROM tenants WHERE id = $1', [tenant.id]);
    log('teardown: deleted test tenant');
    await pool.end();
  }
}

main().catch(e => { console.error('SMOKE TEST FAILED:', e.message, e.stack); process.exit(1); });
