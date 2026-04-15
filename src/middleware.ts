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
 *   - /api/pipeline/* (pipeline webhooks)
 *   - /api/billing/webhook (Stripe webhook — raw body needed, no auth)
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
    "/api/((?!auth|chat|widget|pipeline|billing/webhook).*)",
  ],
};
