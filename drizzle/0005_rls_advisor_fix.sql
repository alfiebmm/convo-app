-- CON-184: Enable Row Level Security on tables flagged by Supabase Security Advisor.
--
-- The Security Advisor `rls_disabled_in_public` lint flagged four tables in
-- the `public` schema where RLS was never enabled when the table was created.
-- This was an authoring oversight in migrations `0002` and `0004` — migration
-- `0000` correctly set RLS on the core tables.
--
-- Affected tables (all created via Drizzle without RLS):
--
--   1. knowledge_files   (migration 0002)
--   2. knowledge_items   (migration 0002)
--   3. site_sync_jobs    (migration 0004)
--   4. site_sync_urls    (migration 0004)
--
-- No policies are created. With RLS enabled and no policies, the default is
-- DENY for all non-superuser / non-service roles. This matches the existing
-- convention used by `0000_numerous_grandmaster.sql` for the core tables and
-- by `platform_injection_events` in the CON-98 migration (still on a feature
-- branch at time of writing).
--
-- Service role (used by the Next.js server for every write) bypasses RLS by
-- definition, so application behaviour is unchanged. The anon role — which
-- Convo does not currently ship to clients — is now correctly denied access
-- to these four tables as well.
--
-- Reversible via `ALTER TABLE … DISABLE ROW LEVEL SECURITY` (no data impact).

ALTER TABLE knowledge_files  ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_sync_jobs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_sync_urls   ENABLE ROW LEVEL SECURITY;
