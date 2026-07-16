"use client";

import type { ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type { BlogPostListItem, BlogPostStatus } from "@/lib/blog/queries";

export const BLOG_POST_STATUS_DISPLAY: Record<
  BlogPostStatus,
  { label: string; className: string }
> = {
  draft: { label: "Draft", className: "bg-slate-100 text-slate-700" },
  in_review: { label: "In Review", className: "bg-amber-100 text-amber-800" },
  approved: { label: "Approved", className: "bg-green-100 text-green-800" },
  published: { label: "Published", className: "bg-blue-100 text-blue-800" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-800" },
};

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatWordCount(wordCount: number | null) {
  return wordCount === null ? "None" : wordCount.toLocaleString("en-AU");
}

function Pill({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

export function BlogPostStatusPill({ status }: { status: BlogPostStatus }) {
  const display = BLOG_POST_STATUS_DISPLAY[status];
  return <Pill className={display.className}>{display.label}</Pill>;
}

function ArticleTitle({ post }: { post: BlogPostListItem }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-medium text-slate-900">
        {post.title}
      </p>
      <p className="mt-1 truncate text-xs text-slate-500">
        {post.topic ?? "No topic"}
      </p>
    </div>
  );
}

export default function ContentList({
  posts,
  totalCount,
  page,
  pageSize,
}: {
  posts: BlogPostListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  function pushWithParams(next: URLSearchParams) {
    const query = next.toString();
    router.push(`/dashboard/content${query ? `?${query}` : ""}`);
  }

  function openPost(postId: string) {
    router.push(`/dashboard/content/${postId}`);
  }

  function updatePage(nextPage: number) {
    const next = new URLSearchParams(searchParams.toString());
    if (nextPage <= 1) {
      next.delete("page");
    } else {
      next.set("page", String(nextPage));
    }
    pushWithParams(next);
  }

  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="divide-y divide-slate-100 md:hidden">
        {posts.map((post) => (
          <button
            key={post.id}
            type="button"
            onClick={() => openPost(post.id)}
            className="block w-full px-4 py-4 text-left transition-colors hover:bg-slate-50"
          >
            <div className="flex items-start justify-between gap-3">
              <ArticleTitle post={post} />
              <BlogPostStatusPill status={post.status} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-slate-400">Persona</dt>
                <dd className="mt-0.5 text-slate-700">
                  {post.persona ?? "None"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Words</dt>
                <dd className="mt-0.5 text-slate-700">
                  {formatWordCount(post.wordCount)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Created</dt>
                <dd className="mt-0.5 text-slate-700">
                  {formatDate(post.createdAt)}
                </dd>
              </div>
            </dl>
          </button>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-[980px] divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Article title</th>
              <th className="px-4 py-3">Topic</th>
              <th className="px-4 py-3">Persona</th>
              <th className="px-4 py-3">Word count</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {posts.map((post) => (
              <tr
                key={post.id}
                onClick={() => openPost(post.id)}
                className="cursor-pointer transition-colors hover:bg-slate-50"
              >
                <td className="px-4 py-3">
                  <ArticleTitle post={post} />
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {post.topic ?? "None"}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {post.persona ?? "None"}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {formatWordCount(post.wordCount)}
                </td>
                <td className="px-4 py-3">
                  <BlogPostStatusPill status={post.status} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                  {formatDate(post.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <span>
          Page {page} of {totalPages} - {totalCount} articles
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => updatePage(page - 1)}
            className="rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => updatePage(page + 1)}
            className="rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
