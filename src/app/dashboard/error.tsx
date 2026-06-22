"use client";

/**
 * CON-error-logging: dashboard client error boundary.
 *
 * Next.js renders this whenever a server component (or a child client
 * component) under `/dashboard/*` throws and is not caught by a closer
 * `error.tsx`. We POST the error context to `/api/error-log` so the
 * server side can persist a row in `dashboard_errors` carrying the
 * Vercel `error.digest`, the message, and the stack.
 *
 * Hard rules:
 *
 *   - Fire-and-forget. Do not block the UI on the POST. Do not retry on
 *     failure (the server returns 204 even on partial logging failure).
 *   - Run exactly once per error instance. Avoid the `useEffect` double-
 *     fire in React 19 by keying off a `useRef` guard.
 *   - Do not include sensitive UI state in the body. We only forward the
 *     fields Next.js gives us on the error object plus the current
 *     pathname for route attribution.
 */
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  const pathname = usePathname();
  const reportedRef = useRef<string | null>(null);

  useEffect(() => {
    // De-dupe: log this exact error instance once. `error.digest` is the
    // stable identifier Next.js attaches per server-component throw; if it's
    // absent (pure client-side throws), fall back to the error message.
    const key = error.digest ?? error.message ?? "unknown";
    if (reportedRef.current === key) return;
    reportedRef.current = key;

    const payload = {
      digest: error.digest,
      errorClass: error.name,
      message: error.message,
      stack: error.stack,
      route: pathname ?? "/dashboard",
      requestMeta: {
        source: "client-error-boundary",
        // `userAgent` is available client-side; the server allow-list
        // accepts `user-agent` on `headers`, so we forward through headers.
        headers: { "user-agent": navigator.userAgent },
      },
    };

    // Use `keepalive` so the POST survives a fast navigation away from the
    // error boundary (e.g. user clicks "Try again" or navigates back).
    fetch("/api/error-log", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // Swallow — the server boundary already swallows logging failures,
      // and a client-side retry loop is worse than a missed log row.
    });
  }, [error, pathname]);

  return (
    <div className="mx-auto max-w-2xl rounded-lg border border-rose-200 bg-rose-50 p-6">
      <h2 className="text-lg font-semibold text-rose-900">Something went wrong</h2>
      <p className="mt-2 text-sm text-rose-800">
        The dashboard hit an unexpected error. We&apos;ve recorded the details and
        the team will look into it. You can try again, or reload the page.
      </p>
      {error.digest && (
        <p className="mt-3 text-xs text-rose-700">
          Reference: <code className="font-mono">{error.digest}</code>
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-rose-300 bg-white px-3 py-1.5 text-sm font-medium text-rose-900 transition-colors hover:bg-rose-100"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
