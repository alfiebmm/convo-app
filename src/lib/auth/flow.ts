/**
 * CON-237 — Explicit auth flow disambiguation.
 *
 * The marketing site has two distinct CTAs: "Log in" (`/login`) and
 * "Sign up" (`/signup`). Both ultimately call `signIn("google")`, but the
 * NextAuth `signIn` callback has historically been unable to tell which
 * intent the user had — leading to existing users being bounced into
 * onboarding and to the `OAuthAccountNotLinked` foot-gun that used to be
 * papered over by `allowDangerousEmailAccountLinking`.
 *
 * This module is the source of truth for that disambiguation:
 *  - the entry-point routes set the `AUTH_FLOW_COOKIE` to "login" or
 *    "signup" immediately before redirecting to the provider,
 *  - the `signIn` callback in `src/lib/auth.ts` reads that cookie and
 *    consults `decideAuthFlow` to either allow, deny, or redirect.
 *
 * The decision logic is intentionally a pure function so it can be unit
 * tested without spinning up NextAuth, Postgres, or a browser.
 */

export const AUTH_FLOW_COOKIE = "convo_auth_flow";
export const AUTH_FLOW_COOKIE_MAX_AGE_SECONDS = 5 * 60; // 5 minutes

export type AuthFlow = "login" | "signup";

export function parseAuthFlow(value: string | null | undefined): AuthFlow | null {
  if (value === "login" || value === "signup") return value;
  return null;
}

/**
 * Outcome of evaluating an OAuth callback against the user's declared
 * intent. Consumed by the NextAuth `signIn` callback.
 */
export type AuthFlowDecision =
  | { kind: "allow"; reason: "login-existing" | "signup-new" }
  | { kind: "allow-redirect"; to: string; reason: "signup-existing" }
  | { kind: "deny"; redirectTo: string; reason: "login-no-account" };

/**
 * Pure decision function used by the `signIn` callback.
 *
 * Inputs:
 *  - `flow`          — what the user said they wanted to do
 *                      (from the `AUTH_FLOW_COOKIE`).
 *  - `existingUser`  — whether a user row already exists for the
 *                      provider-supplied email.
 *
 * Defaults:
 *  - If `flow` is null (no cookie, direct OAuth, callback retry, etc.)
 *    we treat it as "login" because that is the safer default — it
 *    will never silently provision a new user/tenant row.
 */
export function decideAuthFlow(args: {
  flow: AuthFlow | null;
  existingUser: boolean;
}): AuthFlowDecision {
  const flow = args.flow ?? "login";

  if (flow === "login") {
    if (args.existingUser) {
      return { kind: "allow", reason: "login-existing" };
    }
    return {
      kind: "deny",
      redirectTo: "/login?error=no_account",
      reason: "login-no-account",
    };
  }

  // flow === "signup"
  if (args.existingUser) {
    return {
      kind: "allow-redirect",
      to: "/dashboard?welcome=back",
      reason: "signup-existing",
    };
  }
  return { kind: "allow", reason: "signup-new" };
}
