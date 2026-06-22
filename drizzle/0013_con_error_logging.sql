-- CON-error-logging: in-app dashboard error capture.
--
-- Two production 500s (digests `1644138080` and `2442540290`) aged out of
-- Vercel's free-tier runtime log retention before we could pull stack traces.
-- Cam vetoed external log sinks (Better Stack etc.). This table is the
-- permanent in-app replacement: every dashboard server-component / dashboard
-- API-handler exception is captured here at the route boundary before being
-- rethrown so Next.js's error.tsx still renders for the user.
--
-- Privacy posture:
--   - No request bodies. No auth tokens. No emails / names / phone numbers.
--   - `request_meta` is sanitised at write time (see `src/lib/errors/log.ts`)
--     and only allow-lists method + sanitised search-param keys + a small
--     set of routing headers (`x-vercel-id`, `cf-ray`, `user-agent`).
--   - `user_id` and `tenant_id` are stored so we can correlate to staff
--     dashboards, NOT to visitors. They reference staff tables, not the
--     widget visitor space.
--
-- Tenancy posture (matches CON-184 / CON-185 baseline):
--   - RLS enabled. NO tenant policies (deny-all to `anon` / `authenticated`).
--   - All writes happen via the server-side service-role Supabase client.
--
-- Operational notes (PR-time, NOT prod-time):
--   - This migration is dev/preview only in this PR.
--   - Prod apply is a separate Blake-gated step. The PR description carries
--     the exact `psql` command to run against the prod DATABASE_URL when
--     Blake approves the rollout.

CREATE TABLE IF NOT EXISTS dashboard_errors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Vercel error digest hash. NOT a UUID — it's the short numeric hash
  -- Vercel surfaces in the public 500 page, e.g. `1644138080`. We index
  -- it so PM can paste a digest from Linear and find the captured row.
  digest        TEXT,
  -- e.g. "TypeError", "PostgresError", "Error". Pulled from
  -- `err.constructor.name` at log time.
  error_class   TEXT,
  message       TEXT,
  stack         TEXT,
  -- e.g. "/dashboard/contacts/[contactId]", "/api/cases/[caseId]". Stored
  -- as the route template, not the resolved URL, so a single bug rolls up
  -- across contact ids.
  route         TEXT,
  -- Staff identifiers. Nullable because client-side error-boundary POSTs
  -- without a server-resolved session may not carry a user_id, and dashboard
  -- pages that throw before resolving the active tenant won't have a tenant_id.
  user_id       UUID REFERENCES users(id)   ON DELETE SET NULL,
  tenant_id     UUID REFERENCES tenants(id) ON DELETE SET NULL,
  -- Sanitised request metadata. See `src/lib/errors/log.ts` for the
  -- exact allow-list. Default `{}` so consumers can `obj.method` safely.
  request_meta  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS dashboard_errors_digest_idx
  ON dashboard_errors (digest);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS dashboard_errors_created_at_idx
  ON dashboard_errors (created_at DESC);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS dashboard_errors_route_created_at_idx
  ON dashboard_errors (route, created_at DESC);
--> statement-breakpoint

ALTER TABLE dashboard_errors ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- Belt-and-braces revoke (matches CON-185 default-privileges posture). With
-- RLS enabled and no policies, anon/authenticated have no read or write
-- access regardless. Service role bypasses RLS and is the only writer.
REVOKE ALL ON TABLE dashboard_errors FROM anon, authenticated;
--> statement-breakpoint

COMMENT ON TABLE dashboard_errors IS
  'CON-error-logging: in-app capture of dashboard server-component / dashboard API-handler exceptions. Writes only via the server-side service-role Supabase client. RLS enabled, no tenant policies (deny-all to anon/authenticated). Sanitised: no bodies, no PII, no auth tokens.';
--> statement-breakpoint

COMMENT ON COLUMN dashboard_errors.digest IS
  'Vercel error digest (e.g. `1644138080`), if known. Indexed for paste-from-Linear lookups.';
--> statement-breakpoint

COMMENT ON COLUMN dashboard_errors.route IS
  'Route template (e.g. `/dashboard/contacts/[contactId]`), not the resolved URL. Lets a bug roll up across instances.';
--> statement-breakpoint

COMMENT ON COLUMN dashboard_errors.request_meta IS
  'Sanitised request metadata. Allow-list only — see src/lib/errors/log.ts. No bodies, no PII headers, no auth.';
