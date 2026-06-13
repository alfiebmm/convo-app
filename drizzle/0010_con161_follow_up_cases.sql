-- CON-161 / Epic B2: follow-up cases, attributes, and events.
--
-- Case-side foundation for configurable follow-up. This migration adds:
--   - `follow_up_cases`: the tenant inbox's actionable record.
--   - `follow_up_case_attributes`: current structured attributes keyed by case.
--   - `follow_up_events`: immutable case audit timeline.
--
-- Key invariant from the PRD / Cam lock-in:
--   - A case MAY exist without a contact. `contact_id` stays nullable so
--     silent-review paths can create staff-visible cases without capturing
--     personal details.
--
-- Design choices for v1:
--   - One case per `(tenant_id, conversation_id)` via unique index. This
--     matches the current lifecycle TODO, which upserts by conversation.
--   - `follow_up_case_attributes` uses `(case_id, key)` as its primary key so
--     the lifecycle can upsert the latest classifier snapshot per attribute.
--   - `case_type`, `priority`, `source`, `actor_type`, and `event_type` stay
--     string-backed for v1 flexibility; only case `status` is an enum because
--     the PRD specifies that set concretely.
--
-- As with the rest of the app, RLS is enabled but tenant policies are not
-- added here yet. App reads/writes currently flow through server-side
-- service-role queries; this migration just ensures the baseline stays locked.

CREATE TYPE follow_up_case_status AS ENUM (
  'open',
  'in_progress',
  'waiting_on_customer',
  'resolved',
  'dismissed'
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS follow_up_cases (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id       UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  contact_id            UUID REFERENCES contacts(id) ON DELETE SET NULL,
  case_type             VARCHAR(50) NOT NULL,
  status                follow_up_case_status NOT NULL DEFAULT 'open',
  priority              VARCHAR(20),
  routing_key           VARCHAR(100),
  title                 TEXT,
  summary               TEXT,
  reason                TEXT,
  source                VARCHAR(50),
  rule_id               VARCHAR(100),
  classifier_confidence REAL,
  assigned_to           UUID REFERENCES users(id) ON DELETE SET NULL,
  external_system       VARCHAR(50),
  external_id           VARCHAR(255),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at           TIMESTAMPTZ
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS follow_up_cases_tenant_conversation_unique
  ON follow_up_cases (tenant_id, conversation_id);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS follow_up_cases_tenant_status_idx
  ON follow_up_cases (tenant_id, status);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS follow_up_cases_tenant_case_type_idx
  ON follow_up_cases (tenant_id, case_type);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS follow_up_cases_tenant_contact_idx
  ON follow_up_cases (tenant_id, contact_id);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS follow_up_cases_tenant_assigned_idx
  ON follow_up_cases (tenant_id, assigned_to);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS follow_up_case_attributes (
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  case_id     UUID NOT NULL REFERENCES follow_up_cases(id) ON DELETE CASCADE,
  key         VARCHAR(100) NOT NULL,
  value       JSONB NOT NULL,
  source      VARCHAR(50),
  confidence  REAL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (case_id, key)
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS follow_up_case_attributes_tenant_case_idx
  ON follow_up_case_attributes (tenant_id, case_id);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS follow_up_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  case_id         UUID NOT NULL REFERENCES follow_up_cases(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  actor_type      VARCHAR(50) NOT NULL,
  actor_id        VARCHAR(255),
  event_type      VARCHAR(100) NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS follow_up_events_tenant_case_idx
  ON follow_up_events (tenant_id, case_id);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS follow_up_events_tenant_conversation_idx
  ON follow_up_events (tenant_id, conversation_id);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS follow_up_events_event_type_idx
  ON follow_up_events (event_type);
--> statement-breakpoint

ALTER TABLE follow_up_cases ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE follow_up_case_attributes ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE follow_up_events ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

COMMENT ON TABLE follow_up_cases IS
  'CON-161 actionable tenant-scoped follow-up records for inbox, routing, and external handoff.';
--> statement-breakpoint

COMMENT ON TABLE follow_up_case_attributes IS
  'CON-161 latest structured classifier/rule attributes for a follow-up case, keyed by case + attribute name.';
--> statement-breakpoint

COMMENT ON TABLE follow_up_events IS
  'CON-161 immutable case audit timeline for classifier, staff, and connector events.';
