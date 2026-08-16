import { notFound, redirect } from "next/navigation";

import { getCurrentTenant, getCurrentUser } from "@/lib/auth-context";
import {
  getBlogPostByIdForTenant,
  type BlogPostsSupabaseClient,
} from "@/lib/blog/queries";
import { withDashboardErrorLogging } from "@/lib/errors/wrap";
import { getAuthenticatedSupabaseClient } from "@/lib/supabase-client";

import { ArticleDetailView } from "./article-detail";

async function ContentDetailPageImpl({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [user, tenant, routeParams] = await Promise.all([
    getCurrentUser(),
    getCurrentTenant(),
    params,
  ]);

  if (!user) redirect("/login");
  if (!tenant) redirect("/onboarding");

  const supabase = getAuthenticatedSupabaseClient({
    userId: user.id,
    tenantId: tenant.id,
  });
  const post = await getBlogPostByIdForTenant({
    supabase: supabase as unknown as BlogPostsSupabaseClient,
    tenantId: tenant.id,
    postId: routeParams.id,
  });

  if (!post) notFound();

  return <ArticleDetailView post={post} />;
}

export default withDashboardErrorLogging(ContentDetailPageImpl, {
  route: "/dashboard/content/[id]",
});
