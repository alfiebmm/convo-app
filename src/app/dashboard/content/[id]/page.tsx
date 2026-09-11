import { notFound, redirect } from "next/navigation";

import { getCurrentTenant, getCurrentUser } from "@/lib/auth-context";
import {
  getBlogPostByIdForTenant,
  type BlogPostsSupabaseClient,
} from "@/lib/blog/queries";
import { getWordPressConnectorForTenant } from "@/lib/blog/connectors/wordpress-settings-actions";
import { withDashboardErrorLogging } from "@/lib/errors/wrap";
import { getAuthenticatedSupabaseClient } from "@/lib/supabase-client";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

import { ArticleDetailViewWithPublishing } from "./article-detail";

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

  const wordpress = await getWordPressConnectorForTenant(tenant.id, {
    async getTenantSettings(tenantId) {
      const [row] = await db
        .select({ settings: tenants.settings })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);
      return row ? ((row.settings ?? {}) as Record<string, unknown>) : null;
    },
  });

  return (
    <ArticleDetailViewWithPublishing
      post={post}
      wordpressSiteUrl={wordpress.ok ? wordpress.config?.siteUrl ?? null : null}
    />
  );
}

export default withDashboardErrorLogging(ContentDetailPageImpl, {
  route: "/dashboard/content/[id]",
});
