import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const slug = process.argv[2] || 'doggo';
const { rows } = await pool.query(
  'SELECT id, slug, domain FROM tenants WHERE slug = $1',
  [slug]
);
if (!rows.length) {
  console.error('no tenant for slug', slug);
  process.exit(1);
}
const t = rows[0];
console.log('crawling', t.slug, 'domain=', t.domain);

await pool.query(
  "DELETE FROM knowledge_items WHERE tenant_id = $1 AND type = 'page'",
  [t.id]
);

const { indexTenantSite } = await import('../src/lib/knowledge/indexer.ts');

const t0 = Date.now();
try {
  await indexTenantSite(t.id, t.domain);
  console.log('completed in', ((Date.now() - t0) / 1000).toFixed(1), 's');
} catch (e) {
  console.error('crawl error:', e.message, e.stack);
}

const after = await pool.query(
  `SELECT COUNT(DISTINCT source_url)::int AS pages, COUNT(*)::int AS chunks
     FROM knowledge_items WHERE tenant_id=$1 AND type='page'`,
  [t.id]
);
console.log('result:', after.rows[0]);
await pool.end();
