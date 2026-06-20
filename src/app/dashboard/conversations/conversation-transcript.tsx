import type { CaseDetailMessageRow } from "@/lib/cases";

function formatTime(date: Date) {
  return new Date(date).toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ConversationTranscript({
  messages,
}: {
  messages: CaseDetailMessageRow[];
}) {
  if (messages.length === 0) {
    return <p className="text-sm text-slate-400">No messages found.</p>;
  }

  return (
    <div className="space-y-4">
      {messages.map((message) => {
        const isUser = message.role === "user";
        return (
          <div
            key={message.id}
            className={`flex ${isUser ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[82%] rounded-lg px-4 py-2 text-sm ${
                isUser
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-800"
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              <p
                className={`mt-1 text-xs ${
                  isUser ? "text-blue-200" : "text-slate-400"
                }`}
              >
                {formatTime(message.createdAt)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
