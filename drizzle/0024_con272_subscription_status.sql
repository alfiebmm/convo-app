-- CON-272: Stripe subscription status tracking.
--
-- Records Stripe's subscription lifecycle state and the current renewal /
-- period-end timestamp on each tenant.

CREATE TYPE "public"."subscription_status" AS ENUM (
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'incomplete'
);
--> statement-breakpoint

ALTER TABLE "tenants"
  ADD COLUMN "subscription_status" "public"."subscription_status",
  ADD COLUMN "subscription_current_period_end" timestamp with time zone;
