"use client";

import { useState } from "react";

interface ContentItem {
  id: string;
  title: string | null;
  slug: string | null;
  type: string;
  status: string;
  metaDescription: string | null;
  body: string | null;
  seoScore: number | null;
  conversationId: string | null;
  createdAt: Date;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  generating: "bg-blue-100 text-blue-800",
  review: "bg-purple-100 text-purple-800",
  approved: "bg-green-100 text-green-800",
  published: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  archived: "bg-slate-100 text-slate-800",
};

const TYPE_COLORS: Record<string, string> = {
  blog: "bg-indigo-100 text-indigo-800",
  faq: "bg-cyan-100 text-cyan-800",
  page_section: "bg-orange-100 text-orange-800",
};

export default function ContentList({ items }: { items: ContentItem[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function updateStatus(id: string, status: string) {
    setUpdatingId(id);
    try {
      await fetch(`/api/content/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      // Refresh page to show updated data
      window.location.reload();
    } catch (err) {
      console.error("Failed to update:", err);
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      {items.map((item) => {
        const isExpanded = expandedId === item.id;
        return (
          <div
            key={item.id}
            className="rounded-lg border border-slate-200 bg-white"
          >
            {/* Card Header */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : item.id)}
              className="w-full px-6 py-4 text-left"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-slate-900 truncate">
                    {item.title ?? "Untitled"}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500 truncate">
                    {item.metaDescription ?? "No description"}
                  </p>
                </div>
                <div className="ml-4 flex items-center gap-2 flex-shrink-0">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_COLORS[item.type] ?? "bg-slate-100 text-slate-800"}`}
                  >
                    {item.type}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[item.status] ?? "bg-slate-100 text-slate-800"}`}
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
              <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
                <span>
                  {new Date(item.createdAt).toLocaleDateString("en-AU", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                {item.conversationId && (
                  <span>Source: {item.conversationId.slice(0, 8)}...</span>
                )}
              </div>
            </button>

            {/* Expanded Content */}
            {isExpanded && (
              <div className="border-t border-slate-100 px-6 py-4">
                <div className="prose prose-sm max-w-none text-slate-700 max-h-96 overflow-y-auto">
                  <pre className="whitespace-pre-wrap font-sans text-sm">
                    {item.body ?? "No content generated yet."}
                  </pre>
                </div>
                <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
                  {item.status === "review" && (
                    <>
                      <button
                        onClick={() => updateStatus(item.id, "approved")}
                        disabled={updatingId === item.id}
                        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => updateStatus(item.id, "rejected")}
                        disabled={updatingId === item.id}
                        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {item.status === "approved" && (
                    <button
                      onClick={() => updateStatus(item.id, "published")}
                      disabled={updatingId === item.id}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Publish
                    </button>
                  )}
                  {item.status !== "archived" && (
                    <button
                      onClick={() => updateStatus(item.id, "archived")}
                      disabled={updatingId === item.id}
                      className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Archive
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
