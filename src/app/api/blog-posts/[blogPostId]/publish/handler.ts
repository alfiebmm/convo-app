import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { getTenantMembership } from "@/lib/auth-context";
import { canMutateCases } from "@/lib/auth/permissions";
import { publishBlogPost } from "@/lib/blog/publish";
import { db } from "@/lib/db";
import { blogPosts } from "@/lib/db/schema";

export const BLOG_POST_PUBLISH_ROUTE =
  "/api/blog-posts/[blogPostId]/publish";

type Membership = Awaited<ReturnType<typeof getTenantMembership>> | null;

export type BlogPostPublishRouteDeps = {
  getSessionUserId: () => Promise<string | null>;
  getPostTenantId: (blogPostId: string) => Promise<string | null>;
  getTenantMembership: (
    userId: string,
    tenantId: string,
  ) => Promise<Membership>;
  publishBlogPost: typeof publishBlogPost;
};

function json(body: unknown, init?: ResponseInit) {
  return Response.json(body, init);
}

export function buildBlogPostPublishRouteDeps(): BlogPostPublishRouteDeps {
  return {
    getSessionUserId: async () => {
      const session = await auth();
      return session?.user?.id ?? null;
    },
    async getPostTenantId(blogPostId) {
      const [post] = await db
        .select({ tenantId: blogPosts.tenantId })
        .from(blogPosts)
        .where(eq(blogPosts.id, blogPostId))
        .limit(1);
      return post?.tenantId ?? null;
    },
    getTenantMembership,
    publishBlogPost,
  };
}

function statusForPublishError(error: string) {
  if (error === "Blog post not found") return 404;
  if (
    error === "WordPress connection not configured" ||
    error.startsWith("Blog post cannot be published")
  ) {
    return 400;
  }
  return 500;
}

export async function handleBlogPostPublishPost(
  blogPostId: string,
  deps: BlogPostPublishRouteDeps = buildBlogPostPublishRouteDeps(),
) {
  const userId = await deps.getSessionUserId();
  if (!userId) return json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const tenantId = await deps.getPostTenantId(blogPostId);
  if (!tenantId) {
    return json({ ok: false, error: "Blog post not found" }, { status: 404 });
  }

  const membership = await deps.getTenantMembership(userId, tenantId);
  if (!membership || !canMutateCases(membership)) {
    return json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const result = await deps.publishBlogPost(blogPostId, {
    tenantId,
    actorUserId: userId,
  });

  if (!result.ok) {
    return json(result, { status: statusForPublishError(result.error) });
  }

  return json(result, { status: 200 });
}
