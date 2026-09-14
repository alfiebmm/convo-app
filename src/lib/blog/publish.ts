import { and, asc, eq } from "drizzle-orm";

import { getDecryptedWordPressConnectorForTenant } from "@/lib/blog/connectors/wordpress-settings-actions";
import {
  publishArticle,
  type WordPressConfig,
} from "@/lib/blog/connectors/wordpress";
import {
  runPrePublishChecklist,
  type PrePublishChecklistResult,
} from "@/lib/blog/pre-publish-checklist";
import type { BlogPostDetail, BlogPostStatus } from "@/lib/blog/queries";
import { assertTenantId } from "@/lib/cases/tenant-guard";
import { db } from "@/lib/db";
import { blogPosts, messages, tenants } from "@/lib/db/schema";
import type { TenantSettings } from "@/lib/publishing";

/*
 * draft | approved | update_pending | published | publish_failed
 *         │
 *         ▼ publishBlogPost()
 *      publishing
 *         ├── ok  → published (metadata.published populated)
 *         └── err → publish_failed (metadata.publish_error populated)
 *                     │
 *                     ▼ retry publishBlogPost()
 *                  publishing → ...
 */

export type PublishBlogPostContext = {
  tenantId: string;
  actorUserId: string;
};

export type PublishBlogPostResult =
  | {
      ok: true;
      wpPostId: number;
      wpPostUrl: string;
      preflight: PrePublishChecklistResult | null;
    }
  | { ok: false; error: string; preflight: PrePublishChecklistResult | null };

type BlogPostUpdate = {
  status: BlogPostStatus;
  metadata: Record<string, unknown>;
  publishedAt?: Date | null;
  lastModified: Date;
};

export type PublishBlogPostDeps = {
  getBlogPost: (blogPostId: string, tenantId: string) => Promise<BlogPostDetail | null>;
  getPrePublishChecklistTenant: (
    post: BlogPostDetail,
  ) => Promise<{
    settings: TenantSettings;
    brandJson: unknown;
    domain?: string | null;
    sourceMessages?: Array<{ content: string | null }>;
  }>;
  getDecryptedWordPressConnectorForTenant: (
    tenantId: string,
  ) => Promise<WordPressConfig | null>;
  updateBlogPost: (
    blogPostId: string,
    tenantId: string,
    update: BlogPostUpdate,
  ) => Promise<void>;
  publishArticle: typeof publishArticle;
  now: () => Date;
};

const publishableStatuses = new Set<BlogPostStatus>([
  "draft",
  "approved",
  "update_pending",
  "published",
  "publish_failed",
]);

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function publicErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error || "Failed to publish article");
}

function mapBlogPostRow(row: typeof blogPosts.$inferSelect): BlogPostDetail {
  return {
    id: row.id,
    tenantId: row.tenantId,
    threadId: row.threadId,
    title: row.title,
    slug: row.slug,
    content: row.content,
    contentSemantic: row.contentSemantic,
    metadata: metadataRecord(row.metadata),
    status: row.status,
    persona: row.persona,
    topic: row.topic,
    createdAt: row.createdAt,
    publishedAt: row.publishedAt,
    lastModified: row.lastModified,
  };
}

function buildPublishBlogPostDeps(): PublishBlogPostDeps {
  return {
    async getBlogPost(blogPostId, tenantId) {
      const [post] = await db
        .select()
        .from(blogPosts)
        .where(and(eq(blogPosts.id, blogPostId), eq(blogPosts.tenantId, tenantId)))
        .limit(1);
      return post ? mapBlogPostRow(post) : null;
    },
    async getDecryptedWordPressConnectorForTenant(tenantId) {
      const [tenant] = await db
        .select({ settings: tenants.settings })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);
      return getDecryptedWordPressConnectorForTenant(tenantId, {
        getTenantSettings: async () =>
          tenant ? ((tenant.settings ?? {}) as Record<string, unknown>) : null,
      });
    },
    async getPrePublishChecklistTenant(post) {
      const [tenant] = await db
        .select({
          settings: tenants.settings,
          domain: tenants.domain,
        })
        .from(tenants)
        .where(eq(tenants.id, post.tenantId))
        .limit(1);

      const settings = (tenant?.settings ?? {}) as TenantSettings;
      const sourceMessages = post.threadId
        ? await db
            .select({ content: messages.content })
            .from(messages)
            .where(eq(messages.conversationId, post.threadId))
            .orderBy(asc(messages.createdAt))
        : [];

      return {
        settings,
        brandJson: metadataRecord(settings).brandJson ?? {},
        domain: tenant?.domain ?? null,
        sourceMessages,
      };
    },
    async updateBlogPost(blogPostId, tenantId, update) {
      await db
        .update(blogPosts)
        .set({
          status: update.status,
          metadata: update.metadata,
          publishedAt: update.publishedAt,
          lastModified: update.lastModified,
        })
        .where(and(eq(blogPosts.id, blogPostId), eq(blogPosts.tenantId, tenantId)));
    },
    publishArticle,
    now: () => new Date(),
  };
}

export async function publishBlogPost(
  blogPostId: string,
  context: PublishBlogPostContext,
  deps: PublishBlogPostDeps = buildPublishBlogPostDeps(),
): Promise<PublishBlogPostResult> {
  try {
    assertTenantId(context.tenantId);
    const post = await deps.getBlogPost(blogPostId, context.tenantId);
    if (!post) return { ok: false, error: "Blog post not found", preflight: null };

    if (!publishableStatuses.has(post.status)) {
      return {
        ok: false,
        error: `Blog post cannot be published from ${post.status} status`,
        preflight: null,
      };
    }

    const config = await deps.getDecryptedWordPressConnectorForTenant(
      context.tenantId,
    );
    if (!config) {
      return {
        ok: false,
        error: "WordPress connection not configured",
        preflight: null,
      };
    }

    const baseMetadata = metadataRecord(post.metadata);
    const checklistTenant = await deps.getPrePublishChecklistTenant(post);
    const checklist = runPrePublishChecklist(post, checklistTenant);
    const metadataWithChecklist: Record<string, unknown> = {
      ...baseMetadata,
      prePublishChecklist: checklist,
    };

    if (!checklist.ok) {
      const failedAt = deps.now();
      const failedItems = checklist.items
        .filter((item) => item.status === "fail")
        .map((item) => item.id);
      await deps.updateBlogPost(blogPostId, context.tenantId, {
        status: "publish_failed",
        publishedAt: post.publishedAt,
        lastModified: failedAt,
        metadata: {
          ...metadataWithChecklist,
          publish_error: {
            code: "CHECKLIST_FAILED",
            failedItems,
            at: failedAt.toISOString(),
          },
        },
      });
      return {
        ok: false,
        error: `Pre-publish checklist failed: ${checklist.items
          .filter((item) => item.status === "fail")
          .map((item) => item.label)
          .join(", ")}`,
        preflight: checklist,
      };
    }

    await deps.updateBlogPost(blogPostId, context.tenantId, {
      status: "publishing",
      metadata: metadataWithChecklist,
      publishedAt: post.publishedAt,
      lastModified: deps.now(),
    });

    const publishPost: BlogPostDetail = {
      ...post,
      status: "publishing",
      metadata: metadataWithChecklist,
    };
    const publishResult = await deps.publishArticle(
      config,
      publishPost,
      post.contentSemantic ?? undefined,
    );

    if (!publishResult.ok) {
      const failedAt = deps.now();
      await deps.updateBlogPost(blogPostId, context.tenantId, {
        status: "publish_failed",
        publishedAt: post.publishedAt,
        lastModified: failedAt,
        metadata: {
          ...metadataWithChecklist,
          publish_error: {
            message: publishResult.error,
            at: failedAt.toISOString(),
          },
        },
      });
      return { ok: false, error: publishResult.error, preflight: checklist };
    }

    const publishedAt = deps.now();
    const { publish_error: _publishError, ...successfulMetadata } = metadataWithChecklist;
    void _publishError;

    await deps.updateBlogPost(blogPostId, context.tenantId, {
      status: "published",
      publishedAt,
      lastModified: publishedAt,
      metadata: {
        ...successfulMetadata,
        published: {
          wp_post_id: publishResult.wpPostId,
          wp_post_url: publishResult.wpPostUrl,
          published_at: publishedAt.toISOString(),
          published_by: context.actorUserId,
        },
      },
    });

    return {
      ok: true,
      wpPostId: publishResult.wpPostId,
      wpPostUrl: publishResult.wpPostUrl,
      preflight: checklist,
    };
  } catch (error) {
    return { ok: false, error: publicErrorMessage(error), preflight: null };
  }
}
