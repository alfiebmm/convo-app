import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { blogPosts } from "@/lib/db/schema";

import { decide, type DecisionResult } from "./decision";

export interface BlogPipelineResult {
  conversationId: string;
  decision: DecisionResult;
}

/**
 * Blog generation pipeline entry point.
 *
 * - Duplicate-prevention: if a `blog_posts` row already exists for this
 *   conversation, log and return `null` (CON-103 behaviour).
 * - Otherwise: run the Decision Phase (CON-104) and return the result.
 *
 * Article writing (create/update) and SEO metadata generation land in
 * CON-105 / CON-106 and will consume `BlogPipelineResult`.
 */
export async function runBlogPipeline(
  conversationId: string
): Promise<BlogPipelineResult | null> {
  const [existingPost] = await db
    .select({ id: blogPosts.id })
    .from(blogPosts)
    .where(eq(blogPosts.threadId, conversationId))
    .limit(1);

  if (existingPost) {
    console.info("[blog] skipping pipeline: duplicate blog post exists", {
      conversationId,
      blogPostId: existingPost.id,
      reason: "duplicate_thread_id",
    });
    return null;
  }

  const decision = await decide(conversationId);
  return { conversationId, decision };
}
