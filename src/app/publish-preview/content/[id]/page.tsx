import Link from "next/link";
import { marked } from "marked";
import { notFound, redirect } from "next/navigation";

import { WordPressArticlePreview } from "@/components/article/wordpress-article-preview";
import { getCurrentTenant, getCurrentUser } from "@/lib/auth-context";
import {
  getBlogPostByIdForTenant,
  type BlogPostsSupabaseClient,
} from "@/lib/blog/queries";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import { withDashboardErrorLogging } from "@/lib/errors/wrap";
import type { TenantSettings } from "@/lib/publishing";
import { getAuthenticatedSupabaseClient } from "@/lib/supabase-client";
import { eq } from "drizzle-orm";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function bodyFragment(html: string) {
  return html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
}

async function publishHtml(post: {
  content: string;
  contentSemantic?: string | null;
  metadata: Record<string, unknown>;
}) {
  if (post.contentSemantic) return bodyFragment(post.contentSemantic);

  const bodyHtml =
    stringValue(post.metadata.body_html) ??
    stringValue(post.metadata.bodyHtml);
  if (bodyHtml) return bodyFragment(bodyHtml);

  const bodyMd =
    stringValue(post.metadata.body_md) ??
    stringValue(post.metadata.bodyMarkdown) ??
    stringValue(post.metadata.body_markdown);
  if (bodyMd) return marked.parse(bodyMd);

  return bodyFragment(post.content);
}

async function PublishPreviewPageImpl({
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
    .select({ settings: tenants.settings })
    .from(tenants)
    .where(eq(tenants.id, tenant.id))
    .limit(1);
  const tenantSettings = (tenantRow?.settings ?? {}) as TenantSettings;
  const settingsRecord = isRecord(tenantSettings) ? tenantSettings : {};
  const html = await publishHtml(post);

  return (
    <main className="min-h-screen bg-white">
      <div className="sticky top-0 z-50 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex rounded-lg border border-zinc-200 bg-zinc-50 p-1 text-sm font-medium">
            <Link
              href={`/dashboard/content/${post.id}`}
              className="rounded-md px-3 py-1.5 text-zinc-600 hover:text-zinc-950"
            >
              Draft
            </Link>
            <span className="rounded-md bg-white px-3 py-1.5 text-zinc-950 shadow-sm">
              Publish preview
            </span>
          </div>
          <p className="text-sm text-zinc-500">WordPress-style preview</p>
        </div>
      </div>

      <WordPressArticlePreview
        post={post}
        brandJson={settingsRecord.brandJson ?? {}}
        tenantName={tenant.name}
        publishHtml={html}
      />
    </main>
  );
}

export default withDashboardErrorLogging(PublishPreviewPageImpl, {
  route: "/publish-preview/content/[id]",
});

