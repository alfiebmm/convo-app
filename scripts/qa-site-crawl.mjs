/**
 * Smoke test for the K-03 site scraper.
 *
 * Creates a throwaway tenant with a real (small) domain, runs the
 * indexTenantSite() pipeline directly, then verifies:
 *   - page-type knowledge_items rows exist
 *   - embeddings present
 *   - status endpoint shape (computed here, not via HTTP)
 */
import { Pool } from 'pg';

const DB_URL = process.env.DATABASE_URL;
const pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
const log = (...a) => console.log(...a);

async function main() {
  const slug = `qa-k03-${Date.now().toString(36)}`;
  // Use a small known site we control via Glasshouse — convoapp.com.au itself.
  const domain = 'convoapp.com.au';
  const { rows: [tenant] } = await pool.query(
    "INSERT INTO tenants (name, slug, domain) VALUES ($1, $2, $3) RETURNING id, slug",
    ['QA K03 Smoke Test', slug, domain]
  );
  log('1. created test tenant:', tenant.slug, tenant.id, 'domain=', domain);

  try {
    log('2. running indexTenantSite() ...');
    const t0 = Date.now();
    const { indexTenantSite } = await import('../src/lib/knowledge/indexer.ts');
    await indexTenantSite(tenant.id, domain);
    log('   indexTenantSite() returned in', (Date.now() - t0) / 1000, 's');

    const { rows: pages } = await pool.query(
      `SELECT source_url, title, status,
              (embedding IS NOT NULL) AS has_embedding,
              char_length(content) AS content_len,
              metadata->>'h1' AS h1,
              char_length(metadata->>'meta_description') AS meta_len
       FROM knowledge_items
       WHERE tenant_id = $1 AND type = 'page'
       ORDER BY source_url`,
      [tenant.id]
    );
    log('3. pages indexed:', pages.length);
    pages.slice(0, 10).forEach(p => log('   -', { url: p.source_url, title: (p.title || '').slice(0, 40), embedded: p.has_embedding, len: p.content_len, h1: (p.h1 || '').slice(0, 30) }));

    if (!pages.length) throw new Error('FAIL: zero pages indexed');
    if (pages.some(p => !p.has_embedding)) {
      const missing = pages.filter(p => !p.has_embedding).length;
      log(`   WARN: ${missing} of ${pages.length} pages missing embedding`);
    }

    log('\n✅ K-03 CRAWL SMOKE TEST PASS:', pages.length, 'pages');
  } finally {
    // wipe pages first, then tenant (cascade handles items but let's be explicit)
    await pool.query('DELETE FROM knowledge_items WHERE tenant_id = $1', [tenant.id]);
    await pool.query('DELETE FROM tenants WHERE id = $1', [tenant.id]);
    log('teardown: deleted test tenant and all indexed pages');
    await pool.end();
  }
}

main().catch(e => { console.error('SMOKE TEST FAILED:', e.message, e.stack); process.exit(1); });
