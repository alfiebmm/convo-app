import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { blogPosts } from "@/lib/db/schema";

import { createArticle } from "./create";
import { decide, type DecisionResult } from "./decision";
import { updateArticle } from "./update";

export interface BlogPipelineResult {
  conversationId: string;
  decision: DecisionResult;
  blogPostId: string | null;
}

type BlogPipelineDeps = {
  findExistingPost(conversationId: string): Promise<{ id: string } | null>;
  decide(conversationId: string): Promise<DecisionResult>;
  createArticle(conversationId: string, decision: DecisionResult): Promise<string>;
  updateArticle(conversationId: string, decision: DecisionResult): Promise<string>;
};

async function findExistingPost(conversationId: string): Promise<{ id: string } | null> {
  const [existingPost] = await db
    .select({ id: blogPosts.id })
    .from(blogPosts)
    .where(eq(blogPosts.threadId, conversationId))
    .limit(1);

  return existingPost ?? null;
}

function buildPipelineService(deps: BlogPipelineDeps) {
  return {
    async runBlogPipeline(
      conversationId: string
    ): Promise<BlogPipelineResult | null> {
      const existingPost = await deps.findExistingPost(conversationId);

      if (existingPost) {
        console.info("[blog] skipping pipeline: duplicate blog post exists", {
          conversationId,
          blogPostId: existingPost.id,
          reason: "duplicate_thread_id",
        });
        return null;
      }

      const decision = await deps.decide(conversationId);
      if (decision.action === "skip") {
        return { conversationId, decision, blogPostId: null };
      }

      if (decision.action === "update") {
        const blogPostId = await deps.updateArticle(conversationId, decision);
        return { conversationId, decision, blogPostId };
      }

      const blogPostId = await deps.createArticle(conversationId, decision);
      return { conversationId, decision, blogPostId };
    },
  };
}

const defaultService = buildPipelineService({
  findExistingPost,
  decide,
  createArticle,
  updateArticle,
});

/**
 * Blog generation pipeline entry point.
 *
 * - Duplicate-prevention: if a `blog_posts` row already exists for this
 *   conversation, log and return `null` (CON-103 behaviour).
 * - Otherwise: run the Decision Phase (CON-104).
 * - Create decisions generate + render a draft blog post.
 * - Update decisions generate + render a draft revision of the target post.
 */
export async function runBlogPipeline(
  conversationId: string
): Promise<BlogPipelineResult | null> {
  return defaultService.runBlogPipeline(conversationId);
}

export const __testing = {
  buildPipelineService,
};
