"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * CON-237 — When an existing user lands on `/signup`, the NextAuth
 * `signIn` callback redirects them to `/dashboard?welcome=back` instead
 * of running the onboarding wizard again. This client component shows a
 * one-time toast and strips the query param so a refresh doesn't replay
 * it.
 *
 * Pattern: visibility is seeded once from the URL on first render via
 * the lazy `useState` initialiser. The effect strips the query param
 * (so a refresh doesn't replay) and arms a dismiss timer. We never call
 * setState synchronously inside an effect just to turn the toast on
 * — that hits both the project lint rule and a React 19 warning.
 */
export function WelcomeBackToast() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Lazy initialiser runs exactly once on first render. After the
  // effect calls `router.replace` to strip the param, `searchParams`
  // will no longer say "welcome=back" — but `visible` keeps its
  // seeded-true value until the dismiss timer flips it.
  const [visible, setVisible] = useState(
    () => searchParams.get("welcome") === "back",
  );

  useEffect(() => {
    if (!visible) return;

    // Strip the `welcome` query param so a refresh doesn't replay the
    // toast and so we don't tell a returning user "welcome back" every
    // time they hit /dashboard.
    const next = new URLSearchParams(searchParams.toString());
    if (next.has("welcome")) {
      next.delete("welcome");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }

    const timer = window.setTimeout(() => setVisible(false), 6000);
    return () => window.clearTimeout(timer);
    // We intentionally only want this to run once per mount — the
    // visibility decision is fixed at first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 max-w-sm rounded-lg border border-orange-200 bg-white px-4 py-3 shadow-lg"
    >
      <div className="flex items-start gap-3">
        <div className="font-display text-base font-bold text-zinc-950">
          Welcome back
        </div>
      </div>
      <p className="mt-1 text-sm text-zinc-600">
        You already have a Convo account, so we skipped the signup wizard.
      </p>
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="absolute right-2 top-2 text-xs text-zinc-400 hover:text-zinc-700"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
