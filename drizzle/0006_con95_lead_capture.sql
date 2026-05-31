-- CON-95 / C-06: lead capture & detection.
--
-- One additive schema change on `conversations`:
--
--   follow_up_type varchar(20) (nullable)
--      Distinguishes the *kind* of follow-up a conversation needs. Pairs with
--      the existing `needs_followup` boolean (CON-45 / drizzle 0001).
--      Initial values: 'lead' | 'manual' | NULL.
--      Nullable + no default so existing rows are unaffected.
--
-- All other lead data (contact name/email/phone, summary, status,
-- detection trail) lives inside `conversations.metadata` under the
-- `lead` jsonb block. This mirrors the precedent set by CON-94 which
-- stores qualifying-questions state under `metadata.qualifying`.
--
-- Rationale for jsonb-over-columns:
--   * `metadata` is already NOT NULL with default '{}' — no row backfill.
--   * Bundles all PII in one place for redaction / scrubbing tooling.
--   * Allows shape evolution (v2 fields, extra signals) without further
--     migrations.
--
-- No new table is introduced. A `Lead` is not a first-class entity in v1
-- — it is a flagged conversation. If admins later need cross-tenant or
-- standalone lead exports, a derived view or table can be added in v2.
--
-- Reversible via:
--   ALTER TABLE conversations DROP COLUMN follow_up_type;

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS follow_up_type VARCHAR(20);

COMMENT ON COLUMN conversations.follow_up_type IS
  'CON-95 follow-up category. NULL when no follow-up required. ''lead'' when a Lead was captured via /api/chat detection. ''manual'' reserved for future use.';
