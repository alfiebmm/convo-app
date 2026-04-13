/**
 * GET /api/usage — returns monthly usage for the active tenant.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { tenantMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getMonthlyUsage } from "@/lib/usage";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cookieStore = await cookies();
  const activeTenantId = cookieStore.get("active-tenant")?.value;

  let tenantId: string | null = null;

  if (activeTenantId) {
    const [membership] = await db
      .select()
      .from(tenantMembers)
      .where(
        and(
          eq(tenantMembers.userId, session.user.id),
          eq(tenantMembers.tenantId, activeTenantId)
        )
      )
      .limit(1);
    if (membership) tenantId = activeTenantId;
  }

  if (!tenantId) {
    const [first] = await db
      .select()
      .from(tenantMembers)
      .where(eq(tenantMembers.userId, session.user.id))
      .limit(1);
    tenantId = first?.tenantId ?? null;
  }

  if (!tenantId) {
    return NextResponse.json({ conversations: 0, articles: 0 });
  }

  const usage = await getMonthlyUsage(tenantId);
  return NextResponse.json(usage);
}
