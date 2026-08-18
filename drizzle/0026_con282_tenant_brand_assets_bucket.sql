-- CON-282: public Supabase Storage bucket for tenant brand logo uploads.
--
-- Dashboard writes use the service-role key from the Next.js API route.
-- Public reads are needed because logos render in public article pages and
-- JSON-LD publisher metadata.

INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-brand-assets', 'tenant-brand-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;
--> statement-breakpoint

CREATE POLICY "tenant_brand_assets_public_read"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'tenant-brand-assets');
