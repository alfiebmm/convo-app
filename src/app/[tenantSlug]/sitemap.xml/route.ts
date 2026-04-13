/**
 * Dynamic XML sitemap per tenant.
 * GET /[tenantSlug]/sitemap.xml
 */
import { NextRequest, NextResponse } from "next/server";
import { getTenantBySlug, getAllPublishedContentForSitemap } from "@/lib/db/queries";
import { APP_CONFIG } from "@/config/app";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const tenant = await getTenantBySlug(tenantSlug);

  if (!tenant) {
    return new NextResponse("Not found", { status: 404 });
  }

  const items = await getAllPublishedContentForSitemap(tenant.id);
  const baseUrl = APP_CONFIG.url;

  const urls = items
    .map((item) => {
      const lastmod = (item.updatedAt || item.publishedAt)?.toISOString().split("T")[0];
      const priority = item.type === "faq" ? "0.8" : "0.7";
      return `  <url>
    <loc>${baseUrl}/${tenantSlug}/${item.slug}</loc>
    ${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/${tenantSlug}</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
${urls}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
