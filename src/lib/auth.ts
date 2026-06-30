/**
 * NextAuth v5 configuration.
 *
 * Providers: Google OAuth + Email magic links.
 * Uses Drizzle adapter for persistence into our existing Postgres tables.
 *
 * CON-237: Auth flow is now intent-aware. The `/login` and `/signup`
 * server actions set a short-lived `convo_auth_flow` cookie before
 * starting the OAuth dance, and the `signIn` callback below uses
 * `decideAuthFlow` to either allow the sign-in, reject it (existing
 * email with no Convo user row tried to log in), or quietly bounce a
 * returning user out of the signup wizard.
 *
 * The `redirect` callback then honours those decisions when NextAuth
 * goes to land the user.
 */
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Nodemailer from "next-auth/providers/nodemailer";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { cookies } from "next/headers";
import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
  tenantMembers,
} from "./db/schema";
import {
  AUTH_FLOW_COOKIE,
  decideAuthFlow,
  parseAuthFlow,
  type AuthFlowDecision,
} from "./auth/flow";

/**
 * Per-request signal from the `signIn` callback to the `redirect`
 * callback. NextAuth doesn't give us a direct channel between the two,
 * so we stash the decision in a request-scoped cookie that the redirect
 * callback consumes and then clears.
 */
const AUTH_FLOW_DECISION_COOKIE = "convo_auth_flow_decision";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),

  session: {
    strategy: "jwt",
  },

  pages: {
    signIn: "/login",
    newUser: "/onboarding",
  },

  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // CON-237: Explicit lookup-and-link (see `signIn` callback below)
      // replaces the previous implicit account-linking behaviour. We
      // keep this flag on as a belt-and-braces fallback for the legacy
      // email-magic-link bridge — the explicit logic below is what
      // actually governs new vs returning users.
      allowDangerousEmailAccountLinking: true,
      // CON-237 follow-up: force Google to show the account picker on
      // every sign-in. Without this, if the user has an existing Google
      // session, Google silently returns that identity without giving
      // them a chance to pick which account they want to use — which
      // means a user logging into the wrong account ends up being
      // routed to onboarding before they ever see the picker.
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
    }),
    ...(process.env.EMAIL_SERVER_HOST
      ? [
          Nodemailer({
            server: {
              host: process.env.EMAIL_SERVER_HOST,
              port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
              auth: {
                user: process.env.EMAIL_SERVER_USER,
                pass: process.env.EMAIL_SERVER_PASSWORD,
              },
            },
            from: process.env.EMAIL_FROM ?? "noreply@convo.app",
          }),
        ]
      : []),
  ],

  callbacks: {
    /**
     * CON-237: gate sign-ins by declared intent.
     *
     *   flow=login  + existing user → allow
     *   flow=login  + new email     → reject, redirect to /login?error=no_account
     *   flow=signup + new email     → allow (adapter will provision)
     *   flow=signup + existing user → allow but bounce to /dashboard?welcome=back
     *
     * Direct provider hits (no cookie) default to "login" — the safer
     * branch, since it refuses to silently create a user row.
     */
    async signIn({ user, account }) {
      // Only the Google OAuth path needs intent disambiguation; the
      // email magic-link flow is already explicit (you can't get a
      // magic link without typing your email into the login page).
      if (account?.provider !== "google") return true;

      const email = user?.email?.toLowerCase().trim();
      if (!email) return false;

      const cookieStore = await cookies();
      const flow = parseAuthFlow(cookieStore.get(AUTH_FLOW_COOKIE)?.value);

      const [existing] = await db
        .select({
          id: users.id,
          isPlatformStaff: users.isPlatformStaff,
        })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      // CON-239: platform staff can log in without a tenant membership.
      // We need to know both (a) does the user exist and (b) do they
      // have any tenant membership at all, so `decideAuthFlow` can
      // route tenantless staff into `/platform-admin` rather than
      // bouncing them to `/login?error=no_account`.
      let hasTenantMembership = false;
      if (existing) {
        const [membership] = await db
          .select({ exists: sql<number>`1` })
          .from(tenantMembers)
          .where(eq(tenantMembers.userId, existing.id))
          .limit(1);
        hasTenantMembership = Boolean(membership);
      }

      const decision = decideAuthFlow({
        flow,
        existingUser: Boolean(existing),
        hasTenantMembership,
        isPlatformStaff: Boolean(existing?.isPlatformStaff),
      });

      // Hand the decision to the redirect callback. We always clear the
      // intent cookie here so it can't leak across sign-in attempts.
      cookieStore.set(AUTH_FLOW_COOKIE, "", {
        path: "/",
        maxAge: 0,
      });
      cookieStore.set(AUTH_FLOW_DECISION_COOKIE, serializeDecision(decision), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60, // just long enough to survive the OAuth round-trip
      });

      if (decision.kind === "deny") {
        return decision.redirectTo;
      }
      return true;
    },

    /**
     * CON-237: honour the decision stashed by `signIn` above.
     *
     * IMPORTANT: this callback can be invoked during RSC rendering of
     * authenticated pages (e.g. /dashboard) where `cookies()` is
     * read-only. We MUST NOT call `cookieStore.set` in here — doing so
     * throws `Cookies can only be modified in a Server Action or Route
     * Handler` and 500s the page. Instead we rely on the decision
     * cookie's short TTL (60s, set in `signIn`) to age out naturally,
     * and we only ACT on the decision when the redirect URL clearly
     * belongs to the OAuth round-trip (callback or sign-in path).
     */
    async redirect({ url, baseUrl }) {
      const cookieStore = await cookies();
      const raw = cookieStore.get(AUTH_FLOW_DECISION_COOKIE)?.value;
      const decision = raw ? deserializeDecision(raw) : null;

      // Only consume the decision if this redirect is part of the
      // post-sign-in landing. After the first navigation the cookie
      // expires on its own (maxAge=60s in signIn).
      const isPostAuthLanding =
        url.startsWith(`${baseUrl}/api/auth`) ||
        url === baseUrl ||
        url === `${baseUrl}/` ||
        url === `${baseUrl}/onboarding` ||
        url === `${baseUrl}/dashboard`;

      if (decision?.kind === "allow-redirect" && isPostAuthLanding) {
        return `${baseUrl}${decision.to}`;
      }

      // Default NextAuth behaviour: same-origin URLs are allowed, off-
      // origin URLs fall back to baseUrl.
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        const parsed = new URL(url);
        if (parsed.origin === baseUrl) return url;
      } catch {
        // fall through
      }
      return baseUrl;
    },

    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },

    async session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});

function serializeDecision(decision: AuthFlowDecision): string {
  // We deliberately serialise the smallest field set the redirect
  // callback needs — the cookie is httpOnly but still user-visible at
  // the protocol level, so there is no point shipping the reason code.
  if (decision.kind === "allow-redirect") {
    return JSON.stringify({ kind: "allow-redirect", to: decision.to });
  }
  return JSON.stringify({ kind: decision.kind });
}

function deserializeDecision(raw: string): AuthFlowDecision | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { kind?: string; to?: string };
    if (parsed.kind === "allow-redirect" && typeof parsed.to === "string") {
      return {
        kind: "allow-redirect",
        to: parsed.to,
        reason: "signup-existing",
      };
    }
    if (parsed.kind === "allow") {
      return { kind: "allow", reason: "login-existing" };
    }
    if (parsed.kind === "deny") {
      return {
        kind: "deny",
        redirectTo: "/login?error=no_account",
        reason: "login-no-account",
      };
    }
  } catch {
    // fall through
  }
  return null;
}
