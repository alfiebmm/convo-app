"use client";

import Link from "next/link";
import { useState } from "react";

import type { PrePublishChecklistResult } from "@/lib/blog/pre-publish-checklist";
import type { BlogPostStatus } from "@/lib/blog/queries";

const publishableStatuses = new Set<BlogPostStatus>([
  "draft",
  "approved",
  "update_pending",
  "published",
  "publish_failed",
]);

type Notice =
  | { kind: "success"; message: string; href?: string }
  | { kind: "error"; message: string };

export function PublishBlogPostButton({
  postId,
  status,
  prePublishChecklist,
  wordpressSiteUrl,
  onPublished,
}: {
  postId: string;
  status: BlogPostStatus;
  prePublishChecklist?: PrePublishChecklistResult | null;
  wordpressSiteUrl: string | null;
  onPublished?: () => void;
}) {
  if (!wordpressSiteUrl) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <button
          type="button"
          disabled
          className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 font-medium text-slate-400"
        >
          Publish
        </button>
        <Link
          href="/dashboard/settings/connectors/wordpress"
          className="font-medium text-orange-600 hover:text-orange-700"
        >
          Connect WordPress in Settings
        </Link>
      </div>
    );
  }

  return (
    <ConnectedPublishBlogPostButton
      postId={postId}
      status={status}
      prePublishChecklist={prePublishChecklist}
      wordpressSiteUrl={wordpressSiteUrl}
      onPublished={onPublished}
    />
  );
}

function ConnectedPublishBlogPostButton({
  postId,
  status,
  prePublishChecklist,
  wordpressSiteUrl,
  onPublished,
}: {
  postId: string;
  status: BlogPostStatus;
  prePublishChecklist?: PrePublishChecklistResult | null;
  wordpressSiteUrl: string;
  onPublished?: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const canPublish = publishableStatuses.has(status);
  const failingChecks =
    prePublishChecklist?.items.filter((item) => item.status === "fail").length ?? 0;
  const checklistOk = prePublishChecklist?.ok === true;
  const disabled = publishing || !canPublish || !checklistOk;
  const disabledTitle = !canPublish
    ? `Cannot publish from ${status} status`
    : !checklistOk
      ? `Fix ${failingChecks} failing pre-publish checks before publishing.`
      : "Publish to WordPress";

  async function publish() {
    setPublishing(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/blog-posts/${postId}/publish`, {
        method: "POST",
      });
      const body = (await response.json()) as {
        ok?: boolean;
        wpPostUrl?: string;
        error?: string;
      };

      if (!response.ok || !body.ok) {
        setNotice({
          kind: "error",
          message: body.error ?? "Failed to publish article",
        });
        return;
      }

      setConfirming(false);
      setNotice({
        kind: "success",
        message: "Article published to WordPress",
        href: body.wpPostUrl,
      });
      if (onPublished) {
        onPublished();
      } else {
        window.setTimeout(() => window.location.reload(), 1200);
      }
    } catch (error) {
      setNotice({
        kind: "error",
        message: error instanceof Error ? error.message : "Failed to publish article",
      });
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={disabled}
        title={disabledTitle}
        onClick={() => setConfirming(true)}
        className="rounded-lg bg-[#FF6B2C] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#E85A1E] disabled:cursor-not-allowed disabled:border disabled:border-slate-200 disabled:bg-slate-300 disabled:text-slate-500"
      >
        {publishing ? "Publishing..." : "Publish"}
      </button>

      {notice ? (
        <div
          role="status"
          className={`text-sm ${
            notice.kind === "success" ? "text-green-700" : "text-red-700"
          }`}
        >
          {notice.message}
          {notice.kind === "success" && notice.href ? (
            <a
              href={notice.href}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 font-medium text-orange-600 hover:text-orange-700"
            >
              View on WordPress
            </a>
          ) : null}
        </div>
      ) : null}

      {confirming ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="publish-blog-post-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4"
        >
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h2
              id="publish-blog-post-title"
              className="text-lg font-semibold text-slate-900"
            >
              Publish article
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Publish this article to {wordpressSiteUrl}?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={publishing}
                onClick={() => setConfirming(false)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={publishing}
                onClick={publish}
                className="rounded-lg bg-[#FF6B2C] px-4 py-2 text-sm font-medium text-white hover:bg-[#E85A1E] disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {publishing ? "Publishing..." : "Publish"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
