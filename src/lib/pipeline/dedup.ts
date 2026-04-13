/**
 * Topic deduplication — checks if an extracted topic already exists for the tenant.
 * V1: simple slug-based matching (lowercase, normalize).
 */
import { db } from "../db";
import { topics } from "../db/schema";
import { eq, and } from "drizzle-orm";

export interface DedupResult {
  action: "create" | "update";
  topicId: string;
}

/** Convert a topic name to a URL-friendly slug */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function dedup(
  tenantId: string,
  topicName: string,
  description?: string
): Promise<DedupResult> {
  const slug = slugify(topicName);

  // Check for existing topic with same slug for this tenant
  const [existing] = await db
    .select()
    .from(topics)
    .where(and(eq(topics.tenantId, tenantId), eq(topics.slug, slug)))
    .limit(1);

  if (existing) {
    // Increment frequency
    await db
      .update(topics)
      .set({
        frequency: existing.frequency + 1,
        updatedAt: new Date(),
      })
      .where(eq(topics.id, existing.id));

    return { action: "update", topicId: existing.id };
  }

  // Create new topic
  const [newTopic] = await db
    .insert(topics)
    .values({
      tenantId,
      name: topicName,
      slug,
      description: description ?? null,
      frequency: 1,
    })
    .returning();

  return { action: "create", topicId: newTopic.id };
}
