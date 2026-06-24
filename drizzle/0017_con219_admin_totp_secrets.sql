-- CON-219 / ADMIN-3: platform-admin TOTP enrolment, challenge attempts, and lockout state.
--
-- TOTP secrets are AES-256-GCM encrypted in application code before insert.
-- Recovery codes are Argon2id hashes stored as a JSON array.

ALTER TABLE users
  ADD COLUMN totp_enrolled_at TIMESTAMPTZ,
  ADD COLUMN locked_until TIMESTAMPTZ;
--> statement-breakpoint

CREATE TABLE admin_totp_secrets (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  secret_encrypted TEXT NOT NULL,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recovery_codes_hashed JSONB NOT NULL,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE admin_totp_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  success BOOLEAN NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip INET
);
--> statement-breakpoint

CREATE INDEX admin_totp_attempts_user_attempted_idx
  ON admin_totp_attempts (user_id, attempted_at DESC);
--> statement-breakpoint

ALTER TABLE admin_totp_secrets ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE admin_totp_attempts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY admin_totp_secrets_insert_platform_staff
  ON admin_totp_secrets
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_platform_staff());
--> statement-breakpoint

CREATE POLICY admin_totp_secrets_select_platform_staff
  ON admin_totp_secrets
  FOR SELECT
  TO authenticated
  USING (public.is_platform_staff());
--> statement-breakpoint

CREATE POLICY admin_totp_secrets_update_platform_staff
  ON admin_totp_secrets
  FOR UPDATE
  TO authenticated
  USING (public.is_platform_staff())
  WITH CHECK (public.is_platform_staff());
--> statement-breakpoint

CREATE POLICY admin_totp_secrets_delete_platform_staff
  ON admin_totp_secrets
  FOR DELETE
  TO authenticated
  USING (public.is_platform_staff());
--> statement-breakpoint

CREATE POLICY admin_totp_attempts_insert_platform_staff
  ON admin_totp_attempts
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_platform_staff());
--> statement-breakpoint

CREATE POLICY admin_totp_attempts_select_platform_staff
  ON admin_totp_attempts
  FOR SELECT
  TO authenticated
  USING (public.is_platform_staff());
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON admin_totp_secrets TO authenticated;
--> statement-breakpoint

GRANT SELECT, INSERT ON admin_totp_attempts TO authenticated;
--> statement-breakpoint

REVOKE UPDATE, DELETE ON admin_totp_attempts FROM service_role, authenticated, anon;
--> statement-breakpoint

COMMENT ON TABLE admin_totp_secrets IS
  'CON-219 platform-admin TOTP secrets. Secrets are encrypted at rest; recovery codes are Argon2id hashes.';
--> statement-breakpoint

COMMENT ON TABLE admin_totp_attempts IS
  'CON-219 append-only platform-admin MFA challenge attempts for lockout checks.';
--> statement-breakpoint
