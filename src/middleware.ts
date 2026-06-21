/**
 * Auth middleware — protects dashboard and most API routes.
 *
 * Uses JWT cookie check instead of full NextAuth auth() to avoid
 * importing node-postgres (which doesn't work on Vercel Edge Runtime).
 *
 * Public routes:
 *   - / (landing page)
 *   - /login, /onboarding
 *   - /api/auth/* (NextAuth routes)
 *   - /api/chat (widget chat endpoint)
 *   - /api/widget/* (widget tracking etc.)
 *   - /api/conversations/qualifying/* (widget qualifying-question flow, CON-94)
 *   - /api/pipeline/* (pipeline webhooks)
 *   - /api/billing/webhook (Stripe webhook — raw body needed, no auth)
 *   - /api/conversations/case-events (widget follow-up Yes/No POSTs — CON-169)
 *   - /api/cases/:caseId/capture (widget progressive contact-capture POSTs — CON-170)
 *
 * The cases capture allowlist is INTENTIONALLY narrow: every other
 * route under /api/cases (list, detail, assign, resolve, PII reveal)
 * stays behind auth. The widget only needs the capture sub-path.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Check for NextAuth session token (set by NextAuth v5 with JWT strategy)
  const token =
    request.cookies.get("__Secure-authjs.session-token") ??
    request.cookies.get("authjs.session-token");

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/((?!auth|chat|widget|conversations/case-events|conversations/qualifying|pipeline|billing/webhook|cases/[^/]+/capture).*)",
  ],
};
