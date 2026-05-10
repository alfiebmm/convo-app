"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface ResyncButtonProps {
  /** When true the button is rendered disabled (e.g. tenant has no domain). */
  disabled?: boolean;
  /** Optional tooltip shown when disabled. */
  disabledTitle?: string;
}

/**
 * Re-sync button for the Website Content card. Fires
 * `POST /api/knowledge/site/resync` and reloads the page so the user
 * sees the empty (re-crawling) state immediately. The crawl itself
 * continues in the background via `after()` on the server.
 *
 * Full re-sync UX (progress bar, age warning, delta detection) is
 * tracked in CON-86.
 */
export function ResyncButton({ disabled, disabledTitle }: ResyncButtonProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleClick() {
    setError(null);
    try {
      const res = await fetch("/api/knowledge/site/resync", {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Re-sync failed");
        return;
      }
      // Trigger a server re-render so the page stats reflect the wipe.
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Re-sync failed");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || pending}
        title={disabled ? disabledTitle : undefined}
        className={
          disabled || pending
            ? "rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-400 cursor-not-allowed"
            : "rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 active:bg-slate-100"
        }
      >
        {pending ? "Re-syncing…" : "Re-sync"}
      </button>
      {error ? (
        <p className="text-xs text-rose-600">{error}</p>
      ) : null}
    </div>
  );
}
