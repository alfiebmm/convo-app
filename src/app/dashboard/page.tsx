import { db } from "@/lib/db";
import { conversations, messages, content } from "@/lib/db/schema";
import { eq, desc, sql, and, or } from "drizzle-orm";
import Link from "next/link";
import { getCurrentTenant } from "@/lib/auth-context";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");
  const tenantId = tenant.id;

  // Fetch stats
  const [convoCountResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(conversations)
    .where(eq(conversations.tenantId, tenantId));

  const [messageCountResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(eq(conversations.tenantId, tenantId));

  const [contentQueueResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(content)
    .where(
      and(
        eq(content.tenantId, tenantId),
        or(
          eq(content.status, "pending"),
          eq(content.status, "review"),
          eq(content.status, "generating")
        )
      )
    );

  const [publishedResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(content)
    .where(
      and(
        eq(content.tenantId, tenantId),
        or(eq(content.status, "published"), eq(content.status, "approved"))
      )
    );

  const convoCount = convoCountResult?.count ?? 0;
  const messageCount = messageCountResult?.count ?? 0;
  const contentQueue = contentQueueResult?.count ?? 0;
  const publishedCount = publishedResult?.count ?? 0;

  // Recent conversations
  const recentConvos = await db
    .select()
    .from(conversations)
    .where(eq(conversations.tenantId, tenantId))
    .orderBy(desc(conversations.startedAt))
    .limit(5);

  // Content queue preview
  const recentContent = await db
    .select()
    .from(content)
    .where(
      and(
        eq(content.tenantId, tenantId),
        or(eq(content.status, "pending"), eq(content.status, "review"))
      )
    )
    .orderBy(desc(content.createdAt))
    .limit(5);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Overview</h1>
      <p className="mt-1 text-sm text-slate-500">
        Your chatbot performance and content pipeline at a glance.
      </p>

      {/* Stats Grid */}
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Conversations"
          value={convoCount.toString()}
          subtitle="Total"
        />
        <StatCard
          label="Messages"
          value={messageCount.toString()}
          subtitle="Total"
        />
        <StatCard
          label="Content Queue"
          value={contentQueue.toString()}
          subtitle="Pending review"
        />
        <StatCard
          label="Published"
          value={publishedCount.toString()}
          subtitle="Approved + live"
        />
      </div>

      {/* Recent Conversations */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Recent Conversations
          </h2>
          <Link
            href="/dashboard/conversations"
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            View all →
          </Link>
        </div>
        {recentConvos.length === 0 ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-12 text-center text-sm text-slate-400">
            No conversations yet. Install the widget on your site to get
            started.
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
            {recentConvos.map((convo) => (
              <div key={convo.id} className="px-6 py-3 flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-slate-900">
                    {convo.visitorId
                      ? `Visitor ${convo.visitorId.slice(0, 8)}...`
                      : "Anonymous"}
                  </span>
                  <span className="ml-3 text-xs text-slate-400">
                    {convo.messageCount} messages
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      convo.status === "active"
                        ? "bg-green-100 text-green-800"
                        : convo.status === "completed"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-slate-100 text-slate-800"
                    }`}
                  >
                    {convo.status}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(convo.startedAt).toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Content Queue */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Content Queue
          </h2>
          <Link
            href="/dashboard/content"
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            View all →
          </Link>
        </div>
        {recentContent.length === 0 ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-12 text-center text-sm text-slate-400">
            Content will appear here as conversations generate topics.
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
            {recentContent.map((item) => (
              <div key={item.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-slate-900 truncate block">
                    {item.title ?? "Untitled"}
                  </span>
                </div>
                <div className="ml-4 flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      item.type === "blog"
                        ? "bg-indigo-100 text-indigo-800"
                        : item.type === "faq"
                          ? "bg-cyan-100 text-cyan-800"
                          : "bg-orange-100 text-orange-800"
                    }`}
                  >
                    {item.type}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      item.status === "review"
                        ? "bg-purple-100 text-purple-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {item.status}
                  </span>
                  {item.seoScore !== null && (
                    <span className="text-xs text-slate-400">
                      SEO: {Math.round(item.seoScore * 100)}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
    </div>
  );
}
