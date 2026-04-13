/**
 * Shared database queries for public Q&A pages.
 */
import { db } from "./index";
import { tenants, content, topics } from "./schema";
import { eq, and, desc, sql, ilike, count } from "drizzle-orm";

export async function getTenantBySlug(slug: string) {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  return tenant ?? null;
}

export async function getPublishedContent(
  tenantId: string,
  options: {
    page?: number;
    perPage?: number;
    topicSlug?: string;
    search?: string;
  } = {}
) {
  const { page = 1, perPage = 12, topicSlug, search } = options;
  const offset = (page - 1) * perPage;

  const conditions = [
    eq(content.tenantId, tenantId),
    eq(content.status, "published"),
  ];

  // If filtering by topic, join topics table
  if (topicSlug) {
    const [topic] = await db
      .select()
      .from(topics)
      .where(and(eq(topics.tenantId, tenantId), eq(topics.slug, topicSlug)))
      .limit(1);
    if (topic) {
      conditions.push(eq(content.topicId, topic.id));
    }
  }

  if (search) {
    conditions.push(ilike(content.title, `%${search}%`));
  }

  const whereClause = and(...conditions);

  const [items, [totalResult]] = await Promise.all([
    db
      .select({
        id: content.id,
        title: content.title,
        slug: content.slug,
        type: content.type,
        metaDescription: content.metaDescription,
        body: content.body,
        publishedAt: content.publishedAt,
        topicId: content.topicId,
      })
      .from(content)
      .where(whereClause)
      .orderBy(desc(content.publishedAt))
      .limit(perPage)
      .offset(offset),
    db
      .select({ total: count() })
      .from(content)
      .where(whereClause),
  ]);

  return {
    items,
    total: totalResult?.total ?? 0,
    page,
    perPage,
    totalPages: Math.ceil((totalResult?.total ?? 0) / perPage),
  };
}

export async function getContentBySlug(tenantId: string, slug: string) {
  const [item] = await db
    .select()
    .from(content)
    .where(
      and(
        eq(content.tenantId, tenantId),
        eq(content.slug, slug),
        eq(content.status, "published")
      )
    )
    .limit(1);
  return item ?? null;
}

export async function getRelatedContent(
  tenantId: string,
  topicId: string | null,
  excludeId: string,
  limit = 4
) {
  if (!topicId) return [];

  return db
    .select({
      id: content.id,
      title: content.title,
      slug: content.slug,
      type: content.type,
      metaDescription: content.metaDescription,
      publishedAt: content.publishedAt,
    })
    .from(content)
    .where(
      and(
        eq(content.tenantId, tenantId),
        eq(content.status, "published"),
        eq(content.topicId, topicId),
        sql`${content.id} != ${excludeId}`
      )
    )
    .orderBy(desc(content.publishedAt))
    .limit(limit);
}

export async function getTopicsForTenant(tenantId: string) {
  return db
    .select({
      id: topics.id,
      name: topics.name,
      slug: topics.slug,
    })
    .from(topics)
    .where(eq(topics.tenantId, tenantId))
    .orderBy(topics.name);
}

export async function getTopicById(topicId: string) {
  const [topic] = await db
    .select()
    .from(topics)
    .where(eq(topics.id, topicId))
    .limit(1);
  return topic ?? null;
}

export async function getAllPublishedContentForSitemap(tenantId: string) {
  return db
    .select({
      slug: content.slug,
      updatedAt: content.updatedAt,
      type: content.type,
      publishedAt: content.publishedAt,
    })
    .from(content)
    .where(
      and(eq(content.tenantId, tenantId), eq(content.status, "published"))
    )
    .orderBy(desc(content.publishedAt));
}
