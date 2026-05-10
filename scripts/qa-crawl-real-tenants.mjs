/**
 * One-shot: crawl Cam's real prod tenants (Doggo + AgPages) directly so the
 * Knowledge tab has data while we debug why the in-app Re-sync POST isn't
 * yielding rows. Wipes existing page rows for the tenant first.
 */
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const log = (...a) => console.log(...a);

async function main() {
  const { indexTenantSite } = await import('../src/lib/knowledge/indexer.ts');
  const { rows: tenants } = await pool.query(
    "SELECT id, slug, domain FROM tenants WHERE domain IS NOT NULL AND domain != 'localhost' ORDER BY slug"
  );
  log('eligible tenants:', tenants.map(t => `${t.slug} (${t.domain})`).join(', '));

  for (const t of tenants) {
    log('\n=== ' + t.slug + ' / ' + t.domain + ' ===');
    const before = await pool.query(
      "SELECT COUNT(*)::int AS n FROM knowledge_items WHERE tenant_id=$1 AND type='page'",
      [t.id]
    );
    log(' before:', before.rows[0].n, 'rows');

    await pool.query(
      "DELETE FROM knowledge_items WHERE tenant_id=$1 AND type='page'",
      [t.id]
    );

    const t0 = Date.now();
    try {
      await indexTenantSite(t.id, t.domain);
      log(' completed in', ((Date.now() - t0) / 1000).toFixed(1), 's');
    } catch (e) {
      log(' FAILED:', e.message);
      continue;
    }

    const after = await pool.query(
      `SELECT COUNT(DISTINCT source_url)::int AS pages, COUNT(*)::int AS chunks,
              MAX(last_synced_at) AS last
         FROM knowledge_items WHERE tenant_id=$1 AND type='page'`,
      [t.id]
    );
    log(' after:', after.rows[0]);
  }
  await pool.end();
}

main().catch(e => { console.error('FAILED:', e.message, e.stack); process.exit(1); });
