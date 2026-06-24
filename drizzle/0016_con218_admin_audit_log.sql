-- CON-218 / ADMIN-2: append-only platform-admin audit log.
--
-- Actions are recorded as intent -> outcome rows linked by correlation_id.
-- There are intentionally no UPDATE or DELETE policies.

CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NOT NULL REFERENCES users(id),
  actor_email TEXT NOT NULL,
  actor_ip INET,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  status TEXT NOT NULL,
  before_state JSONB,
  after_state JSONB,
  metadata JSONB,
  reason TEXT,
  support_context TEXT,
  correlation_id UUID NOT NULL,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT admin_audit_log_status_check CHECK (
    status IN ('intent', 'outcome:success', 'outcome:error')
  ),
  CONSTRAINT admin_audit_log_sensitive_reason_check CHECK (
    reason IS NOT NULL
    OR action NOT IN (
      'impersonation.start',
      'billing.refund',
      'billing.credit',
      'billing.change_plan',
      'billing.cancel',
      'tenant.suspend',
      'tenant.soft_delete',
      'user.force_reauth',
      'user.soft_delete',
      'tenant.pii_reveal',
      'tenant.settings_edit'
    )
  )
);
--> statement-breakpoint

CREATE UNIQUE INDEX admin_audit_log_intent_idempotency_unique
  ON admin_audit_log (actor_user_id, action, target_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND status = 'intent';
--> statement-breakpoint

CREATE INDEX admin_audit_log_correlation_idx
  ON admin_audit_log (correlation_id);
--> statement-breakpoint

CREATE INDEX admin_audit_log_action_created_idx
  ON admin_audit_log (action, created_at DESC);
--> statement-breakpoint

CREATE INDEX admin_audit_log_target_created_idx
  ON admin_audit_log (target_type, target_id, created_at DESC);
--> statement-breakpoint

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY admin_audit_log_insert_platform_staff
  ON admin_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_platform_staff());
--> statement-breakpoint

CREATE POLICY admin_audit_log_select_platform_staff
  ON admin_audit_log
  FOR SELECT
  TO authenticated
  USING (public.is_platform_staff());
--> statement-breakpoint

GRANT SELECT, INSERT ON admin_audit_log TO authenticated;
--> statement-breakpoint

REVOKE UPDATE, DELETE ON admin_audit_log FROM service_role, authenticated, anon;
--> statement-breakpoint

COMMENT ON TABLE admin_audit_log IS
  'CON-218 append-only platform-admin audit log. Intent and outcome rows are linked by correlation_id.';
--> statement-breakpoint
