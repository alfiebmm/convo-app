/**
 * Smoke test for POST /api/knowledge/site/resync.
 *
 * Mirrors the route logic: creates a tenant with a domain, runs an initial
 * indexTenantSite() to populate rows, then exercises the wipe + re-crawl
 * cycle. Verifies row counts before/after and that crawl runs to completion.
 */
import { Pool } from 'pg';

const DB_URL = process.env.DATABASE_URL;
const pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
const log = (...a) => console.log(...a);

async function countPages(tenantId) {
  const r = await pool.query(
    `SELECT COUNT(DISTINCT source_url)::int AS pages, MAX(last_synced_at) AS last_synced
       FROM knowledge_items WHERE tenant_id = $1 AND type = 'page'`,
    [tenantId]
  );
  return r.rows[0];
}

async function main() {
  const slug = `qa-resync-${Date.now().toString(36)}`;
  const domain = 'convoapp.com.au';
  const { rows: [tenant] } = await pool.query(
    "INSERT INTO tenants (name, slug, domain) VALUES ($1, $2, $3) RETURNING id, slug",
    ['QA Resync Smoke', slug, domain]
  );
  log('1. created test tenant:', tenant.slug, tenant.id, 'domain=', domain);

  try {
    const { indexTenantSite } = await import('../src/lib/knowledge/indexer.ts');

    log('2. initial indexTenantSite() ...');
    await indexTenantSite(tenant.id, domain);
    const before = await countPages(tenant.id);
    log('   after initial crawl:', before);
    if (before.pages === 0) throw new Error('FAIL: initial crawl produced zero pages');

    log('3. simulating re-sync (wipe + recrawl) ...');
    const wipeRes = await pool.query(
      "DELETE FROM knowledge_items WHERE tenant_id = $1 AND type = 'page'",
      [tenant.id]
    );
    log('   wiped', wipeRes.rowCount, 'rows');
    const wiped = await countPages(tenant.id);
    log('   after wipe:', wiped);
    if (wiped.pages !== 0) throw new Error('FAIL: wipe did not remove all page rows');

    await indexTenantSite(tenant.id, domain);
    const after = await countPages(tenant.id);
    log('4. after recrawl:', after);
    if (after.pages === 0) throw new Error('FAIL: recrawl produced zero pages');

    log('\n✅ RESYNC SMOKE TEST PASS:', { before: before.pages, after: after.pages });
  } finally {
    await pool.query('DELETE FROM knowledge_items WHERE tenant_id = $1', [tenant.id]);
    await pool.query('DELETE FROM tenants WHERE id = $1', [tenant.id]);
    log('teardown: deleted test tenant and all rows');
    await pool.end();
  }
}

main().catch(e => { console.error('SMOKE TEST FAILED:', e.message, e.stack); process.exit(1); });
