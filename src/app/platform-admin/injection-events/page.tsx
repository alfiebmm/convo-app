/**
 * CON-98 — placeholder gate for the Convo platform-admin injection-events
 * dashboard. Future ticket will wire the data fetch + listing UI.
 *
 * Route guard:
 *   1. Must be authenticated (redirect to /login).
 *   2. Must have `users.is_platform_staff = true` (404 otherwise — we don't
 *      reveal the route's existence to tenant users).
 *
 * Intentionally does NOT query `platform_injection_events` yet. The table
 * lives in this PR's migration so future work can ship without another
 * schema change.
 */
import { getCurrentUser } from "@/lib/auth-context";
import { redirect, notFound } from "next/navigation";

export const dynamic = "force-dynamic";

// TODO(CON-NEW): wire data fetch + listing UI.
//   - Query platform_injection_events ordered by detected_at DESC.
//   - Group/filter by tenant + pattern_matched.
//   - Read via service role (this table has RLS on with no SELECT policy
//     for `authenticated`).
export default async function InjectionEventsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // `is_platform_staff` is a Convo-staff-only flag. Show 404 to anyone
  // else so the route doesn't advertise itself.
  if (!user.isPlatformStaff) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold">Injection events</h1>
      <p className="mt-4 text-sm text-zinc-600">
        Convo staff only — dashboard coming soon.
      </p>
      <p className="mt-2 text-xs text-zinc-500">
        Audit log of prompt-injection-defence triggers across all tenants.
        Data fetch + listing UI will land in a follow-up ticket.
      </p>
    </main>
  );
}
