-- CON-295: optional semantic article HTML for destination CMS publishing.

ALTER TABLE "blog_posts"
  ADD COLUMN IF NOT EXISTS "content_semantic" text;
