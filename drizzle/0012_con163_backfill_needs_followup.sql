-- CON-163 / Epic B4: backfill conversations.needs_followup → follow_up_cases.
--
-- Strategy (two-step, per ticket):
--
--   Step 1 (THIS migration): copy every conversation flagged needs_followup
--     into follow_up_cases as a 'cx_support' case, plus emit one
--     'case_backfilled' event per backfilled case. Leave the legacy
--     `conversations.needs_followup` / `resolved_at` / `resolved_by` columns
--     in place so the existing CON-45 Doggo/AgPages flag flow keeps reading
--     them.
--
--   Step 2 (separate ticket, after Epic E): once the new inbox UI reads
--     follow_up_cases, drop the legacy columns. Not in scope here.
--
-- Defaults applied here (per ticket spec):
--   - case_type = 'cx_support'           (safest catch-all)
--   - status    = 'resolved' if conversations.resolved_at IS NOT NULL,
--                 else 'open'
--   - reason    = 'Migrated from CON-45 manual flag'
--   - source    = 'manual'               (these were human flags)
--   - contact_id, assigned_to  = NULL    (no inference; staff can claim later)
--   - resolved_at = conversations.resolved_at  (preserve original timestamp
--                   when present, otherwise leave NULL — matches the
--                   followUpCases schema, where the column is nullable)
--
-- Idempotency:
--   `follow_up_cases` has a unique index on (tenant_id, conversation_id)
--   from CON-161 (`follow_up_cases_tenant_conversation_unique`). It is a
--   plain UNIQUE INDEX (not a UNIQUE CONSTRAINT), so the conflict target
--   below uses the column list form `(tenant_id, conversation_id)`, which
--   Postgres resolves to that unique index — a second run produces zero
--   rows.
--
--   For the event side there is no unique constraint on follow_up_events,
--   so we guard with `WHERE NOT EXISTS` keyed on (case_id, event_type =
--   'case_backfilled'). A second run skips already-emitted backfill events
--   even if someone has re-inserted into follow_up_cases out of band.
--
-- Audit:
--   Every backfilled case gets one follow_up_events row:
--     actor_type = 'system'
--     actor_id   = 'CON-163-backfill'
--     event_type = 'case_backfilled'
--     payload    = { source: 'CON-45-backfill', conversation_id: <uuid> }
--
-- RLS:
--   No schema changes here — only data inserts. RLS posture on
--   follow_up_cases / follow_up_events is unchanged (enabled, default-deny,
--   service-role flows only — same as CON-161 / CON-162).
--
-- Verification (post-deploy):
--   pre  : SELECT count(*) FROM conversations WHERE needs_followup = true;
--   post : SELECT count(*) FROM follow_up_cases
--          WHERE reason = 'Migrated from CON-45 manual flag';
--   The two counts MUST match.
--   Re-run idempotency: applying this migration twice in a row produces 0
--   new rows on the second apply.

BEGIN;

-- 1) Backfill follow_up_cases from conversations flagged needs_followup.
--    ON CONFLICT against the existing unique (tenant_id, conversation_id)
--    index makes the second run a no-op.
INSERT INTO follow_up_cases (
  tenant_id,
  conversation_id,
  contact_id,
  case_type,
  status,
  reason,
  source,
  assigned_to,
  resolved_at,
  created_at,
  updated_at
)
SELECT
  c.tenant_id,
  c.id                         AS conversation_id,
  NULL                         AS contact_id,
  'cx_support'                 AS case_type,
  CASE
    WHEN c.resolved_at IS NOT NULL THEN 'resolved'::follow_up_case_status
    ELSE 'open'::follow_up_case_status
  END                          AS status,
  'Migrated from CON-45 manual flag' AS reason,
  'manual'                     AS source,
  NULL                         AS assigned_to,
  c.resolved_at                AS resolved_at,
  now()                        AS created_at,
  now()                        AS updated_at
FROM conversations c
WHERE c.needs_followup = true
ON CONFLICT (tenant_id, conversation_id) DO NOTHING;

-- 2) Emit one follow_up_events row per backfilled case.
--    Guarded with WHERE NOT EXISTS so a re-run does not double-log.
INSERT INTO follow_up_events (
  tenant_id,
  case_id,
  conversation_id,
  actor_type,
  actor_id,
  event_type,
  payload,
  created_at
)
SELECT
  fc.tenant_id,
  fc.id                        AS case_id,
  fc.conversation_id           AS conversation_id,
  'system'                     AS actor_type,
  'CON-163-backfill'           AS actor_id,
  'case_backfilled'            AS event_type,
  jsonb_build_object(
    'source', 'CON-45-backfill',
    'conversation_id', fc.conversation_id
  )                            AS payload,
  now()                        AS created_at
FROM follow_up_cases fc
WHERE fc.reason = 'Migrated from CON-45 manual flag'
  AND NOT EXISTS (
    SELECT 1
    FROM follow_up_events fe
    WHERE fe.case_id = fc.id
      AND fe.event_type = 'case_backfilled'
  );

COMMIT;
