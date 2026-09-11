-- CON-295: optional semantic article HTML for destination CMS publishing.

ALTER TABLE "blog_posts"
  ADD COLUMN "content_semantic" text;
