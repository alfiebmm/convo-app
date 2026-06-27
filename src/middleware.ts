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
import { getToken } from "next-auth/jwt";
import {
  adminSessionCookieName,
  verifyAdminSession,
} from "@/lib/platform-admin/admin-session-core";

function parseAllowlist(raw = process.env.PLATFORM_STAFF_EMAILS ?? "") {
  return new Set(
    raw
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

// Edge layers (Vercel/Cloudflare) cache responses by URL/path. If we serve a
// 404 from middleware without explicit no-store, an unauthenticated request to
// /platform-admin/* can poison the edge cache so even authenticated admins get
// served the cached 404 for the TTL. The headers below force a fresh response
// on every request and key on the Cookie header so cache layers cannot share
// it across auth states.
export const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0, must-revalidate",
  Vary: "Cookie",
};

export function notFoundResponse(request: NextRequest) {
  const response = NextResponse.rewrite(new URL("/404", request.url), {
    status: 404,
  });
  for (const [key, value] of Object.entries(NO_STORE_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

function nextWithPathname(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-platform-admin-pathname", request.nextUrl.pathname);
  requestHeaders.set("x-platform-admin-now", String(Date.now()));
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export async function middleware(request: NextRequest) {
  // Check for NextAuth session token (set by NextAuth v5 with JWT strategy)
  const token =
    request.cookies.get("__Secure-authjs.session-token") ??
    request.cookies.get("authjs.session-token");

  if (request.nextUrl.pathname.startsWith("/platform-admin")) {
    if (!token) return notFoundResponse(request);

    const allowlist = parseAllowlist();
    if (allowlist.size === 0) return notFoundResponse(request);

    const authToken = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
    });
    if (!authToken) return notFoundResponse(request);

    const email = authToken.email?.toLowerCase();

    if (!email || !allowlist.has(email)) return notFoundResponse(request);

    const path = request.nextUrl.pathname;
    const mfaExempt =
      path === "/platform-admin/enrol-mfa" ||
      path === "/platform-admin/challenge-mfa" ||
      path === "/platform-admin/locked";

    if (!mfaExempt) {
      const adminSession = request.cookies.get(adminSessionCookieName)?.value;
      const verified = adminSession
        ? await verifyAdminSession(adminSession).catch(() => null)
        : null;

      if (!verified || verified.userId !== authToken.sub) {
        const challengeUrl = new URL("/platform-admin/challenge-mfa", request.url);
        challengeUrl.searchParams.set("callbackUrl", path);
        return NextResponse.redirect(challengeUrl);
      }
    }

    return nextWithPathname(request);
  }

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/platform-admin/:path*",
    "/dashboard/:path*",
    "/api/((?!auth|chat|widget|conversations/case-events|conversations/qualifying|pipeline|billing/webhook|cases/[^/]+/capture).*)",
  ],
};
