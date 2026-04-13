/**
 * NextAuth v5 middleware — protects dashboard and most API routes.
 *
 * Public routes:
 *   - / (landing page)
 *   - /login, /onboarding
 *   - /api/auth/* (NextAuth routes)
 *   - /api/chat (widget chat endpoint)
 *   - /api/widget/* (widget tracking etc.)
 *   - /api/pipeline/* (pipeline webhooks)
 *   - /api/billing/webhook (Stripe webhook — raw body needed, no auth)
 */
export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/((?!auth|chat|widget|pipeline|billing/webhook).*)",
  ],
};
