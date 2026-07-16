-- CON-104: blog decision phase.
--
-- Adds embeddings to blog_posts so the decision phase can compare a source
-- conversation against existing tenant articles, and records every create /
-- update / skip decision in a tenant-scoped audit table.

CREATE TYPE "public"."blog_decision_action" AS ENUM (
  'create',
  'update',
  'skip'
);
--> statement-breakpoint

ALTER TABLE "blog_posts"
  ADD COLUMN "embedding" vector(1536);
--> statement-breakpoint

CREATE INDEX "blog_posts_embedding_hnsw_idx"
  ON "blog_posts" USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE "embedding" IS NOT NULL;
--> statement-breakpoint

CREATE TABLE "blog_decision_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action,
  "conversation_id" uuid NOT NULL REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action,
  "action" "public"."blog_decision_action" NOT NULL,
  "reason" text NOT NULL,
  "similar_posts" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "primary_keyword" text,
  "intent" text,
  "target_blog_post_id" uuid REFERENCES "public"."blog_posts"("id") ON DELETE set null ON UPDATE no action,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX "blog_decision_logs_tenant_created_idx"
  ON "blog_decision_logs" USING btree ("tenant_id", "created_at");
--> statement-breakpoint

CREATE INDEX "blog_decision_logs_tenant_conversation_idx"
  ON "blog_decision_logs" USING btree ("tenant_id", "conversation_id");
--> statement-breakpoint

CREATE INDEX "blog_decision_logs_tenant_action_idx"
  ON "blog_decision_logs" USING btree ("tenant_id", "action");
--> statement-breakpoint

ALTER TABLE "blog_decision_logs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "blog_decision_logs_select_tenant"
  ON "blog_decision_logs"
  FOR SELECT
  TO authenticated
  USING ("tenant_id" = ((auth.jwt() ->> 'tenant_id')::uuid));
--> statement-breakpoint

CREATE POLICY "blog_decision_logs_insert_tenant"
  ON "blog_decision_logs"
  FOR INSERT
  TO authenticated
  WITH CHECK ("tenant_id" = ((auth.jwt() ->> 'tenant_id')::uuid));
--> statement-breakpoint

CREATE POLICY "blog_decision_logs_update_tenant"
  ON "blog_decision_logs"
  FOR UPDATE
  TO authenticated
  USING ("tenant_id" = ((auth.jwt() ->> 'tenant_id')::uuid))
  WITH CHECK ("tenant_id" = ((auth.jwt() ->> 'tenant_id')::uuid));
--> statement-breakpoint

CREATE POLICY "blog_decision_logs_delete_tenant"
  ON "blog_decision_logs"
  FOR DELETE
  TO authenticated
  USING ("tenant_id" = ((auth.jwt() ->> 'tenant_id')::uuid));
--> statement-breakpoint

COMMENT ON TABLE "blog_decision_logs" IS
  'CON-104 tenant-scoped audit log for blog create/update/skip decisions.';
