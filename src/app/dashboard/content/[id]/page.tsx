import { notFound, redirect } from "next/navigation";

import { getCurrentTenant, getCurrentUser } from "@/lib/auth-context";
import {
  getBlogPostByIdForTenant,
  type BlogPostsSupabaseClient,
} from "@/lib/blog/queries";
import { getWordPressConnectorForTenant } from "@/lib/blog/connectors/wordpress-settings-actions";
import { runPrePublishChecklist } from "@/lib/blog/pre-publish-checklist";
import { withDashboardErrorLogging } from "@/lib/errors/wrap";
import { getAuthenticatedSupabaseClient } from "@/lib/supabase-client";
import { db } from "@/lib/db";
import { messages, tenants } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import type { TenantSettings } from "@/lib/publishing";

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

  const [tenantRow] = await db
    .select({ settings: tenants.settings, domain: tenants.domain })
    .from(tenants)
    .where(eq(tenants.id, tenant.id))
    .limit(1);
  const tenantSettings = (tenantRow?.settings ?? {}) as TenantSettings;

  const sourceMessages = post.threadId
    ? await db
        .select({ content: messages.content })
        .from(messages)
        .where(eq(messages.conversationId, post.threadId))
        .orderBy(asc(messages.createdAt))
    : [];

  const checklist = runPrePublishChecklist(post, {
    settings: tenantSettings,
    brandJson:
      tenantSettings && typeof tenantSettings === "object" && !Array.isArray(tenantSettings)
        ? (tenantSettings as Record<string, unknown>).brandJson ?? {}
        : {},
    domain: tenantRow?.domain ?? null,
    sourceMessages,
  });

  const wordpress = await getWordPressConnectorForTenant(tenant.id, {
    async getTenantSettings(tenantId) {
      return tenantId === tenant.id ? ((tenantSettings ?? {}) as Record<string, unknown>) : null;
    },
  });

  return (
    <ArticleDetailViewWithPublishing
      post={post}
      checklist={checklist}
      wordpressSiteUrl={wordpress.ok ? wordpress.config?.siteUrl ?? null : null}
    />
  );
}

export default withDashboardErrorLogging(ContentDetailPageImpl, {
  route: "/dashboard/content/[id]",
});
