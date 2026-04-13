/**
 * GET   /api/settings         — returns tenant settings
 * PATCH /api/settings         — updates tenant settings (merge)
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { TenantSettings } from "@/lib/publishing";

const DEMO_TENANT_ID = "5067d163-5edd-448c-a0e6-4dc8adaccb02";

export async function GET() {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, DEMO_TENANT_ID))
    .limit(1);

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  return NextResponse.json({
    settings: tenant.settings as TenantSettings,
  });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, DEMO_TENANT_ID))
    .limit(1);

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const currentSettings = (tenant.settings ?? {}) as Record<string, unknown>;
  const newSettings = { ...currentSettings, ...body };

  const [updated] = await db
    .update(tenants)
    .set({
      settings: newSettings,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, DEMO_TENANT_ID))
    .returning();

  return NextResponse.json({ settings: updated.settings });
}
