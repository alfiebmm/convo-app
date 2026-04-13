"use client";

import { useState } from "react";
import ConversationDetail from "./conversation-detail";

interface ConversationRow {
  id: string;
  visitorId: string | null;
  status: string;
  messageCount: number;
  startedAt: Date;
  lastMessage: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  completed: "bg-blue-100 text-blue-800",
  archived: "bg-slate-100 text-slate-800",
};

export default function ConversationList({
  conversations,
}: {
  conversations: ConversationRow[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <>
      <div className="mt-6 rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
        {conversations.map((convo) => (
          <button
            key={convo.id}
            onClick={() => setSelectedId(convo.id)}
            className="w-full px-6 py-4 text-left hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-900">
                    {convo.visitorId
                      ? `Visitor ${convo.visitorId.slice(0, 8)}...`
                      : "Anonymous"}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[convo.status] ?? "bg-slate-100 text-slate-800"}`}
                  >
                    {convo.status}
                  </span>
                  <span className="text-xs text-slate-400">
                    {convo.messageCount} messages
                  </span>
                </div>
                {convo.lastMessage && (
                  <p className="mt-1 text-sm text-slate-500 truncate">
                    {convo.lastMessage}
                  </p>
                )}
              </div>
              <span className="ml-4 text-xs text-slate-400 flex-shrink-0">
                {new Date(convo.startedAt).toLocaleDateString("en-AU", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </button>
        ))}
      </div>

      {selectedId && (
        <ConversationDetail
          conversationId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </>
  );
}
