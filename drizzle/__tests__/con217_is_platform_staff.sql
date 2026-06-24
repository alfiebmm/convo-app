-- CON-217 smoke test for public.is_platform_staff().
-- Run against a disposable database after applying migrations 0000-0015.

BEGIN;

INSERT INTO users (id, email, is_platform_staff)
VALUES
  ('00000000-0000-0000-0000-000000000217', 'staff@example.com', true),
  ('00000000-0000-0000-0000-000000000218', 'tenant@example.com', false)
ON CONFLICT (email) DO UPDATE
SET is_platform_staff = EXCLUDED.is_platform_staff;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000217"}',
  true
);

DO $$
BEGIN
  IF public.is_platform_staff() IS NOT TRUE THEN
    RAISE EXCEPTION 'expected staff user to pass';
  END IF;
END $$;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000218"}',
  true
);

DO $$
BEGIN
  IF public.is_platform_staff() IS NOT FALSE THEN
    RAISE EXCEPTION 'expected non-staff user to fail';
  END IF;
END $$;

ROLLBACK;
