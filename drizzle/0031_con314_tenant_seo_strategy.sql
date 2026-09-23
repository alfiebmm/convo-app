-- CON-314: tenant SEO strategy, article SEO overrides, and editorial briefs.

CREATE TABLE IF NOT EXISTS "tenant_seo_strategy" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action,
  "target_keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "priority_services" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "priority_locations" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "target_audiences" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "approved_internal_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "preferred_ctas" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "avoid_topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "avoid_claims" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "avoid_keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "revision" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_seo_strategy_tenant_unique"
  ON "tenant_seo_strategy" USING btree ("tenant_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "tenant_seo_strategy_tenant_idx"
  ON "tenant_seo_strategy" USING btree ("tenant_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "blog_post_seo" (
  "blog_post_id" uuid PRIMARY KEY REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action,
  "primary_keyword" text,
  "secondary_keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "search_intent" text,
  "target_audience" text,
  "article_type" text,
  "internal_link_suggestions" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "cta_goal" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "blog_editorial_briefs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "blog_post_id" uuid REFERENCES "public"."blog_posts"("id") ON DELETE set null ON UPDATE no action,
  "conversation_id" uuid NOT NULL REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action,
  "tenant_id" uuid NOT NULL REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action,
  "selected_primary_keyword" text,
  "selection_rationale" text,
  "supporting_keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "supporting_entities" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "conversation_evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "tenant_facts_used" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "missing_data_fallbacks" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "required_modules" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "internal_link_plan" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "cta_plan" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "create_update_skip" text NOT NULL,
  "create_update_skip_rationale" text,
  "no_strong_target" boolean DEFAULT false NOT NULL,
  "needs_review" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "blog_editorial_briefs_tenant_idx"
  ON "blog_editorial_briefs" USING btree ("tenant_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "blog_editorial_briefs_blog_post_idx"
  ON "blog_editorial_briefs" USING btree ("blog_post_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "blog_editorial_briefs_conversation_idx"
  ON "blog_editorial_briefs" USING btree ("conversation_id");
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "public"."set_tenant_seo_strategy_updated_at"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  IF TG_OP = 'UPDATE' THEN
    NEW.revision = OLD.revision + 1;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS "tenant_seo_strategy_updated_at_trigger" ON "tenant_seo_strategy";
--> statement-breakpoint

CREATE TRIGGER "tenant_seo_strategy_updated_at_trigger"
BEFORE UPDATE ON "tenant_seo_strategy"
FOR EACH ROW
EXECUTE FUNCTION "public"."set_tenant_seo_strategy_updated_at"();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "public"."set_updated_at"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS "blog_post_seo_updated_at_trigger" ON "blog_post_seo";
--> statement-breakpoint

CREATE TRIGGER "blog_post_seo_updated_at_trigger"
BEFORE UPDATE ON "blog_post_seo"
FOR EACH ROW
EXECUTE FUNCTION "public"."set_updated_at"();
--> statement-breakpoint

DROP TRIGGER IF EXISTS "blog_editorial_briefs_updated_at_trigger" ON "blog_editorial_briefs";
--> statement-breakpoint

CREATE TRIGGER "blog_editorial_briefs_updated_at_trigger"
BEFORE UPDATE ON "blog_editorial_briefs"
FOR EACH ROW
EXECUTE FUNCTION "public"."set_updated_at"();
--> statement-breakpoint

ALTER TABLE "tenant_seo_strategy" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE "blog_post_seo" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE "blog_editorial_briefs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

DO $$ BEGIN
  CREATE POLICY "tenant_seo_strategy_select_tenant"
    ON "tenant_seo_strategy"
    FOR SELECT
    TO authenticated
    USING ("tenant_id" = ((auth.jwt() ->> 'tenant_id')::uuid));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE POLICY "tenant_seo_strategy_insert_tenant"
    ON "tenant_seo_strategy"
    FOR INSERT
    TO authenticated
    WITH CHECK ("tenant_id" = ((auth.jwt() ->> 'tenant_id')::uuid));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE POLICY "tenant_seo_strategy_update_tenant"
    ON "tenant_seo_strategy"
    FOR UPDATE
    TO authenticated
    USING ("tenant_id" = ((auth.jwt() ->> 'tenant_id')::uuid))
    WITH CHECK ("tenant_id" = ((auth.jwt() ->> 'tenant_id')::uuid));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE POLICY "blog_post_seo_select_tenant"
    ON "blog_post_seo"
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM "public"."blog_posts"
        WHERE "blog_posts"."id" = "blog_post_seo"."blog_post_id"
          AND "blog_posts"."tenant_id" = ((auth.jwt() ->> 'tenant_id')::uuid)
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE POLICY "blog_post_seo_write_tenant"
    ON "blog_post_seo"
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM "public"."blog_posts"
        WHERE "blog_posts"."id" = "blog_post_seo"."blog_post_id"
          AND "blog_posts"."tenant_id" = ((auth.jwt() ->> 'tenant_id')::uuid)
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM "public"."blog_posts"
        WHERE "blog_posts"."id" = "blog_post_seo"."blog_post_id"
          AND "blog_posts"."tenant_id" = ((auth.jwt() ->> 'tenant_id')::uuid)
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE POLICY "blog_editorial_briefs_select_tenant"
    ON "blog_editorial_briefs"
    FOR SELECT
    TO authenticated
    USING ("tenant_id" = ((auth.jwt() ->> 'tenant_id')::uuid));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE POLICY "blog_editorial_briefs_write_tenant"
    ON "blog_editorial_briefs"
    FOR ALL
    TO authenticated
    USING ("tenant_id" = ((auth.jwt() ->> 'tenant_id')::uuid))
    WITH CHECK ("tenant_id" = ((auth.jwt() ->> 'tenant_id')::uuid));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
