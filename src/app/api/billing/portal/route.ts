/**
 * POST /api/billing/portal
 *
 * Creates a Stripe Billing Portal session.
 * Accepts: { tenantId }
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createPortalSession } from "@/lib/billing";
import { checkMembership } from "@/lib/tenant";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { tenantId } = body;

  if (!tenantId) {
    return NextResponse.json({ error: "tenantId required" }, { status: 400 });
  }

  const membership = await checkMembership(tenantId, session.user.id);
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  try {
    const origin = req.headers.get("origin") || "http://localhost:3000";
    const portalSession = await createPortalSession(
      tenantId,
      `${origin}/dashboard/settings`
    );
    return NextResponse.json({ url: portalSession.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
