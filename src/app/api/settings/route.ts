/**
 * GET   /api/settings         — returns tenant settings
 * PATCH /api/settings         — updates tenant settings (merge)
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tenants, tenantMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import type { TenantSettings } from "@/lib/publishing";

async function getActiveTenantId(userId: string): Promise<string | null> {
  const cookieStore = await cookies();
  const activeTenantId = cookieStore.get("active-tenant")?.value;

  if (activeTenantId) {
    // Verify membership
    const [membership] = await db
      .select()
      .from(tenantMembers)
      .where(
        and(
          eq(tenantMembers.userId, userId),
          eq(tenantMembers.tenantId, activeTenantId)
        )
      )
      .limit(1);
    if (membership) return activeTenantId;
  }

  // Fall back to first tenant
  const [first] = await db
    .select()
    .from(tenantMembers)
    .where(eq(tenantMembers.userId, userId))
    .limit(1);

  return first?.tenantId ?? null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = await getActiveTenantId(session.user.id);
  if (!tenantId) {
    return NextResponse.json({ error: "No tenant" }, { status: 404 });
  }

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  return NextResponse.json({
    settings: tenant.settings as TenantSettings,
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      domain: tenant.domain,
      plan: tenant.plan,
      stripeCustomerId: tenant.stripeCustomerId,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = await getActiveTenantId(session.user.id);
  if (!tenantId) {
    return NextResponse.json({ error: "No tenant" }, { status: 404 });
  }

  const body = await req.json();

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  // Extract tenant-level fields (name, domain) from body — rest goes into settings jsonb
  const { name: newName, domain: newDomain, ...settingsBody } = body;

  const currentSettings = (tenant.settings ?? {}) as Record<string, unknown>;
  const newSettings = { ...currentSettings, ...settingsBody };

  // Build the update payload
  const updatePayload: Record<string, unknown> = {
    settings: newSettings,
    updatedAt: new Date(),
  };
  if (typeof newName === "string") updatePayload.name = newName;
  if (typeof newDomain === "string") updatePayload.domain = newDomain || null;

  const [updated] = await db
    .update(tenants)
    .set(updatePayload)
    .where(eq(tenants.id, tenantId))
    .returning();

  return NextResponse.json({
    settings: updated.settings,
    tenant: {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      domain: updated.domain,
      plan: updated.plan,
      stripeCustomerId: updated.stripeCustomerId,
    },
  });
}
