/**
 * RSS 2.0 feed per tenant.
 * GET /[tenantSlug]/feed.xml
 */
import { NextRequest, NextResponse } from "next/server";
import { getTenantBySlug, getAllPublishedContentForSitemap } from "@/lib/db/queries";
import { db } from "@/lib/db";
import { content } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
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

  // Get published content with full details for RSS
  const items = await db
    .select({
      title: content.title,
      slug: content.slug,
      metaDescription: content.metaDescription,
      publishedAt: content.publishedAt,
      body: content.body,
    })
    .from(content)
    .where(and(eq(content.tenantId, tenant.id), eq(content.status, "published")))
    .orderBy(desc(content.publishedAt))
    .limit(50);

  const baseUrl = APP_CONFIG.url;
  const hubUrl = `${baseUrl}/${tenantSlug}`;

  function escapeXml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  const rssItems = items
    .map((item) => {
      const link = `${baseUrl}/${tenantSlug}/${item.slug}`;
      const pubDate = item.publishedAt
        ? new Date(item.publishedAt).toUTCString()
        : "";
      const description = item.metaDescription || (item.body?.slice(0, 300) ?? "");

      return `    <item>
      <title>${escapeXml(item.title || "Untitled")}</title>
      <link>${link}</link>
      <description>${escapeXml(description)}</description>
      <guid isPermaLink="true">${link}</guid>
      ${pubDate ? `<pubDate>${pubDate}</pubDate>` : ""}
    </item>`;
    })
    .join("\n");

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(tenant.name)} — Knowledge Hub</title>
    <link>${hubUrl}</link>
    <description>Latest articles and answers from ${escapeXml(tenant.name)}</description>
    <language>en</language>
    <atom:link href="${hubUrl}/feed.xml" rel="self" type="application/rss+xml" />
${rssItems}
  </channel>
</rss>`;

  return new NextResponse(rss, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
