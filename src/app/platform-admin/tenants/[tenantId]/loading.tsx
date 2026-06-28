/**
 * CON-PLATFORM-ADMIN-QA-1 — loading skeleton for tenant detail.
 *
 * Mirrors the eventual layout: breadcrumb + title + tab bar, then the two-
 * column profile grid + side panel. Keeps the brand chrome (sidebar +
 * header band) rendered by the layout above this.
 */

function PulseLine({ className = "" }: { className?: string }) {
  return <div className={`h-4 rounded bg-zinc-200 ${className}`} />;
}

export default function PlatformAdminTenantDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-live="polite">
      <div>
        <PulseLine className="h-3 w-20" />
        <PulseLine className="mt-3 h-7 w-64" />
        <div className="mt-2 flex items-center gap-3">
          <PulseLine className="h-3 w-48" />
          <PulseLine className="h-5 w-20 rounded-full" />
        </div>
      </div>

      <div className="flex gap-3 border-b border-zinc-200 pb-2">
        {Array.from({ length: 5 }).map((_, idx) => (
          <PulseLine key={idx} className="h-4 w-20" />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="grid gap-4 rounded-md border border-zinc-200 bg-white p-5 md:grid-cols-2">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="space-y-2">
              <PulseLine className="h-3 w-24" />
              <PulseLine className="h-4 w-40" />
            </div>
          ))}
        </div>
        <div className="space-y-3 rounded-md border border-zinc-200 bg-white p-5">
          <PulseLine className="h-3 w-32" />
          <PulseLine className="h-40 w-full" />
        </div>
      </div>

      <span className="sr-only">Loading tenant…</span>
    </div>
  );
}
