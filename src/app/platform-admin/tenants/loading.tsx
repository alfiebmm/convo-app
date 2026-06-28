/**
 * CON-PLATFORM-ADMIN-QA-1 — loading skeleton for /platform-admin/tenants.
 *
 * Shape mirrors the eventual page (header + filter card + results table) so
 * the layout doesn't shift when the real data arrives. No animations
 * other than a single Tailwind `animate-pulse` on the data placeholders —
 * brand allows a subtle pulse but not flashing colour changes.
 */

function PulseLine({ className = "" }: { className?: string }) {
  return <div className={`h-4 rounded bg-zinc-200 ${className}`} />;
}

export default function PlatformAdminTenantsLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-live="polite">
      <div>
        <PulseLine className="h-8 w-40" />
        <PulseLine className="mt-3 h-4 w-72" />
      </div>

      {/* Filter card placeholder */}
      <div className="grid gap-3 rounded-md border border-zinc-200 bg-white p-4 md:grid-cols-5">
        <div className="space-y-2 md:col-span-2">
          <PulseLine className="h-3 w-16" />
          <PulseLine className="h-9 w-full" />
        </div>
        <div className="space-y-2">
          <PulseLine className="h-3 w-12" />
          <PulseLine className="h-24 w-full" />
        </div>
        <div className="space-y-2">
          <PulseLine className="h-3 w-14" />
          <PulseLine className="h-24 w-full" />
        </div>
        <div className="space-y-2">
          <PulseLine className="h-3 w-20" />
          <PulseLine className="h-9 w-full" />
        </div>
      </div>

      {/* Results table placeholder — six rows by eight columns */}
      <div className="overflow-hidden rounded-md border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 bg-zinc-100 px-4 py-3">
          <PulseLine className="h-3 w-32" />
        </div>
        <div className="divide-y divide-zinc-200">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="grid grid-cols-8 gap-3 px-4 py-4"
            >
              <PulseLine className="col-span-2" />
              <PulseLine />
              <PulseLine />
              <PulseLine />
              <PulseLine />
              <PulseLine />
              <PulseLine />
            </div>
          ))}
        </div>
      </div>

      <span className="sr-only">Loading tenants…</span>
    </div>
  );
}
