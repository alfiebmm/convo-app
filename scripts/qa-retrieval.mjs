/**
 * Smoke test for K-07 semantic retrieval (CON-89).
 *
 * Embeds a few real user-shaped queries and asks pgvector for the top
 * matching chunks in the live Doggo + AgPages tenants. Prints distance,
 * URL, title preview so we can eyeball relevance before shipping.
 */
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const QUERIES = {
  doggo: [
    'what is the best dog breed for an apartment',
    'how much does a golden retriever cost in australia',
    'french bulldog vs english bulldog',
    'how do I spot a puppy scam',
  ],
  'agpages-mnzk9gur': [
    'fencing services in NSW',
    'irrigation systems',
  ],
};

const { retrieveRelevantChunks } = await import('../src/lib/knowledge/retrieval.ts');

const { rows: tenants } = await pool.query(
  "SELECT id, slug FROM tenants WHERE slug = ANY($1)",
  [Object.keys(QUERIES)]
);

for (const t of tenants) {
  console.log('\n========== TENANT', t.slug, '==========');
  for (const q of QUERIES[t.slug]) {
    console.log('\nQ:', q);
    const t0 = Date.now();
    const hits = await retrieveRelevantChunks(t.id, q, { limit: 4, maxDistance: 0.7 });
    console.log(`  ${hits.length} hits in ${Date.now() - t0}ms`);
    hits.forEach((h, i) => {
      console.log(
        `  [${i + 1}] d=${h.distance.toFixed(3)} | ${h.title.slice(0, 60)}\n      ${h.sourceUrl || '(no url)'}`
      );
    });
    if (!hits.length) console.log('  (no hits within distance threshold)');
  }
}

await pool.end();
