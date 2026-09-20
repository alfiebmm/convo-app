-- CON-305: strengthen blog decision outcomes and audit evidence.
--
-- Adds explicit positive/no-signal/failure actions plus durable links from the
-- decision log to generated drafts, update drafts, failure rows, and the
-- thresholds used for the decision. Safe defaults keep existing rows valid.

DO $$ BEGIN
  CREATE TYPE "public"."blog_decision_action_new" AS ENUM (
    'create',
    'update',
    'skip',
    'skip-covered',
    'skip-nosignal',
    'failure'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

ALTER TABLE "blog_decision_logs"
  ALTER COLUMN "action" TYPE "public"."blog_decision_action_new"
  USING "action"::text::"public"."blog_decision_action_new";
--> statement-breakpoint

DROP TYPE "public"."blog_decision_action";
--> statement-breakpoint

DO $$ BEGIN
  ALTER TYPE "public"."blog_decision_action_new" RENAME TO "blog_decision_action";
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

ALTER TABLE "blog_decision_logs"
  ADD COLUMN IF NOT EXISTS "selected_target_post_id" uuid REFERENCES "public"."blog_posts"("id") ON DELETE set null ON UPDATE no action,
  ADD COLUMN IF NOT EXISTS "generated_blog_post_id" uuid REFERENCES "public"."blog_posts"("id") ON DELETE set null ON UPDATE no action,
  ADD COLUMN IF NOT EXISTS "update_draft_blog_post_id" uuid REFERENCES "public"."blog_posts"("id") ON DELETE set null ON UPDATE no action,
  ADD COLUMN IF NOT EXISTS "failure_blog_post_id" uuid REFERENCES "public"."blog_posts"("id") ON DELETE set null ON UPDATE no action,
  ADD COLUMN IF NOT EXISTS "failure_reason" text,
  ADD COLUMN IF NOT EXISTS "thresholds_used" jsonb DEFAULT '{}'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS "is_content_producing" boolean DEFAULT false NOT NULL;
