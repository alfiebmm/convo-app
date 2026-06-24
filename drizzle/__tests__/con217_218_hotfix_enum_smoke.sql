-- CON-217/218 smoke test for the plan enum rebuild hotfix.
-- Runs the 0015 text-cast pattern against an isolated old enum shape.

BEGIN;

CREATE SCHEMA con217_218_hotfix_smoke;

CREATE TYPE con217_218_hotfix_smoke.plan AS ENUM (
  'starter',
  'growth',
  'pro',
  'enterprise'
);

CREATE TABLE con217_218_hotfix_smoke.tenants (
  id text PRIMARY KEY,
  plan con217_218_hotfix_smoke.plan NOT NULL DEFAULT 'starter'
);

INSERT INTO con217_218_hotfix_smoke.tenants (id, plan)
VALUES
  ('starter-row', 'starter'),
  ('growth-row', 'growth'),
  ('pro-row', 'pro'),
  ('enterprise-row', 'enterprise');

ALTER TABLE con217_218_hotfix_smoke.tenants ALTER COLUMN plan DROP DEFAULT;

CREATE TYPE con217_218_hotfix_smoke.plan_new AS ENUM (
  'starter',
  'growth',
  'scale'
);

ALTER TABLE con217_218_hotfix_smoke.tenants
  ALTER COLUMN plan TYPE con217_218_hotfix_smoke.plan_new
  USING (CASE plan::text
    WHEN 'pro' THEN 'scale'
    WHEN 'enterprise' THEN 'scale'
    ELSE plan::text
  END)::con217_218_hotfix_smoke.plan_new;

DROP TYPE con217_218_hotfix_smoke.plan;

ALTER TYPE con217_218_hotfix_smoke.plan_new RENAME TO plan;

ALTER TABLE con217_218_hotfix_smoke.tenants ALTER COLUMN plan SET DEFAULT 'starter';

DO $$
DECLARE
  enum_values text[];
  row_values text[];
  plan_default text;
BEGIN
  SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder)
  INTO enum_values
  FROM pg_enum e
  JOIN pg_type t ON t.oid = e.enumtypid
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'con217_218_hotfix_smoke'
    AND t.typname = 'plan';

  IF enum_values <> ARRAY['starter', 'growth', 'scale'] THEN
    RAISE EXCEPTION 'unexpected enum values: %', enum_values;
  END IF;

  SELECT array_agg(plan::text ORDER BY id)
  INTO row_values
  FROM con217_218_hotfix_smoke.tenants;

  IF row_values <> ARRAY['scale', 'growth', 'scale', 'starter'] THEN
    RAISE EXCEPTION 'unexpected row values: %', row_values;
  END IF;

  SELECT pg_get_expr(d.adbin, d.adrelid)
  INTO plan_default
  FROM pg_attrdef d
  JOIN pg_class c ON c.oid = d.adrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = d.adnum
  WHERE n.nspname = 'con217_218_hotfix_smoke'
    AND c.relname = 'tenants'
    AND a.attname = 'plan';

  IF plan_default <> '''starter''::con217_218_hotfix_smoke.plan' THEN
    RAISE EXCEPTION 'unexpected plan default: %', plan_default;
  END IF;
END $$;

ROLLBACK;
