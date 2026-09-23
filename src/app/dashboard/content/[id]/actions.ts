"use server";

import { asc, and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getCurrentTenant, getCurrentUser } from "@/lib/auth-context";
import {
  defaultBlogRender,
  defaultBlogSemanticRender,
  resolveBrandJson,
  resolveCtaConfig,
} from "@/lib/blog/create";
import {
  applyAiHeroToMetadata,
  blogPostJsonFromMetadata,
  generateAndStoreHeroImage,
  loadTenantHeroImageConfig,
  persistGeneratedHero,
  revertAiHeroMetadata,
} from "@/lib/blog/hero-image";
import { heroPlaceholderUrlForBrand } from "@/lib/blog/hero-placeholder";
import { runPrePublishChecklist } from "@/lib/blog/pre-publish-checklist";
import { db } from "@/lib/db";
import { blogPostSeo, blogPosts, messages, tenants } from "@/lib/db/schema";
import type { TenantSettings } from "@/lib/publishing";

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function lines(value: string | null) {
  return value
    ? value
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
    : [];
}

function internalLinks(value: string | null) {
  return lines(value).map((line) => {
    const [url, label] = line.split("|").map((part) => part.trim());
    return { url, label: label || undefined };
  });
}

export async function saveBlogPostSeo(blogPostId: string, formData: FormData) {
  const [user, tenant] = await Promise.all([getCurrentUser(), getCurrentTenant()]);
  if (!user || !tenant) {
    return { ok: false, error: "Not authorised" };
  }

  const [post] = await db
    .select({ id: blogPosts.id })
    .from(blogPosts)
    .where(and(eq(blogPosts.id, blogPostId), eq(blogPosts.tenantId, tenant.id)))
    .limit(1);
  if (!post) return { ok: false, error: "Blog post not found" };

  await db
    .insert(blogPostSeo)
    .values({
      blogPostId,
      primaryKeyword: formString(formData, "primaryKeyword"),
      secondaryKeywords: lines(formString(formData, "secondaryKeywords")),
      searchIntent: formString(formData, "searchIntent"),
      targetAudience: formString(formData, "targetAudience"),
      articleType: formString(formData, "articleType"),
      internalLinkSuggestions: internalLinks(formString(formData, "internalLinkSuggestions")),
      ctaGoal: formString(formData, "ctaGoal"),
    })
    .onConflictDoUpdate({
      target: blogPostSeo.blogPostId,
      set: {
        primaryKeyword: formString(formData, "primaryKeyword"),
        secondaryKeywords: lines(formString(formData, "secondaryKeywords")),
        searchIntent: formString(formData, "searchIntent"),
        targetAudience: formString(formData, "targetAudience"),
        articleType: formString(formData, "articleType"),
        internalLinkSuggestions: internalLinks(formString(formData, "internalLinkSuggestions")),
        ctaGoal: formString(formData, "ctaGoal"),
        updatedAt: new Date(),
      },
    });

  revalidatePath(`/dashboard/content/${blogPostId}`);
  return { ok: true };
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

export async function regenerateHeroImage(blogPostId: string) {
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

  const config = await loadTenantHeroImageConfig(tenant.id);
  if (!config) return { ok: false, error: "Tenant not found" };

  const metadata = metadataRecord(post.metadata);
  const postJson = blogPostJsonFromMetadata(metadata);
  const result = await generateAndStoreHeroImage({
    tenant: config,
    postId: post.id,
    post: postJson,
    metadata,
  });

  if (!result.ok) {
    revalidatePath(`/dashboard/content/${blogPostId}`);
    return { ok: false, error: result.reason };
  }

  const nextMetadata = applyAiHeroToMetadata({
    metadata,
    url: result.url,
    path: result.path,
    prompt: result.prompt,
    generationNumber: result.generationNumber,
  });
  const nextPost = {
    ...postJson,
    hero: {
      ...postJson.hero,
      url: result.url,
    },
    seo: {
      ...postJson.seo,
      ogImage: result.url,
    },
  };
  const brand = resolveBrandJson(tenant, resolveCtaConfig(tenant));

  await persistGeneratedHero({
    tenantId: tenant.id,
    postId: post.id,
    metadata: nextMetadata,
    content: defaultBlogRender({ brand, post: nextPost }),
    contentSemantic: defaultBlogSemanticRender({ brand, post: nextPost }),
  });

  revalidatePath(`/dashboard/content/${blogPostId}`);
  return { ok: true };
}

export async function revertHeroImage(blogPostId: string) {
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

  const metadata = metadataRecord(post.metadata);
  const brand = resolveBrandJson(tenant, resolveCtaConfig(tenant));
  const placeholderUrl = heroPlaceholderUrlForBrand(brand);
  const nextMetadata = revertAiHeroMetadata({ metadata, placeholderUrl });
  const postJson = blogPostJsonFromMetadata(nextMetadata);

  await persistGeneratedHero({
    tenantId: tenant.id,
    postId: post.id,
    metadata: nextMetadata,
    content: defaultBlogRender({ brand, post: postJson }),
    contentSemantic: defaultBlogSemanticRender({ brand, post: postJson }),
  });

  revalidatePath(`/dashboard/content/${blogPostId}`);
  return { ok: true };
}
