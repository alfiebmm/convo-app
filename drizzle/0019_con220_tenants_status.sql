-- CON-220 / ADMIN-4: tenant lifecycle status for platform-admin surfaces.
--
-- New enum is created before the tenants.status column references it. This
-- migration does not use ALTER TYPE ADD VALUE, so it avoids the Drizzle
-- single-transaction 55P04 production failure mode.

CREATE TYPE "public"."tenant_status" AS ENUM('active', 'suspended', 'deleted_soft');
--> statement-breakpoint

ALTER TABLE tenants
  ADD COLUMN status "public"."tenant_status" NOT NULL DEFAULT 'active',
  ADD COLUMN suspended_at timestamptz,
  ADD COLUMN suspended_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN suspended_reason text,
  ADD COLUMN soft_deleted_at timestamptz,
  ADD COLUMN soft_deleted_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN soft_deleted_reason text;
--> statement-breakpoint
