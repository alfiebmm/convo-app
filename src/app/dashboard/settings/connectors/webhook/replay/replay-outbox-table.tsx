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

export function ReplayOutboxTable({
  rows,
  canReplay,
}: {
  rows: WebhookOutboxReplayRow[];
  canReplay: boolean;
}) {
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
        <div className="divide-y divide-zinc-100 md:hidden">
          {rows.map((row) => {
            const payloadOpen = Boolean(openPayloads[row.id]);
            return (
              <div key={row.id} className="px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900">
                      {row.event}
                    </p>
                    <p className="mt-1 break-all font-mono text-xs text-zinc-500">
                      {row.id}
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 rounded-full border px-2 py-1 text-xs font-medium ${STATUS_CLASSES[row.status]}`}
                  >
                    {row.status}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="text-zinc-400">Attempts</dt>
                    <dd className="mt-0.5 text-zinc-700">{row.attemptCount}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-400">Created</dt>
                    <dd className="mt-0.5 text-zinc-700">
                      {formatDateTime(row.createdAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-400">Last attempt</dt>
                    <dd className="mt-0.5 text-zinc-700">
                      {formatDateTime(row.lastAttemptAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-400">Next attempt</dt>
                    <dd className="mt-0.5 text-zinc-700">
                      {formatDateTime(row.nextAttemptAt)}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-zinc-400">Last error</dt>
                    <dd className="mt-0.5 text-zinc-700">
                      {row.lastError || "None"}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">
                  <ReplayButton
                    rowId={row.id}
                    canReplay={canReplay}
                    isActive={isPending && replayingId === row.id}
                    onReplay={handleReplay}
                  />
                  <PayloadToggle
                    payloadOpen={payloadOpen}
                    onToggle={() =>
                      setOpenPayloads((current) => ({
                        ...current,
                        [row.id]: !payloadOpen,
                      }))
                    }
                  />
                </div>
                {payloadOpen && <PayloadPreview payload={row.payload} />}
              </div>
            );
          })}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-[1180px] divide-y divide-zinc-200 text-sm">
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
                          <ReplayButton
                            rowId={row.id}
                            canReplay={canReplay}
                            isActive={isPending && replayingId === row.id}
                            onReplay={handleReplay}
                          />
                          <PayloadToggle
                            payloadOpen={payloadOpen}
                            onToggle={() =>
                              setOpenPayloads((current) => ({
                                ...current,
                                [row.id]: !payloadOpen,
                              }))
                            }
                          />
                        </div>
                      </td>
                    </tr>
                    {payloadOpen && (
                      <tr>
                        <td colSpan={9} className="bg-zinc-950 px-4 py-3">
                          <PayloadPreview payload={row.payload} />
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

function ReplayButton({
  rowId,
  canReplay,
  isActive,
  onReplay,
}: {
  rowId: string;
  canReplay: boolean;
  isActive: boolean;
  onReplay: (rowId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onReplay(rowId)}
      disabled={!canReplay || isActive}
      title={canReplay ? undefined : "Connector management permission required"}
      className="rounded-lg bg-[#FF6B2C] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#E85A1E] disabled:cursor-not-allowed disabled:bg-zinc-300"
    >
      {isActive ? "Replaying..." : "Replay"}
    </button>
  );
}

function PayloadToggle({
  payloadOpen,
  onToggle,
}: {
  payloadOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
    >
      {payloadOpen ? "Hide payload" : "View payload"}
    </button>
  );
}

function PayloadPreview({ payload }: { payload: Record<string, unknown> }) {
  return (
    <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-zinc-950 p-3 text-xs leading-5 text-zinc-100 md:mt-0 md:rounded-none md:p-0">
      {JSON.stringify(payload, null, 2)}
    </pre>
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
