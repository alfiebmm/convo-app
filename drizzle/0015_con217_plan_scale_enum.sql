-- CON-217 / ADMIN-1: align tenant plans with the public pricing model.
--
-- Final enum shape: starter | growth | scale.
-- Legacy `pro` rows are backfilled to `scale`. The original base migration
-- also included `enterprise`; if any historical rows exist, they are folded
-- into `scale` before the enum is rebuilt.

ALTER TABLE tenants ALTER COLUMN plan DROP DEFAULT;
--> statement-breakpoint

UPDATE tenants
SET plan = 'scale'
WHERE plan::text IN ('pro', 'enterprise');
--> statement-breakpoint

CREATE TYPE "public"."plan_new" AS ENUM('starter', 'growth', 'scale');
--> statement-breakpoint

ALTER TABLE tenants
  ALTER COLUMN plan TYPE "public"."plan_new"
  USING plan::text::"public"."plan_new";
--> statement-breakpoint

DROP TYPE "public"."plan";
--> statement-breakpoint

ALTER TYPE "public"."plan_new" RENAME TO "plan";
--> statement-breakpoint

ALTER TABLE tenants ALTER COLUMN plan SET DEFAULT 'starter';
--> statement-breakpoint
