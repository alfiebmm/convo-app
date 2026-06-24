/**
 * CON-98 — placeholder gate for the Convo platform-admin injection-events
 * dashboard. Future ticket will wire the data fetch + listing UI.
 *
 * Route guard:
 *   1. Must pass platform-admin middleware email allowlist.
 *   2. Must pass `requirePlatformStaff()` inside the admin layout.
 *
 * Intentionally does NOT query `platform_injection_events` yet. The table
 * lives in this PR's migration so future work can ship without another
 * schema change.
 */
export const dynamic = "force-dynamic";

// TODO(CON-NEW): wire data fetch + listing UI.
//   - Query platform_injection_events ordered by detected_at DESC.
//   - Group/filter by tenant + pattern_matched.
//   - Read via service role (this table has RLS on with no SELECT policy
//     for `authenticated`).
export default async function InjectionEventsPage() {
  return (
    <section className="max-w-3xl">
      <h1 className="font-display text-3xl font-semibold tracking-normal text-zinc-950">
        Injection events
      </h1>
      <p className="mt-4 text-sm text-zinc-600">
        Convo staff only — dashboard coming soon.
      </p>
      <p className="mt-2 text-xs text-zinc-500">
        Audit log of prompt-injection-defence triggers across all tenants.
        Data fetch + listing UI will land in a follow-up ticket.
      </p>
    </section>
  );
}
