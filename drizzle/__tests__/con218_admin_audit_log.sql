-- CON-218 smoke tests for admin_audit_log append-only and reason checks.
-- Run against a disposable database after applying migrations 0000-0016.

BEGIN;

INSERT INTO users (id, email, is_platform_staff)
VALUES ('00000000-0000-0000-0000-000000000218', 'admin218@example.com', true)
ON CONFLICT (email) DO UPDATE
SET is_platform_staff = EXCLUDED.is_platform_staff;

INSERT INTO admin_audit_log (
  actor_user_id,
  actor_email,
  action,
  target_type,
  target_id,
  status,
  reason,
  correlation_id
)
VALUES (
  '00000000-0000-0000-0000-000000000218',
  'admin218@example.com',
  'tenant.suspend',
  'tenant',
  'tenant-a',
  'intent',
  'Support-requested suspension',
  '00000000-0000-0000-0000-000000000219'
);

SET LOCAL ROLE service_role;

DO $$
BEGIN
  UPDATE admin_audit_log
  SET metadata = '{"bad":true}'::jsonb
  WHERE correlation_id = '00000000-0000-0000-0000-000000000219';
  RAISE EXCEPTION 'expected UPDATE to fail for service_role';
EXCEPTION
  WHEN insufficient_privilege THEN
    NULL;
END $$;

DO $$
BEGIN
  DELETE FROM admin_audit_log
  WHERE correlation_id = '00000000-0000-0000-0000-000000000219';
  RAISE EXCEPTION 'expected DELETE to fail for service_role';
EXCEPTION
  WHEN insufficient_privilege THEN
    NULL;
END $$;

RESET ROLE;

DO $$
BEGIN
  INSERT INTO admin_audit_log (
    actor_user_id,
    actor_email,
    action,
    target_type,
    target_id,
    status,
    correlation_id
  )
  VALUES (
    '00000000-0000-0000-0000-000000000218',
    'admin218@example.com',
    'billing.refund',
    'invoice',
    'in_123',
    'intent',
    '00000000-0000-0000-0000-000000000220'
  );
  RAISE EXCEPTION 'expected sensitive action without reason to fail';
EXCEPTION
  WHEN check_violation THEN
    NULL;
END $$;

ROLLBACK;
