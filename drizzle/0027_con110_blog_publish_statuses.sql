-- CON-110: blog publish flow transient and terminal failure statuses.
--
-- Rebuild the enum instead of ALTER TYPE ADD VALUE so later statements in the
-- same Drizzle migration transaction can safely use the new values.

DO $$ BEGIN
  CREATE TYPE "public"."blog_post_status_new" AS ENUM (
    'draft',
    'in_review',
    'approved',
    'publishing',
    'published',
    'publish_failed',
    'rejected',
    'generation_failed',
    'update_pending'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

ALTER TABLE "blog_posts"
  ALTER COLUMN "status" DROP DEFAULT;
--> statement-breakpoint

ALTER TABLE "blog_posts"
  ALTER COLUMN "status" TYPE "public"."blog_post_status_new"
  USING CASE "status"::text
    WHEN 'draft' THEN 'draft'::"public"."blog_post_status_new"
    WHEN 'in_review' THEN 'in_review'::"public"."blog_post_status_new"
    WHEN 'approved' THEN 'approved'::"public"."blog_post_status_new"
    WHEN 'published' THEN 'published'::"public"."blog_post_status_new"
    WHEN 'rejected' THEN 'rejected'::"public"."blog_post_status_new"
    WHEN 'generation_failed' THEN 'generation_failed'::"public"."blog_post_status_new"
    WHEN 'update_pending' THEN 'update_pending'::"public"."blog_post_status_new"
    ELSE 'draft'::"public"."blog_post_status_new"
  END;
--> statement-breakpoint

DROP TYPE IF EXISTS "public"."blog_post_status";
--> statement-breakpoint

DO $$ BEGIN
  ALTER TYPE "public"."blog_post_status_new"
    RENAME TO "blog_post_status";
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

ALTER TABLE "blog_posts"
  ALTER COLUMN "status" SET DEFAULT 'draft';
