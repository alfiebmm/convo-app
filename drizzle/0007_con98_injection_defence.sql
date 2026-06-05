-- CON-98 / C-09: silent prompt-injection defence.
--
-- Two additive schema changes:
--
--   1. users.is_platform_staff (boolean default false, nullable)
--      Gate for the new /platform-admin/injection-events stub.
--      Nullable + default false so existing rows continue to work without
--      backfill and the column is safe to roll back.
--
--   2. platform_injection_events (NEW table)
--      Audit log for every regex pre-filter match and every output-guard
--      leak detection. Convo-platform-internal: RLS enabled with NO
--      SELECT policy for `authenticated` so tenant users cannot read
--      events from this table. Service-role only.
--
-- No data is destroyed; both changes are reversible via DROP.
-- No existing routes or APIs query this table yet (placeholder dashboard
-- ships in the same PR but does not wire its data fetch).

-- ── 1. users.is_platform_staff ──────────────────────────────────────────

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_platform_staff boolean DEFAULT false;

-- ── 2. platform_injection_events ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS platform_injection_events (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id       UUID REFERENCES conversations(id) ON DELETE SET NULL,
  message_id            UUID REFERENCES messages(id) ON DELETE SET NULL,
  visitor_id            VARCHAR(255),
  pattern_matched       TEXT NOT NULL,
  raw_message_redacted  TEXT NOT NULL,
  detected_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_injection_events_tenant_idx
  ON platform_injection_events (tenant_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS platform_injection_events_detected_idx
  ON platform_injection_events (detected_at DESC);

-- ── 3. Row-Level Security ───────────────────────────────────────────────
-- This table is Convo-platform-internal and must NEVER be queryable by
-- tenant users. Enable RLS with NO SELECT/INSERT/UPDATE/DELETE policies
-- for `authenticated` or `anon` so only the `service_role` (which bypasses
-- RLS) can read or write. The chat API runs server-side under service
-- credentials, so writes succeed; tenant dashboards hit the API as
-- `authenticated` and therefore see zero rows here, ever.

ALTER TABLE platform_injection_events ENABLE ROW LEVEL SECURITY;

-- No policies are created. With RLS enabled and no policies, the default
-- is DENY for all non-superuser / non-service roles. We intentionally do
-- NOT add a tenant_id-scoped SELECT policy here; the future
-- /platform-admin/injection-events dashboard will read via service role.

COMMENT ON TABLE platform_injection_events IS
  'CON-98 audit log. Convo-platform-internal; RLS enabled with no policies. service_role only.';

COMMENT ON COLUMN platform_injection_events.pattern_matched IS
  'Stable id of the rule that fired, e.g. regex:ignore_previous or output_guard:section_header.';

COMMENT ON COLUMN platform_injection_events.raw_message_redacted IS
  'First 500 chars of the offending input with emails + long digit runs redacted. Triage only \u2014 not full PII.';
