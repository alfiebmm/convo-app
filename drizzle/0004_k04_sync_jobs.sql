-- K-04 / CON-86: incremental site re-sync with per-URL upsert + progress tracking.
--
-- Two new tables:
--   site_sync_jobs   - one row per re-sync run, with status + counters for UI polling
--   site_sync_urls   - per-URL work queue for the job (claim/process/done)
--
-- Per-URL upsert is enforced via a partial unique index on
-- knowledge_items(tenant_id, source_url, (metadata->>'chunk_index')) so a
-- re-sync can ON CONFLICT DO UPDATE rather than wipe-and-recrawl. This keeps
-- chat retrieval continuous during a re-sync and avoids destabilising chunk
-- IDs / embeddings for unchanged content.

-- Job status enum.
DO $$ BEGIN
  CREATE TYPE site_sync_job_status AS ENUM ('queued', 'running', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- URL queue status enum.
DO $$ BEGIN
  CREATE TYPE site_sync_url_status AS ENUM ('pending', 'processing', 'done', 'failed', 'skipped');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS site_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  status site_sync_job_status NOT NULL DEFAULT 'queued',
  pages_total INT NOT NULL DEFAULT 0,
  pages_processed INT NOT NULL DEFAULT 0,
  pages_added INT NOT NULL DEFAULT 0,
  pages_updated INT NOT NULL DEFAULT 0,
  pages_unchanged INT NOT NULL DEFAULT 0,
  pages_failed INT NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS site_sync_jobs_tenant_idx ON site_sync_jobs(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS site_sync_urls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES site_sync_jobs(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  status site_sync_url_status NOT NULL DEFAULT 'pending',
  position INT NOT NULL,
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS site_sync_urls_job_status_idx ON site_sync_urls(job_id, status);
CREATE INDEX IF NOT EXISTS site_sync_urls_job_position_idx ON site_sync_urls(job_id, position);

-- Partial unique index for per-URL chunk upsert. Storing chunk_index in
-- metadata jsonb keeps the schema flexible; the index makes it queryable
-- and enforces uniqueness so ON CONFLICT works.
CREATE UNIQUE INDEX IF NOT EXISTS knowledge_items_tenant_url_chunk_idx
  ON knowledge_items (tenant_id, source_url, ((metadata->>'chunk_index')::int))
  WHERE type = 'page' AND source_url IS NOT NULL;
