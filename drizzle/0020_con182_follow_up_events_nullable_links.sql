-- CON-182: allow tenant-wide audit events (export, login, etc.) by dropping
-- NOT NULL on follow_up_events.case_id and follow_up_events.conversation_id.
--
-- The original 0010 migration required both columns because every event was
-- tied to a case/conversation. The audit log surface (CON-182) needs to
-- record tenant-scoped events that have no case or conversation context
-- (e.g. an audit-log CSV export, a privacy-notice version shown on the
-- marketing site, a future login event). FK + ON DELETE CASCADE behaviour
-- is unchanged — rows still cascade when the linked case/conversation is
-- deleted, but neither column is required at insert time.
--
-- Safe to apply on prod: existing rows are unaffected (all current rows
-- have non-null case_id + conversation_id from the CON-45 backfill).

ALTER TABLE follow_up_events ALTER COLUMN case_id DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE follow_up_events ALTER COLUMN conversation_id DROP NOT NULL;
