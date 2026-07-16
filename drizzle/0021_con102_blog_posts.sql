-- CON-102: blog post data model.
--
-- Blog posts are tenant-scoped generated articles that can optionally retain
-- a source conversation link. The `thread_id` column name is part of the
-- external epic contract; in the current schema conversations are the source
-- thread table, so the FK points at conversations(id).

CREATE TYPE "public"."blog_post_status" AS ENUM (
  'draft',
  'in_review',
  'approved',
  'published',
  'rejected'
);
--> statement-breakpoint

CREATE TABLE "blog_posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action,
  "thread_id" uuid REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action,
  "title" text NOT NULL,
  "slug" varchar(255) NOT NULL,
  "content" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" "public"."blog_post_status" DEFAULT 'draft' NOT NULL,
  "persona" text,
  "topic" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "published_at" timestamp with time zone,
  "last_modified" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX "blog_posts_tenant_slug_unique"
  ON "blog_posts" USING btree ("tenant_id", "slug");
--> statement-breakpoint

CREATE INDEX "blog_posts_tenant_status_idx"
  ON "blog_posts" USING btree ("tenant_id", "status");
--> statement-breakpoint

CREATE INDEX "blog_posts_tenant_thread_idx"
  ON "blog_posts" USING btree ("tenant_id", "thread_id");
--> statement-breakpoint

CREATE INDEX "blog_posts_metadata_gin_idx"
  ON "blog_posts" USING gin ("metadata");
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "public"."set_blog_posts_last_modified"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.last_modified = now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER "blog_posts_last_modified_trigger"
BEFORE UPDATE ON "blog_posts"
FOR EACH ROW
EXECUTE FUNCTION "public"."set_blog_posts_last_modified"();
--> statement-breakpoint

ALTER TABLE "blog_posts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "blog_posts_select_tenant"
  ON "blog_posts"
  FOR SELECT
  TO authenticated
  USING ("tenant_id" = ((auth.jwt() ->> 'tenant_id')::uuid));
--> statement-breakpoint

CREATE POLICY "blog_posts_insert_tenant"
  ON "blog_posts"
  FOR INSERT
  TO authenticated
  WITH CHECK ("tenant_id" = ((auth.jwt() ->> 'tenant_id')::uuid));
--> statement-breakpoint

CREATE POLICY "blog_posts_update_tenant"
  ON "blog_posts"
  FOR UPDATE
  TO authenticated
  USING ("tenant_id" = ((auth.jwt() ->> 'tenant_id')::uuid))
  WITH CHECK ("tenant_id" = ((auth.jwt() ->> 'tenant_id')::uuid));
--> statement-breakpoint

CREATE POLICY "blog_posts_delete_tenant"
  ON "blog_posts"
  FOR DELETE
  TO authenticated
  USING ("tenant_id" = ((auth.jwt() ->> 'tenant_id')::uuid));
--> statement-breakpoint

COMMENT ON TABLE "blog_posts" IS
  'CON-102 tenant-scoped generated blog posts with SEO metadata and publication lifecycle status.';
