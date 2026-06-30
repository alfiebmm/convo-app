/**
 * CON-239 \u2014 Dashboard landing redirect.
 *
 * `/dashboard` is the universal landing route after sign-in. If the
 * current user has no tenant membership we need to decide where to
 * send them next:
 *  - platform staff \u2192 `/platform-admin`
 *  - everyone else  \u2192 `/onboarding`
 *
 * Kept as a pure function so it can be unit-tested without spinning
 * up NextAuth, Postgres, or a browser. Consumed by
 * `src/app/dashboard/page.tsx`.
 */
export function resolveDashboardLandingRedirect(args: {
  hasTenant: boolean;
  isPlatformStaff: boolean;
}): string {
  if (args.hasTenant) {
    // Caller should not have invoked us; return /dashboard so the
    // redirect is a no-op rather than a bounce loop.
    return "/dashboard";
  }
  if (args.isPlatformStaff) {
    return "/platform-admin";
  }
  return "/onboarding";
}
