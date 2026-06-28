/**
 * CON-PLATFORM-ADMIN-QA-1 — segment-root loading skeleton.
 *
 * Renders whenever the segment is loading and there's no more specific
 * `loading.tsx` (e.g. /platform-admin home, audit detail).
 */

export default function PlatformAdminLoading() {
  return (
    <div
      className="mx-auto max-w-4xl animate-pulse"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="h-3 w-40 rounded bg-zinc-200" />
      <div className="mt-4 h-8 w-72 rounded bg-zinc-200" />
      <div className="mt-3 h-4 w-full max-w-md rounded bg-zinc-200" />
      <div className="mt-8 h-24 border-l-4 border-[#FF6B2C] bg-white shadow-sm" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
