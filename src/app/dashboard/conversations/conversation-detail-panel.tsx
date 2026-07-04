import type { ReactNode } from "react";
import type { ConversationDetailRow } from "@/lib/cases";
import { CasePanelCloseButton } from "./case-detail-controls";
import { ConversationTranscript } from "./conversation-transcript";

function formatDateTime(date: Date | null | undefined) {
  if (!date) return "Not recorded";
  return new Date(date).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatLabel(value: string | null | undefined) {
  if (!value) return "None";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-slate-200 px-5 py-5">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default function ConversationDetailPanel({
  detail,
}: {
  detail: ConversationDetailRow;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35">
      <aside className="flex h-full w-full flex-col bg-white shadow-xl md:max-w-3xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Conversation detail
            </p>
            <h2 className="mt-1 break-words text-xl font-semibold text-slate-900">
              Conversation only
            </h2>
          </div>
          <CasePanelCloseButton />
        </div>

        <div className="overflow-y-auto">
          <Section title="Conversation summary">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-slate-500">Status</dt>
                <dd className="mt-1 text-slate-800">
                  {formatLabel(detail.conversation.status)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Visitor</dt>
                <dd className="mt-1 text-slate-800">
                  {detail.conversation.visitorId ?? "Not recorded"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Messages</dt>
                <dd className="mt-1 text-slate-800">
                  {detail.conversation.messageCount}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Started</dt>
                <dd className="mt-1 text-slate-800">
                  {formatDateTime(detail.conversation.startedAt)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Completed</dt>
                <dd className="mt-1 text-slate-800">
                  {formatDateTime(detail.conversation.completedAt)}
                </dd>
              </div>
            </dl>
          </Section>

          <Section title="Full transcript">
            <ConversationTranscript messages={detail.messages} />
          </Section>
        </div>
      </aside>
    </div>
  );
}
