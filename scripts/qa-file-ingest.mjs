/**
 * Smoke test for the K-05 file upload + ingestion pipeline.
 *
 * Mirrors the production route logic against the same Supabase backend, but
 * skips NextAuth so we can validate the data path before merging the PR.
 *
 * Steps:
 *   1. Create a throwaway test tenant.
 *   2. Upload a small TXT file to the knowledge-files storage bucket.
 *   3. Insert the knowledge_files row.
 *   4. Run the actual ingestFile() function from src/lib/knowledge/file-ingest.
 *   5. Verify knowledge_items rows landed with embeddings.
 *   6. Hit the DELETE path and verify cascade.
 *   7. Tear down the test tenant.
 */
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { createClient } from '@supabase/supabase-js';

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB_URL = process.env.DATABASE_URL;

const supa = createClient(SUPA_URL, SUPA_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });

const log = (...a) => console.log(...a);

async function main() {
  // 1. test tenant
  const slug = `qa-k05-${Date.now().toString(36)}`;
  const { rows: [tenant] } = await pool.query(
    "INSERT INTO tenants (name, slug, domain) VALUES ($1, $2, $3) RETURNING id, slug",
    ['QA K05 Smoke Test', slug, null]
  );
  log('1. created test tenant:', tenant.slug, tenant.id);

  try {
    // 2. read test file
    const buffer = readFileSync('scripts/fixtures/qa-knowledge-smoke.txt');
    const fileId = randomUUID();
    const storagePath = `tenants/${tenant.id}/${fileId}-test-convo.txt`;

    // 3. upload to storage
    const up = await supa.storage.from('knowledge-files').upload(storagePath, buffer, {
      contentType: 'text/plain',
      upsert: false,
    });
    if (up.error) throw new Error('Storage upload failed: ' + up.error.message);
    log('2. uploaded to storage at', storagePath);

    // 4. insert knowledge_files row
    await pool.query(
      `INSERT INTO knowledge_files (id, tenant_id, original_filename, mime_type, byte_size, storage_path, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
      [fileId, tenant.id, 'test-convo.txt', 'text/plain', buffer.length, storagePath]
    );
    log('3. inserted knowledge_files row, fileId=', fileId);

    // 5. Run the actual ingestion. Use a tsx loader so we can import the TS source.
    log('4. running ingestFile() ...');
    const { ingestFile } = await import('../src/lib/knowledge/file-ingest.ts');
    await ingestFile(fileId);
    log('   ingestFile() returned');

    // 6. verify
    const { rows: fileRows } = await pool.query(
      'SELECT status, indexed_at, error_message FROM knowledge_files WHERE id = $1',
      [fileId]
    );
    log('5. file status after ingest:', fileRows[0]);

    const { rows: chunks } = await pool.query(
      `SELECT id, type, parent_id, content_hash, status,
              (embedding IS NOT NULL) AS has_embedding,
              jsonb_extract_path(metadata, 'chunk_index') AS chunk_index,
              char_length(content) AS content_len
       FROM knowledge_items WHERE parent_id = $1 ORDER BY (metadata->>'chunk_index')::int`,
      [fileId]
    );
    log('6. chunks inserted:', chunks.length);
    chunks.forEach(c => log('   -', { chunk: c.chunk_index, type: c.type, status: c.status, len: c.content_len, embedded: c.has_embedding }));

    if (!chunks.length) throw new Error('FAIL: zero chunks inserted');
    if (chunks.some(c => !c.has_embedding)) throw new Error('FAIL: at least one chunk missing embedding');
    if (fileRows[0].status !== 'indexed') throw new Error(`FAIL: file status is ${fileRows[0].status}, expected indexed`);

    // 7. cascade delete check
    log('7. testing cascade delete...');
    await supa.storage.from('knowledge-files').remove([storagePath]);
    await pool.query('DELETE FROM knowledge_files WHERE id = $1', [fileId]);
    const { rows: afterDelete } = await pool.query('SELECT COUNT(*)::int AS n FROM knowledge_items WHERE parent_id = $1', [fileId]);
    log('   chunks remaining after delete:', afterDelete[0].n);
    if (afterDelete[0].n !== 0) throw new Error('FAIL: cascade did not delete chunks');

    log('\n✅ K-05 INGESTION SMOKE TEST PASS');
  } finally {
    // teardown
    await pool.query('DELETE FROM tenants WHERE id = $1', [tenant.id]);
    log('teardown: deleted test tenant');
    await pool.end();
  }
}

main().catch(e => { console.error('SMOKE TEST FAILED:', e.message, e.stack); process.exit(1); });
