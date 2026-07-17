import { Suspense } from "react";
import { redirect } from "next/navigation";

import { getCurrentTenant, getCurrentUser } from "@/lib/auth-context";
import {
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
  };
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
  const contentData = await listBlogPostsForTenant({
    supabase: supabase as unknown as BlogPostsSupabaseClient,
    tenantId: tenant.id,
    filters,
  });

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
        <div className="mt-6 rounded-lg border border-slate-200 bg-white">
          <div className="p-12 text-center text-sm text-slate-400">
            No articles found. Articles will appear here once the content
            pipeline creates drafts from conversations.
          </div>
        </div>
      ) : (
        <ContentList
          posts={contentData.rows}
          totalCount={contentData.totalCount}
          page={contentData.page}
          pageSize={contentData.pageSize}
        />
      )}
    </div>
  );
}

// CON-error-logging: capture any throw from the content list render path.
export default withDashboardErrorLogging(ContentPageImpl, {
  route: "/dashboard/content",
});
