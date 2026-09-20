-- CON-297: AI-generated article hero images and monthly tenant spend caps.

ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "blog_ai_hero_enabled" boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS "hero_image_style_prompt" text,
  ADD COLUMN IF NOT EXISTS "blog_ai_hero_monthly_cap_cents" integer DEFAULT 1000 NOT NULL;
--> statement-breakpoint

ALTER TABLE "tenants"
  ALTER COLUMN "blog_ai_hero_enabled" SET DEFAULT true,
  ALTER COLUMN "blog_ai_hero_monthly_cap_cents" SET DEFAULT 1000;
--> statement-breakpoint

UPDATE "tenants"
   SET "blog_ai_hero_enabled" = true
 WHERE "blog_ai_hero_enabled" IS NULL;
--> statement-breakpoint

UPDATE "tenants"
   SET "blog_ai_hero_monthly_cap_cents" = 1000
 WHERE "blog_ai_hero_monthly_cap_cents" IS NULL;
--> statement-breakpoint

ALTER TABLE "tenants"
  ALTER COLUMN "blog_ai_hero_enabled" SET NOT NULL,
  ALTER COLUMN "blog_ai_hero_monthly_cap_cents" SET NOT NULL;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "tenant_ai_image_usage" (
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "month" varchar(7) NOT NULL,
  "spend_cents" integer DEFAULT 0 NOT NULL,
  "image_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "tenant_ai_image_usage_pkey" PRIMARY KEY ("tenant_id", "month")
);
--> statement-breakpoint

ALTER TABLE "tenant_ai_image_usage" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "tenant_ai_image_usage_month_idx"
  ON "tenant_ai_image_usage" ("month");
--> statement-breakpoint

DO $$ BEGIN
  CREATE POLICY "tenant_ai_image_usage_service_role_all"
  ON "tenant_ai_image_usage"
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
