-- CON-45: human triage flags on conversations
--
-- NOTE: drizzle-kit diff also surfaced NextAuth tables (accounts/sessions/
-- verification_tokens) and users.emailVerified/image as missing. Those were
-- created via raw SQL on 15 Apr (see memory/2026-04-17.md). They already
-- exist in the live DB, so we strip them from this migration to keep it
-- focused. If the meta snapshot needs to be re-synced, do it separately
-- with `drizzle-kit pull` once the DB is reconciled.

ALTER TABLE "conversations" ADD COLUMN "needs_followup" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "resolved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "resolved_by" uuid;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversations_followup_idx" ON "conversations" USING btree ("tenant_id","needs_followup");
