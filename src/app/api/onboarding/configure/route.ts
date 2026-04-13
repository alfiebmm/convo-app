/**
 * POST /api/onboarding/configure
 *
 * Updates tenant settings with chatbot persona and welcome message.
 * Accepts: { tenantId, persona, welcomeMessage }
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tenants, tenantMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { tenantId, persona, welcomeMessage } = body;

  if (!tenantId) {
    return NextResponse.json(
      { error: "tenantId is required" },
      { status: 400 }
    );
  }

  // Verify membership
  const [membership] = await db
    .select()
    .from(tenantMembers)
    .where(
      and(
        eq(tenantMembers.tenantId, tenantId),
        eq(tenantMembers.userId, session.user.id)
      )
    )
    .limit(1);

  if (!membership) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  // Get current tenant
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const currentSettings = (tenant.settings ?? {}) as Record<string, unknown>;
  const newSettings = {
    ...currentSettings,
    persona: persona || currentSettings.persona,
    welcomeMessage: welcomeMessage || currentSettings.welcomeMessage,
  };

  await db
    .update(tenants)
    .set({ settings: newSettings, updatedAt: new Date() })
    .where(eq(tenants.id, tenantId));

  return NextResponse.json({ success: true });
}
