-- CON-162 / Epic B3: connector_outbox migration.
--
-- The connector outbox is the durable hand-off surface between follow-up
-- cases (CON-161) and downstream integrations (email, CRM, Slack, custom
-- webhook, etc). The retry worker reads from this table; producers write to
-- it; delivered/failed rows stay around for audit.
--
-- Design choices for v1:
--   - One row per (case_id, idempotency_key) write attempt. The unique
--     constraint is on (tenant_id, idempotency_key) — same idempotency key
--     can exist across tenants but is unique within a tenant. This matches
--     the spec and lets producers reuse keys per their own conventions.
--   - `payload_version` is a top-level column (not just inside the JSONB)
--     so the worker can route to the right schema-evolution handler without
--     parsing payload first.
--   - `status` is an enum because the PRD specifies that set concretely:
--     pending | sent | failed | abandoned. Other fields stay string-backed
--     for v1 flexibility (connector_type, destination_id).
--   - `(status, next_attempt_at)` is the worker's retry-scan index. Kept
--     non-partial so the worker can `WHERE status = 'pending' AND
--     next_attempt_at <= now()` cleanly.
--
-- As with the rest of the app, RLS is enabled but tenant policies are not
-- added here yet. App reads/writes flow through server-side service-role
-- queries; this migration just ensures the baseline stays locked. The
-- ticket's "RLS-locked to service_role" criterion is met by enabling RLS
-- with no anon/authenticated SELECT policies (default deny).

CREATE TYPE connector_outbox_status AS ENUM (
  'pending',
  'sent',
  'failed',
  'abandoned'
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS connector_outbox (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  case_id          UUID NOT NULL REFERENCES follow_up_cases(id) ON DELETE CASCADE,
  connector_type   VARCHAR(50) NOT NULL,
  destination_id   VARCHAR(255),
  payload_version  VARCHAR(20) NOT NULL,
  payload          JSONB NOT NULL,
  status           connector_outbox_status NOT NULL DEFAULT 'pending',
  attempt_count    INTEGER NOT NULL DEFAULT 0,
  last_error       TEXT,
  next_attempt_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at     TIMESTAMPTZ,
  idempotency_key  VARCHAR(255) NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS connector_outbox_tenant_idempotency_unique
  ON connector_outbox (tenant_id, idempotency_key);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS connector_outbox_status_next_attempt_idx
  ON connector_outbox (status, next_attempt_at);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS connector_outbox_tenant_case_idx
  ON connector_outbox (tenant_id, case_id);
--> statement-breakpoint

ALTER TABLE connector_outbox ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

COMMENT ON TABLE connector_outbox IS
  'CON-162 durable outbox of follow-up case deliveries to downstream connectors. Producer writes, retry worker reads, delivered/failed rows kept for audit.';
