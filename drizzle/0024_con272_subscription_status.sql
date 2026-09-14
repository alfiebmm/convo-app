-- CON-272: Stripe subscription status tracking.
--
-- Records Stripe's subscription lifecycle state and the current renewal /
-- period-end timestamp on each tenant.

DO $$ BEGIN
  CREATE TYPE "public"."subscription_status" AS ENUM (
    'trialing',
    'active',
    'past_due',
    'canceled',
    'unpaid',
    'incomplete'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "subscription_status" "public"."subscription_status",
  ADD COLUMN IF NOT EXISTS "subscription_current_period_end" timestamp with time zone;
