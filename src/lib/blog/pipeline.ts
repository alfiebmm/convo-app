import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { blogPosts } from "@/lib/db/schema";

import { createArticle, markUpdatePending } from "./create";
import { decide, type DecisionResult } from "./decision";

export interface BlogPipelineResult {
  conversationId: string;
  decision: DecisionResult;
  blogPostId: string | null;
}

/**
 * Blog generation pipeline entry point.
 *
 * - Duplicate-prevention: if a `blog_posts` row already exists for this
 *   conversation, log and return `null` (CON-103 behaviour).
 * - Otherwise: run the Decision Phase (CON-104).
 * - Create decisions generate + render a draft blog post.
 * - Update decisions are parked for the later update workflow.
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
  if (decision.action === "skip") {
    return { conversationId, decision, blogPostId: null };
  }

  if (decision.action === "update") {
    const blogPostId = await markUpdatePending(conversationId, decision);
    return { conversationId, decision, blogPostId };
  }

  const blogPostId = await createArticle(conversationId, decision);
  return { conversationId, decision, blogPostId };
}
