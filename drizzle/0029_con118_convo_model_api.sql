-- CON-118: conversation dashboard model fields for CV-02/CV-04 API.

ALTER TABLE "conversations"
  ADD COLUMN IF NOT EXISTS "title" text,
  ADD COLUMN IF NOT EXISTS "topic" text,
  ADD COLUMN IF NOT EXISTS "persona" text,
  ADD COLUMN IF NOT EXISTS "ai_summary" text,
  ADD COLUMN IF NOT EXISTS "summary_generated_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "last_activity_at" timestamp with time zone;

UPDATE "conversations" c
   SET "last_activity_at" = COALESCE(
     (
       SELECT MAX(m."created_at")
         FROM "messages" m
        WHERE m."conversation_id" = c."id"
     ),
     c."started_at",
     c."created_at",
     NOW()
   )
 WHERE c."last_activity_at" IS NULL;

ALTER TABLE "conversations"
  ALTER COLUMN "last_activity_at" SET DEFAULT NOW(),
  ALTER COLUMN "last_activity_at" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "conversations_tenant_last_activity_idx"
  ON "conversations" ("tenant_id", "last_activity_at");

CREATE INDEX IF NOT EXISTS "conversations_tenant_persona_idx"
  ON "conversations" ("tenant_id", "persona");

CREATE INDEX IF NOT EXISTS "conversations_tenant_topic_idx"
  ON "conversations" ("tenant_id", "topic");
