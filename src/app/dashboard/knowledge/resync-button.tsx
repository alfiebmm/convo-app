"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface ResyncButtonProps {
  /** When true the button is rendered disabled (e.g. tenant has no domain). */
  disabled?: boolean;
  /** Optional tooltip shown when disabled. */
  disabledTitle?: string;
}

interface SyncJob {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  pagesTotal: number;
  pagesProcessed: number;
  pagesAdded: number;
  pagesUpdated: number;
  pagesUnchanged: number;
  pagesFailed: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

/**
 * Re-sync button for the Website Content card.
 *
 * Flow:
 *   1. POST /api/knowledge/site/resync                  -> jobId
 *   2. Poll GET /api/knowledge/site/sync-jobs/[jobId]   -> live progress
 *   3. On completion / failure, router.refresh() so the server-rendered
 *      stats reflect the new state.
 *
 * The job itself runs in background after() invocations on the server and
 * chains itself across multiple function invocations to fit Vercel Hobby's
 * 60s function cap. The UI just observes.
 */
export function ResyncButton({ disabled, disabledTitle }: ResyncButtonProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<SyncJob | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  // Cleanup any in-flight poll timer on unmount.
  useEffect(() => {
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, []);

  const isRunning = job?.status === "queued" || job?.status === "running";
  const isBusy = pending || isRunning;

  async function pollJob(jobId: string): Promise<void> {
    try {
      const res = await fetch(`/api/knowledge/site/sync-jobs/${jobId}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setError("Lost track of the sync job. Refresh to check status.");
        return;
      }
      const next: SyncJob = await res.json();
      setJob(next);

      if (next.status === "completed") {
        // Refresh the page-level stats (server component re-fetches).
        startTransition(() => router.refresh());
        // Clear the inline progress card after a brief moment so the user
        // sees the completion line, then it dissolves into the refreshed stats.
        pollTimer.current = setTimeout(() => setJob(null), 4000);
        return;
      }
      if (next.status === "failed") {
        setError(next.errorMessage ?? "Sync failed");
        return;
      }
      // Still running — poll again in 2s.
      pollTimer.current = setTimeout(() => pollJob(jobId), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Polling failed");
    }
  }

  async function handleClick() {
    setError(null);
    setJob(null);
    try {
      const res = await fetch("/api/knowledge/site/resync", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Re-sync failed");
        return;
      }
      const jobId: string = body.jobId;
      // Seed an optimistic job state so the UI shows "queued" immediately.
      setJob({
        id: jobId,
        status: "queued",
        pagesTotal: 0,
        pagesProcessed: 0,
        pagesAdded: 0,
        pagesUpdated: 0,
        pagesUnchanged: 0,
        pagesFailed: 0,
        errorMessage: null,
        startedAt: null,
        completedAt: null,
      });
      // Start polling.
      pollTimer.current = setTimeout(() => pollJob(jobId), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Re-sync failed");
    }
  }

  // Progress text composition.
  let progressText: string | null = null;
  if (job) {
    if (job.status === "queued") {
      progressText = "Queued\u2026";
    } else if (job.status === "running") {
      const total = job.pagesTotal || 0;
      const done = job.pagesProcessed || 0;
      progressText = total
        ? `Syncing ${done} / ${total} pages\u2026`
        : `Syncing ${done} pages\u2026`;
    } else if (job.status === "completed") {
      const total = job.pagesProcessed;
      progressText = `Done. ${total} pages processed (${job.pagesAdded} added, ${job.pagesUpdated} updated, ${job.pagesUnchanged} unchanged${job.pagesFailed ? `, ${job.pagesFailed} failed` : ""}).`;
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isBusy}
        title={disabled ? disabledTitle : undefined}
        className={
          disabled || isBusy
            ? "rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-400 cursor-not-allowed"
            : "rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 active:bg-slate-100"
        }
      >
        {isBusy ? "Re-syncing\u2026" : "Re-sync"}
      </button>
      {progressText ? (
        <p className="text-xs text-slate-500 text-right max-w-xs">{progressText}</p>
      ) : null}
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
