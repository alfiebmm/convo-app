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
  onClose,
}: {
  conversationId: string;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-900">
            Conversation Transcript
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-6 space-y-4">
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
