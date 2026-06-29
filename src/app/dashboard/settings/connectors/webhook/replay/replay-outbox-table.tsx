"use client";

import { Fragment, useState, useTransition } from "react";

import type {
  DeliverPendingWebhooksSummary,
} from "@/lib/connectors/webhook/deliver";
import type {
  WebhookOutboxReplayRow,
  WebhookOutboxStatus,
} from "@/lib/connectors/webhook/replay-actions";
import { replayOutboxRow } from "./actions";

type Banner =
  | { tone: "success"; message: string }
  | { tone: "error"; message: string }
  | null;

const STATUS_CLASSES: Record<WebhookOutboxStatus, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-800",
  sent: "border-emerald-200 bg-emerald-50 text-emerald-800",
  failed: "border-red-200 bg-red-50 text-red-700",
  abandoned: "border-zinc-300 bg-zinc-100 text-zinc-700",
};

export function ReplayOutboxTable({ rows }: { rows: WebhookOutboxReplayRow[] }) {
  const [openPayloads, setOpenPayloads] = useState<Record<string, boolean>>({});
  const [banner, setBanner] = useState<Banner>(null);
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleReplay(rowId: string) {
    setBanner(null);
    setReplayingId(rowId);
    startTransition(async () => {
      try {
        const result = await replayOutboxRow(rowId);
        setBanner({ tone: "success", message: replayMessage(result) });
      } catch (error) {
        setBanner({
          tone: "error",
          message: error instanceof Error ? error.message : "Replay failed",
        });
      } finally {
        setReplayingId(null);
      }
    });
  }

  if (rows.length === 0) {
    return (
      <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-12 text-center text-sm text-zinc-500">
        No webhook outbox rows match this filter.
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {banner && <InlineBanner banner={banner} />}
      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Attempts</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Last error</th>
                <th className="px-4 py-3">Last attempt</th>
                <th className="px-4 py-3">Next attempt</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {rows.map((row) => {
                const payloadOpen = Boolean(openPayloads[row.id]);
                return (
                  <Fragment key={row.id}>
                    <tr className="align-top">
                      <td className="max-w-[14rem] px-4 py-3 font-mono text-xs text-zinc-700">
                        <span className="break-all">{row.id}</span>
                      </td>
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        {row.event}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${STATUS_CLASSES[row.status]}`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-700">
                        {row.attemptCount}
                      </td>
                      <td className="px-4 py-3 text-zinc-700">
                        {formatDateTime(row.createdAt)}
                      </td>
                      <td className="max-w-[18rem] px-4 py-3 text-zinc-700">
                        {row.lastError ? (
                          <span className="line-clamp-3">{row.lastError}</span>
                        ) : (
                          <span className="text-zinc-400">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-700">
                        {formatDateTime(row.lastAttemptAt)}
                      </td>
                      <td className="px-4 py-3 text-zinc-700">
                        {formatDateTime(row.nextAttemptAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex min-w-[9rem] flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => handleReplay(row.id)}
                            disabled={isPending && replayingId === row.id}
                            className="rounded-lg bg-[#FF6B2C] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#E85A1E] disabled:cursor-not-allowed disabled:bg-zinc-300"
                          >
                            {isPending && replayingId === row.id
                              ? "Replaying..."
                              : "Replay"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setOpenPayloads((current) => ({
                                ...current,
                                [row.id]: !payloadOpen,
                              }))
                            }
                            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                          >
                            {payloadOpen ? "Hide payload" : "View payload"}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {payloadOpen && (
                      <tr>
                        <td colSpan={9} className="bg-zinc-950 px-4 py-3">
                          <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-zinc-100">
                            {JSON.stringify(row.payload, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function replayMessage(result: DeliverPendingWebhooksSummary): string {
  if (result.sent > 0) return "Replay delivered successfully.";
  if (result.failed > 0) return "Replay failed permanently.";
  if (result.abandoned > 0) return "Replay was abandoned.";
  if (result.deferred > 0) return "Replay was queued for another attempt.";
  return "Replay completed with no eligible row.";
}

function InlineBanner({ banner }: { banner: Exclude<Banner, null> }) {
  const classes =
    banner.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-red-200 bg-red-50 text-red-700";
  return (
    <div role="status" className={`rounded-lg border px-4 py-3 text-sm ${classes}`}>
      {banner.message}
    </div>
  );
}

function formatDateTime(value: string | null): string {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
