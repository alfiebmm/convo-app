/**
 * POST /api/billing/checkout
 *
 * Creates a Stripe Checkout session for plan upgrade.
 * Accepts: { tenantId, plan: "starter" | "growth" | "scale", interval: "month" | "year" }
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createCheckoutSession } from "@/lib/billing";
import { checkMembership } from "@/lib/tenant";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    tenantId,
    plan,
    interval,
    trialPeriodDays,
    trial_period_days: trialPeriodDaysSnake,
    returnPath,
  } = body;
  const requestedTrialPeriodDays = trialPeriodDays ?? trialPeriodDaysSnake;

  if (
    !tenantId ||
    !plan ||
    !["starter", "growth", "scale"].includes(plan) ||
    !["month", "year"].includes(interval)
  ) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (
    requestedTrialPeriodDays !== undefined &&
    (!Number.isInteger(requestedTrialPeriodDays) ||
      requestedTrialPeriodDays < 0)
  ) {
    return NextResponse.json({ error: "Invalid trial period" }, { status: 400 });
  }

  // Verify membership
  const membership = await checkMembership(tenantId, session.user.id);
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  try {
    const origin = req.headers.get("origin") || "http://localhost:3000";
    const safeReturnPath =
      typeof returnPath === "string" && returnPath.startsWith("/")
        ? returnPath
        : "/dashboard/settings";
    const checkoutSession = await createCheckoutSession(
      tenantId,
      plan,
      interval,
      `${origin}${safeReturnPath}`,
      { trialPeriodDays: requestedTrialPeriodDays }
    );
    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
