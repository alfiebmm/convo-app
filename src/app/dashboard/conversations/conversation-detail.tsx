"use client";

import { useState, useEffect } from "react";

interface Message {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

export default function ConversationDetail({
  conversationId,
  needsFollowup: initialNeedsFollowup,
  resolvedAt: initialResolvedAt,
  onClose,
  onMutated,
}: {
  conversationId: string;
  needsFollowup: boolean;
  resolvedAt: Date | null;
  onClose: () => void;
  onMutated?: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsFollowup, setNeedsFollowup] = useState(initialNeedsFollowup);
  const [resolvedAt, setResolvedAt] = useState<Date | null>(
    initialResolvedAt ? new Date(initialResolvedAt) : null
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `/api/conversations/${conversationId}/messages`
        );
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages);
        }
      } catch (err) {
        console.error("Failed to load messages:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [conversationId]);

  async function patch(
    body: { needsFollowup?: boolean; resolved?: boolean },
    optimistic: () => void
  ) {
    setBusy(true);
    setError(null);
    optimistic();
    try {
      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setNeedsFollowup(Boolean(data.conversation.needsFollowup));
      setResolvedAt(
        data.conversation.resolvedAt
          ? new Date(data.conversation.resolvedAt)
          : null
      );
      onMutated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
      // Revert: re-read from server props on next render via parent refresh.
      onMutated?.();
    } finally {
      setBusy(false);
    }
  }

  function flag() {
    patch({ needsFollowup: true }, () => {
      setNeedsFollowup(true);
      setResolvedAt(null);
    });
  }

  function unflag() {
    patch({ needsFollowup: false }, () => setNeedsFollowup(false));
  }

  function resolve() {
    patch({ resolved: true }, () => {
      setNeedsFollowup(false);
      setResolvedAt(new Date());
    });
  }

  function reopen() {
    patch({ resolved: false }, () => setResolvedAt(null));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-semibold text-slate-900">
              Conversation Transcript
            </h3>
            {needsFollowup && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                🚩 Follow-up
              </span>
            )}
            {resolvedAt && !needsFollowup && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                ✓ Resolved
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-6 py-3">
          {!needsFollowup ? (
            <button
              onClick={flag}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
            >
              🚩 Mark for follow-up
            </button>
          ) : (
            <button
              onClick={unflag}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              Clear flag
            </button>
          )}

          {!resolvedAt ? (
            <button
              onClick={resolve}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
            >
              ✓ Resolve
            </button>
          ) : (
            <button
              onClick={reopen}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              Re-open
            </button>
          )}

          {error && (
            <span className="text-xs text-rose-600 ml-auto">{error}</span>
          )}
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-6 space-y-4">
          {loading ? (
            <p className="text-sm text-slate-400">Loading messages...</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-slate-400">No messages found.</p>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-800"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <p
                    className={`mt-1 text-xs ${msg.role === "user" ? "text-blue-200" : "text-slate-400"}`}
                  >
                    {new Date(msg.createdAt).toLocaleTimeString("en-AU", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
