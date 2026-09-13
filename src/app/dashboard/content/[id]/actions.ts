"use server";

import { asc, and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getCurrentTenant, getCurrentUser } from "@/lib/auth-context";
import { runPrePublishChecklist } from "@/lib/blog/pre-publish-checklist";
import { db } from "@/lib/db";
import { blogPosts, messages, tenants } from "@/lib/db/schema";
import type { TenantSettings } from "@/lib/publishing";

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

export async function revalidatePrePublishChecklist(blogPostId: string) {
  const [user, tenant] = await Promise.all([getCurrentUser(), getCurrentTenant()]);
  if (!user || !tenant) {
    return { ok: false, error: "Not authorised" };
  }

  const [post] = await db
    .select()
    .from(blogPosts)
    .where(and(eq(blogPosts.id, blogPostId), eq(blogPosts.tenantId, tenant.id)))
    .limit(1);
  if (!post) return { ok: false, error: "Blog post not found" };

  const [tenantRow] = await db
    .select({ settings: tenants.settings, domain: tenants.domain })
    .from(tenants)
    .where(eq(tenants.id, tenant.id))
    .limit(1);

  const sourceMessages = post.threadId
    ? await db
        .select({ content: messages.content })
        .from(messages)
        .where(eq(messages.conversationId, post.threadId))
        .orderBy(asc(messages.createdAt))
    : [];

  const metadata = metadataRecord(post.metadata);
  const settings = (tenantRow?.settings ?? {}) as TenantSettings;
  const checklist = runPrePublishChecklist(
    {
      id: post.id,
      tenantId: post.tenantId,
      threadId: post.threadId,
      title: post.title,
      slug: post.slug,
      content: post.content,
      contentSemantic: post.contentSemantic,
      metadata,
      status: post.status,
      persona: post.persona,
      topic: post.topic,
      createdAt: post.createdAt,
      publishedAt: post.publishedAt,
      lastModified: post.lastModified,
    },
    {
      settings,
      brandJson: metadataRecord(settings).brandJson ?? {},
      domain: tenantRow?.domain ?? null,
      sourceMessages,
    },
  );

  await db
    .update(blogPosts)
    .set({
      metadata: {
        ...metadata,
        prePublishChecklist: checklist,
      },
      lastModified: new Date(),
    })
    .where(and(eq(blogPosts.id, blogPostId), eq(blogPosts.tenantId, tenant.id)));

  revalidatePath(`/dashboard/content/${blogPostId}`);
  return { ok: true };
}
