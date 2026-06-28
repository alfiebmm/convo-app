"use client";

/**
 * CON-PLATFORM-ADMIN-QA-1 — segment error boundary for /platform-admin/*.
 *
 * Catches thrown errors from server components (e.g. a failing tenants
 * query) so a single bad query no longer nukes the whole surface. We
 * deliberately do NOT render the stack trace or message into the DOM —
 * platform-admin is gated, but tenant-data leakage in error messages
 * (table names, IDs, query fragments) is still a confidentiality risk.
 *
 * The reset() callback re-runs the server component tree.
 */

import { useEffect } from "react";
import Link from "next/link";

export default function PlatformAdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to server logs for triage (digest is the Next.js error digest,
    // safe to log; the full Error object goes to Vercel/console).
    console.error("[platform-admin] segment error", {
      digest: error.digest,
      name: error.name,
      message: error.message,
    });
  }, [error]);

  return (
    <section className="mx-auto max-w-2xl">
      <div className="rounded-md border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="h-1 w-16 rounded-full bg-[#FF6B2C]" />
        <h1 className="mt-5 font-display text-2xl font-bold tracking-normal text-zinc-950">
          Something went wrong
        </h1>
        <p className="mt-3 text-sm text-zinc-600">
          The page hit an unexpected error. The platform-admin team has been
          notified via server logs. Try again — if it keeps failing, flag it in
          the team channel.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-zinc-500">
            digest: {error.digest}
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-md bg-[#FF6B2C] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#E85A1E]"
          >
            Retry
          </button>
          <Link
            href="/platform-admin"
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            Back to home
          </Link>
        </div>
      </div>
    </section>
  );
}
