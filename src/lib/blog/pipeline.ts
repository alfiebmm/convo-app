import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { blogPosts } from "@/lib/db/schema";

export async function runBlogPipeline(conversationId: string): Promise<void> {
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
    return;
  }

  console.info("[blog] would run blog pipeline", { conversationId });
}
