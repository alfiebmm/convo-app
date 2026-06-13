-- CON-160 / Epic B1: contacts + identifiers + conversation links.
--
-- Contact-side foundation for configurable follow-up. This migration is
-- intentionally narrow:
--   - `contacts` stores the tenant-scoped durable person/company record.
--   - `contact_identifiers` stores multiple normalised identifiers for later
--     dedupe/upsert (email/phone first, other channels later).
--   - `conversation_contacts` links conversations to contacts without
--     changing the existing `conversations` row shape.
--
-- Follow-up cases, attributes, events, and connector outbox land in later
-- Epic B tickets (CON-161 / CON-162 / CON-163 / CON-164). Keeping this
-- migration contact-only reduces rollout risk and keeps the next tickets'
-- seams clean.
--
-- Privacy / tenancy posture:
--   - Every table is tenant-scoped and additive only.
--   - RLS is enabled on all three tables to match the project's locked-down
--     baseline. No tenant policies are added in this migration because the
--     app currently reads/writes through server-side service-role queries.
--   - `contact_identifiers` enforces tenant-scoped uniqueness on
--     `(tenant_id, type, value_normalised)` so cross-tenant collisions are
--     allowed while same-tenant duplicates are rejected.

CREATE TABLE IF NOT EXISTS contacts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  display_name            VARCHAR(255),
  email_normalised        VARCHAR(320),
  phone_normalised        VARCHAR(64),
  preferred_contact_method VARCHAR(50),
  attributes              JSONB NOT NULL DEFAULT '{}'::jsonb,
  consent_state           VARCHAR(50),
  privacy_notice_version  VARCHAR(100),
  first_seen_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS contacts_tenant_email_idx
  ON contacts (tenant_id, email_normalised);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS contacts_tenant_phone_idx
  ON contacts (tenant_id, phone_normalised);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS contacts_tenant_display_name_idx
  ON contacts (tenant_id, display_name);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS contact_identifiers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id       UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  type             VARCHAR(50) NOT NULL,
  value_normalised TEXT NOT NULL,
  verified_at      TIMESTAMPTZ,
  source           VARCHAR(50),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS contact_identifiers_tenant_type_value_unique
  ON contact_identifiers (tenant_id, type, value_normalised);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS contact_identifiers_contact_idx
  ON contact_identifiers (contact_id);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS contact_identifiers_tenant_contact_idx
  ON contact_identifiers (tenant_id, contact_id);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS conversation_contacts (
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  contact_id      UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  relationship    VARCHAR(50) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, contact_id)
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS conversation_contacts_tenant_conversation_idx
  ON conversation_contacts (tenant_id, conversation_id);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS conversation_contacts_tenant_contact_idx
  ON conversation_contacts (tenant_id, contact_id);
--> statement-breakpoint

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE contact_identifiers ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE conversation_contacts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

COMMENT ON TABLE contacts IS
  'CON-160 durable tenant-scoped contact records created only after configured detail capture.';
--> statement-breakpoint

COMMENT ON TABLE contact_identifiers IS
  'CON-160 normalised identifiers for tenant-scoped contact dedupe and later connector upserts.';
--> statement-breakpoint

COMMENT ON TABLE conversation_contacts IS
  'CON-160 join table linking conversations to durable contacts.';
