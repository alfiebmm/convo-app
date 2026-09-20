import type { ReactNode } from "react";
import type { ConversationDetailRow } from "@/lib/cases";
import { getBlogConversionState } from "@/lib/blog/trigger";
import { CasePanelCloseButton, ConvertToBlogButton } from "./case-detail-controls";
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
    .split(/[_-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function summariseSkipReason(reason: string) {
  const lower = reason.toLowerCase();
  if (lower.includes("duplicate")) return "Skipped: duplicate";
  if (lower.includes("below minimum") || lower.includes("word count")) {
    return "Skipped: too short";
  }
  if (lower.includes("exclusion list")) return "Skipped: excluded topic";
  if (lower.includes("insufficient keyword") || lower.includes("intent")) {
    return "Skipped: insufficient signal";
  }
  if (lower.includes("similar")) return "Skipped: similar existing post";
  if (lower.includes("generation failure")) return "Skipped: generation failure";
  return "Skipped";
}

function blogDecisionLabel(action: string, reason: string) {
  if (action === "skip-covered") return "Skip-covered";
  if (action === "skip-nosignal" || action === "skip") {
    return summariseSkipReason(reason).replace("Skipped", "Skip-nosignal");
  }
  if (action === "failure") return "Generation failure";
  return formatLabel(action);
}

function blogDecisionColor(action: string) {
  if (action === "skip-covered") return "bg-blue-100 text-blue-800";
  if (action === "skip-nosignal" || action === "skip") {
    return "bg-amber-100 text-amber-800";
  }
  if (action === "failure") return "bg-red-100 text-red-800";
  return "bg-green-100 text-green-800";
}

function ContentLink({ id, children }: { id: string; children: ReactNode }) {
  return (
    <a
      href={`/dashboard/content/${id}`}
      className="font-medium text-blue-700 hover:text-blue-900"
    >
      {children}
    </a>
  );
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
  const blogState = getBlogConversionState(detail.conversation.metadata);
  const latestBlogDecision = detail.conversation.latestBlogDecision;

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

          <Section title="Blog">
            {latestBlogDecision && (
              <div className="mb-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${blogDecisionColor(
                      latestBlogDecision.action
                    )}`}
                  >
                    {blogDecisionLabel(
                      latestBlogDecision.action,
                      latestBlogDecision.reason
                    )}
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatDateTime(latestBlogDecision.createdAt)}
                  </span>
                </div>
                <p className="mt-2 text-slate-700">{latestBlogDecision.reason}</p>
                <dl className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                  {latestBlogDecision.generatedBlogPostId && (
                    <div>
                      <dt className="font-medium text-slate-500">Generated draft</dt>
                      <dd className="mt-0.5">
                        <ContentLink id={latestBlogDecision.generatedBlogPostId}>
                          {latestBlogDecision.generatedBlogPostId}
                        </ContentLink>
                      </dd>
                    </div>
                  )}
                  {(latestBlogDecision.selectedTargetPostId ??
                    latestBlogDecision.targetBlogPostId) && (
                    <div>
                      <dt className="font-medium text-slate-500">
                        {latestBlogDecision.action === "skip-covered"
                          ? "Existing article"
                          : "Update target"}
                      </dt>
                      <dd className="mt-0.5">
                        <ContentLink
                          id={
                            latestBlogDecision.selectedTargetPostId ??
                            latestBlogDecision.targetBlogPostId ??
                            ""
                          }
                        >
                          {latestBlogDecision.selectedTargetPostId ??
                            latestBlogDecision.targetBlogPostId}
                        </ContentLink>
                      </dd>
                    </div>
                  )}
                  {latestBlogDecision.updateDraftBlogPostId && (
                    <div>
                      <dt className="font-medium text-slate-500">Update draft</dt>
                      <dd className="mt-0.5">
                        <ContentLink id={latestBlogDecision.updateDraftBlogPostId}>
                          {latestBlogDecision.updateDraftBlogPostId}
                        </ContentLink>
                      </dd>
                    </div>
                  )}
                  {latestBlogDecision.failureBlogPostId && (
                    <div>
                      <dt className="font-medium text-slate-500">Failure record</dt>
                      <dd className="mt-0.5">
                        <ContentLink id={latestBlogDecision.failureBlogPostId}>
                          {latestBlogDecision.failureBlogPostId}
                        </ContentLink>
                      </dd>
                    </div>
                  )}
                  {latestBlogDecision.failureReason && (
                    <div className="sm:col-span-2">
                      <dt className="font-medium text-slate-500">Failure reason</dt>
                      <dd className="mt-0.5 text-slate-700">
                        {latestBlogDecision.failureReason}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            )}
            <ConvertToBlogButton
              conversationId={detail.conversation.id}
              initialState={blogState}
            />
          </Section>

          <Section title="Full transcript">
            <ConversationTranscript messages={detail.messages} />
          </Section>
        </div>
      </aside>
    </div>
  );
}
