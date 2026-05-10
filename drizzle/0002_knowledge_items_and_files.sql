-- Enable pgvector. Currently embeddings are stored as TEXT (JSON-array string)
-- and the application formats them so Postgres can cast text -> vector at query time.
-- CON-89 (semantic search) will retype the embedding column to vector(1536) and add
-- an HNSW index for cosine similarity. Enabling the extension here keeps that migration small.
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."knowledge_file_status" AS ENUM('pending', 'processing', 'indexed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."knowledge_item_status" AS ENUM('pending', 'processing', 'indexed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."knowledge_item_type" AS ENUM('page', 'file');--> statement-breakpoint
CREATE TABLE "knowledge_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"original_filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"storage_path" text NOT NULL,
	"status" "knowledge_file_status" DEFAULT 'pending' NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"indexed_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" "knowledge_item_type" NOT NULL,
	"source_url" text,
	"parent_id" uuid,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"content_hash" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"embedding" text,
	"status" "knowledge_item_status" DEFAULT 'pending' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knowledge_files" ADD CONSTRAINT "knowledge_files_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_items" ADD CONSTRAINT "knowledge_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_items" ADD CONSTRAINT "knowledge_items_parent_id_knowledge_files_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."knowledge_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "knowledge_files_tenant_idx" ON "knowledge_files" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "knowledge_files_status_idx" ON "knowledge_files" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "knowledge_items_tenant_type_idx" ON "knowledge_items" USING btree ("tenant_id","type");--> statement-breakpoint
CREATE INDEX "knowledge_items_tenant_url_idx" ON "knowledge_items" USING btree ("tenant_id","source_url");--> statement-breakpoint
CREATE INDEX "knowledge_items_tenant_parent_idx" ON "knowledge_items" USING btree ("tenant_id","parent_id");--> statement-breakpoint
CREATE INDEX "knowledge_items_status_idx" ON "knowledge_items" USING btree ("tenant_id","status");