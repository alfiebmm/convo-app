import { db } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema";
import { eq, and, desc, isNotNull, isNull, type SQL } from "drizzle-orm";
import ConversationList from "./conversation-list";
import { ConversationStatusFilter } from "./conversation-filters";
import { Suspense } from "react";
import { getCurrentTenant } from "@/lib/auth-context";
import { redirect } from "next/navigation";

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const params = await searchParams;
  const statusFilter = params.status;

  const conditions: SQL[] = [eq(conversations.tenantId, tenant.id)];

  // Filter handles two axes: lifecycle status (active/completed/archived)
  // AND triage flags (needs_followup/resolved). Triage filters take
  // precedence when selected.
  if (statusFilter === "needs_followup") {
    conditions.push(eq(conversations.needsFollowup, true));
  } else if (statusFilter === "resolved") {
    conditions.push(isNotNull(conversations.resolvedAt));
  } else if (
    statusFilter === "active" ||
    statusFilter === "completed" ||
    statusFilter === "archived"
  ) {
    conditions.push(eq(conversations.status, statusFilter));
  }

  const convos = await db
    .select()
    .from(conversations)
    .where(and(...conditions))
    .orderBy(
      // Pin needs-follow-up rows to the top, then newest first.
      desc(conversations.needsFollowup),
      desc(conversations.startedAt)
    )
    .limit(100);

  // Get last message for each conversation
  const convoData = await Promise.all(
    convos.map(async (convo) => {
      const [lastMsg] = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, convo.id))
        .orderBy(desc(messages.createdAt))
        .limit(1);

      return {
        id: convo.id,
        visitorId: convo.visitorId,
        status: convo.status,
        messageCount: convo.messageCount,
        startedAt: convo.startedAt,
        lastMessage: lastMsg?.content ?? null,
        needsFollowup: convo.needsFollowup,
        resolvedAt: convo.resolvedAt,
      };
    })
  );

  // Suppress unused import warning when filter logic doesn't hit isNull yet.
  void isNull;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Conversations</h1>
          <p className="mt-1 text-sm text-slate-500">
            All chatbot conversations from your site visitors.
          </p>
        </div>
        <Suspense>
          <div className="flex gap-2">
            <ConversationStatusFilter />
          </div>
        </Suspense>
      </div>

      {convoData.length === 0 ? (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white">
          <div className="p-12 text-center text-sm text-slate-400">
            No conversations yet. Conversations will appear here once visitors
            start chatting with your widget.
          </div>
        </div>
      ) : (
        <ConversationList conversations={convoData} />
      )}
    </div>
  );
}
