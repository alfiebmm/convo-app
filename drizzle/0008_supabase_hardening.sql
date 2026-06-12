-- CON-185: Supabase hardening sweep V1.
--
-- Follow-on to CON-184 (RLS advisor fix, shipped 5 Jun). Three defence-in-depth
-- tightenings that close future advisor flags before they fire. None of these
-- block active threats today (service-role-only access, anon key not in use,
-- widget bundle clean, storage bucket private), but each strengthens the
-- baseline.
--
-- ---------------------------------------------------------------------------
-- 0. Backfill `ENABLE ROW LEVEL SECURITY` for 0000 tables
-- ---------------------------------------------------------------------------
--
-- RLS for the 8 tables created in `0000_numerous_grandmaster.sql` was enabled
-- out-of-band at Supabase project creation, not declaratively in the
-- migration file. Prod state is correct (verified: relrowsecurity = true for
-- all 8) but a fresh database created from `drizzle/*.sql` alone would land
-- WITHOUT RLS — reproducing exactly the CON-184 gap.
--
-- These statements are idempotent on prod (re-enabling already-enabled RLS
-- is a no-op) and make the migration set self-describing. With this in place
-- the `lint:migrations` CI guard goes green and any future contributor can
-- rebuild the schema from `drizzle/` alone and get a correctly-locked-down DB.

ALTER TABLE content         ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants         ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics          ENABLE ROW LEVEL SECURITY;
ALTER TABLE users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE widget_sessions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 1. Move `vector` extension from `public` to `extensions` schema
-- ---------------------------------------------------------------------------
--
-- Supabase's `extension_in_public` advisor flags extensions installed in the
-- `public` schema. `vector` was installed there by `0002_knowledge_items_and_files.sql`
-- (which simply ran `CREATE EXTENSION IF NOT EXISTS vector;` without a target
-- schema). Move it to the standard `extensions` schema so the advisor stays
-- green and the public namespace stays for app objects only.
--
-- Postgres updates dependent column types automatically (pg_type.typnamespace
-- follows the extension), so `knowledge_items.embedding` continues to work
-- without a schema-qualified DDL change. Both the cluster default and the
-- `postgres` role search_path already include `extensions`, so unqualified
-- references in app SQL (`vector(1536)`, the `<=>` operator, `vector_cosine_ops`)
-- continue to resolve. Dry-run on prod confirmed: same cosine distance values
-- pre- and post-move, HNSW index intact.
--
-- Reversible: `ALTER EXTENSION vector SET SCHEMA public;`.

ALTER EXTENSION vector SET SCHEMA extensions;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 2. Revoke `anon` + `authenticated` direct table grants on `public.*`
-- ---------------------------------------------------------------------------
--
-- Supabase auto-grants every `public.*` table to both `anon` and
-- `authenticated` at table-creation time. With RLS enabled and no policies
-- (current state for all 8 public tables — see CON-184 + 0000), those grants
-- are blocked by RLS regardless, so removing them is belt-and-braces, not a
-- behaviour change.
--
-- The default-privilege rewrite then prevents the next freshly-created table
-- from re-acquiring those grants. Future tables stay locked down by default;
-- if a tenant-facing read path ever needs anon/authenticated access, it must
-- be granted explicitly and paired with RLS policies (which is how it should
-- be designed anyway).
--
-- Service role is unaffected — it bypasses RLS and is the role the Next.js
-- server uses for every query. App behaviour unchanged.
--
-- Reversible: re-grant via standard `GRANT ... TO anon, authenticated;`.

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
--> statement-breakpoint

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Verification queries (run manually post-apply)
-- ---------------------------------------------------------------------------
--
--   -- vector lives in extensions:
--   select extname, extnamespace::regnamespace
--     from pg_extension where extname = 'vector';
--   -- expect: vector | extensions
--
--   -- anon + authenticated have zero grants on public.*:
--   select grantee, count(*)
--     from information_schema.role_table_grants
--    where table_schema = 'public'
--      and grantee in ('anon', 'authenticated')
--    group by grantee;
--   -- expect: 0 rows
--
--   -- pgvector retrieval still works:
--   select id from knowledge_items
--    where embedding is not null
--    order by embedding <=> (select embedding from knowledge_items
--                            where embedding is not null limit 1)
--    limit 1;
--   -- expect: returns an id without error
