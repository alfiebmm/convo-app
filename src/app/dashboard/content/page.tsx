import { Suspense } from "react";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentTenant, getCurrentUser } from "@/lib/auth-context";
import {
  countFailedBlogPostsForTenant,
  listBlogPostsForTenant,
  parseBlogPostPage,
  parseBlogPostStatus,
  type BlogPostsSupabaseClient,
  type BlogPostListFilters,
} from "@/lib/blog/queries";
import { withDashboardErrorLogging } from "@/lib/errors/wrap";
import { getAuthenticatedSupabaseClient } from "@/lib/supabase-client";

import { ContentFilters } from "./content-filters";
import ContentList from "./content-list";

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function toBlogPostFilters(
  params: Record<string, string | string[] | undefined>,
): BlogPostListFilters {
  return {
    status: parseBlogPostStatus(firstSearchParam(params.status)),
    topic: firstSearchParam(params.topic),
    persona: firstSearchParam(params.persona),
    page: parseBlogPostPage(firstSearchParam(params.page)),
    includeFailed: firstSearchParam(params.includeFailed) === "1",
  };
}

const getCachedFailedCount = unstable_cache(
  async (userId: string, tenantId: string) => {
    const supabase = getAuthenticatedSupabaseClient({ userId, tenantId });
    return countFailedBlogPostsForTenant({
      supabase: supabase as unknown as BlogPostsSupabaseClient,
      tenantId,
    });
  },
  ["dashboard-content-failed-count"],
  { revalidate: 60 },
);

function includeFailedHref(
  params: Record<string, string | string[] | undefined>,
) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const firstValue = firstSearchParam(value);
    if (firstValue && key !== "page") next.set(key, firstValue);
  }
  next.set("includeFailed", "1");
  return `/dashboard/content?${next.toString()}`;
}

export function EmptyContentState({
  failedCount,
  showFailedHref,
}: {
  failedCount: number;
  showFailedHref: string;
}) {
  const hasHiddenFailures = failedCount > 0;

  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-white">
      <div className="p-12 text-center text-sm text-slate-400">
        {hasHiddenFailures ? (
          <>
            No published articles yet. You have {failedCount} generations that
            didn&apos;t clear our quality gates on earlier runs.{" "}
            <Link
              href={showFailedHref}
              className="font-medium text-orange-600 hover:text-orange-700"
            >
              Show failed generations →
            </Link>
          </>
        ) : (
          <>
            No articles found. Articles will appear here once the content
            pipeline creates drafts from conversations.
          </>
        )}
      </div>
    </div>
  );
}

async function ContentPageImpl({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [user, tenant] = await Promise.all([getCurrentUser(), getCurrentTenant()]);
  if (!user) redirect("/login");
  if (!tenant) redirect("/onboarding");

  const params = await searchParams;
  const filters = toBlogPostFilters(params);
  const supabase = getAuthenticatedSupabaseClient({
    userId: user.id,
    tenantId: tenant.id,
  });
  const [contentData, failedCount] = await Promise.all([
    listBlogPostsForTenant({
      supabase: supabase as unknown as BlogPostsSupabaseClient,
      tenantId: tenant.id,
      filters,
    }),
    getCachedFailedCount(user.id, tenant.id),
  ]);

  return (
    <div>
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Content</h1>
          <p className="mt-1 text-sm text-slate-500">
            Generated articles ready for review, approval, and publishing.
          </p>
        </div>
        <Suspense>
          <ContentFilters />
        </Suspense>
      </div>

      {contentData.totalCount === 0 ? (
        <EmptyContentState
          failedCount={filters.includeFailed ? 0 : failedCount}
          showFailedHref={includeFailedHref(params)}
        />
      ) : (
        <ContentList
          posts={contentData.rows}
          totalCount={contentData.totalCount}
          page={contentData.page}
          pageSize={contentData.pageSize}
          includeFailed={Boolean(filters.includeFailed)}
          failedCount={failedCount}
        />
      )}
    </div>
  );
}

// CON-error-logging: capture any throw from the content list render path.
export default withDashboardErrorLogging(ContentPageImpl, {
  route: "/dashboard/content",
});
