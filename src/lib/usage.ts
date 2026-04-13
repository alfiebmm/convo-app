/**
 * Usage tracking & plan limit enforcement.
 */
import { db } from "./db";
import { conversations, content, tenants } from "./db/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { APP_CONFIG } from "@/config/app";

/**
 * Get the start of the current billing month (UTC).
 */
function getMonthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Get monthly usage counts for a tenant.
 */
export async function getMonthlyUsage(tenantId: string) {
  const monthStart = getMonthStart();

  const [convoResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(conversations)
    .where(
      and(
        eq(conversations.tenantId, tenantId),
        gte(conversations.createdAt, monthStart)
      )
    );

  const [contentResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(content)
    .where(
      and(
        eq(content.tenantId, tenantId),
        gte(content.createdAt, monthStart)
      )
    );

  return {
    conversations: convoResult?.count ?? 0,
    articles: contentResult?.count ?? 0,
  };
}

/**
 * Check if a tenant has capacity for a given resource type.
 */
export async function checkLimit(
  tenantId: string,
  type: "conversations" | "articles"
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    return { allowed: false, used: 0, limit: 0 };
  }

  const plan = tenant.plan as keyof typeof APP_CONFIG.limits;
  const limits = APP_CONFIG.limits[plan] ?? APP_CONFIG.limits.starter;
  const usage = await getMonthlyUsage(tenantId);

  if (type === "conversations") {
    return {
      allowed: usage.conversations < limits.conversationsPerMonth,
      used: usage.conversations,
      limit: limits.conversationsPerMonth,
    };
  }

  return {
    allowed: usage.articles < limits.articlesPerMonth,
    used: usage.articles,
    limit: limits.articlesPerMonth,
  };
}
