-- CON-105: blog create workflow terminal/pending statuses.
--
-- Rebuild the enum instead of ALTER TYPE ADD VALUE so future migrations may
-- safely use the new values in the same Drizzle migration transaction.

CREATE TYPE "public"."blog_post_status_new" AS ENUM (
  'draft',
  'in_review',
  'approved',
  'published',
  'rejected',
  'generation_failed',
  'update_pending'
);
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
    ELSE 'draft'::"public"."blog_post_status_new"
  END;
--> statement-breakpoint

DROP TYPE "public"."blog_post_status";
--> statement-breakpoint

ALTER TYPE "public"."blog_post_status_new"
  RENAME TO "blog_post_status";
--> statement-breakpoint

ALTER TABLE "blog_posts"
  ALTER COLUMN "status" SET DEFAULT 'draft';
