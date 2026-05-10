/**
 * POST /api/knowledge/site/resync
 *
 * Re-indexes the current tenant's website. Wipes existing page-type
 * knowledge_items rows and triggers a fresh crawl in `after()` so the
 * response returns immediately and the heavy work survives Vercel's
 * serverless lifecycle.
 *
 * Tenant-scoped via session auth.
 *
 * Note: CON-86 will add delta detection (update existing rows rather than
 * wipe-and-recrawl). For now the simple wipe-and-recrawl is correct + safe;
 * the FK has ON DELETE CASCADE so nothing leaks.
 */
import { NextResponse, after } from "next/server";
import { getCurrentTenant } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { knowledgeItems } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { indexTenantSite } from "@/lib/knowledge/indexer";

export const runtime = "nodejs";
export const maxDuration = 10; // foreground only — crawl runs in after()

export async function POST() {
  const tenant = await getCurrentTenant();
  if (!tenant) {
    return NextResponse.json({ error: "No active tenant" }, { status: 401 });
  }

  if (!tenant.domain) {
    return NextResponse.json(
      { error: "No domain configured for this tenant. Add one in Settings." },
      { status: 400 }
    );
  }

  // Wipe existing page rows for this tenant before recrawling. Files (type='file')
  // are untouched. ON DELETE CASCADE handles any orphaned chunks.
  await db
    .delete(knowledgeItems)
    .where(
      and(
        eq(knowledgeItems.tenantId, tenant.id),
        eq(knowledgeItems.type, "page")
      )
    );

  const domain = tenant.domain;
  after(async () => {
    try {
      await indexTenantSite(tenant.id, domain);
    } catch (err) {
      console.error(
        `[Knowledge] Re-sync failed for tenant ${tenant.id}:`,
        err
      );
    }
  });

  return NextResponse.json({
    success: true,
    message: "Re-sync started. Refresh in a minute to see updated counts.",
  });
}
