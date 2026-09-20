import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { blogDecisionLogs, blogPosts } from "@/lib/db/schema";

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
  recordPipelineOutcome(
    decisionLogId: string | undefined,
    decision: DecisionResult,
    blogPostId: string
  ): Promise<void>;
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
      if (
        decision.action === "skip" ||
        decision.action === "skip-covered" ||
        decision.action === "skip-nosignal"
      ) {
        return { conversationId, decision, blogPostId: null };
      }

      if (decision.action === "update") {
        const blogPostId = await deps.updateArticle(conversationId, decision);
        await deps.recordPipelineOutcome(decision.log_id, decision, blogPostId);
        return { conversationId, decision, blogPostId };
      }

      const blogPostId = await deps.createArticle(conversationId, decision);
      await deps.recordPipelineOutcome(decision.log_id, decision, blogPostId);
      return { conversationId, decision, blogPostId };
    },
  };
}

function failureReasonFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const failure = (metadata as Record<string, unknown>).generation_failure;
  if (!failure || typeof failure !== "object" || Array.isArray(failure)) return null;
  const reason = (failure as Record<string, unknown>).reason;
  return typeof reason === "string" && reason.trim() ? reason : null;
}

async function recordPipelineOutcome(
  decisionLogId: string | undefined,
  decision: DecisionResult,
  blogPostId: string
): Promise<void> {
  if (!decisionLogId) return;

  const [post] = await db
    .select({
      status: blogPosts.status,
      metadata: blogPosts.metadata,
    })
    .from(blogPosts)
    .where(eq(blogPosts.id, blogPostId))
    .limit(1);

  const isFailure = post?.status === "generation_failed";
  const failureReason = isFailure
    ? failureReasonFromMetadata(post.metadata) ?? "Blog generation failed."
    : null;

  await db
    .update(blogDecisionLogs)
    .set({
      action: isFailure ? "failure" : decision.action,
      targetBlogPostId:
        decision.action === "create" ? blogPostId : decision.target_blog_post_id,
      selectedTargetPostId:
        decision.action === "update" || decision.action === "skip-covered"
          ? decision.target_blog_post_id
          : undefined,
      generatedBlogPostId:
        !isFailure && decision.action === "create" ? blogPostId : undefined,
      updateDraftBlogPostId:
        !isFailure && decision.action === "update" ? blogPostId : undefined,
      failureBlogPostId: isFailure ? blogPostId : undefined,
      failureReason,
      isContentProducing: !isFailure && (decision.action === "create" || decision.action === "update"),
    })
    .where(eq(blogDecisionLogs.id, decisionLogId));
}

const defaultService = buildPipelineService({
  findExistingPost,
  decide,
  createArticle,
  updateArticle,
  recordPipelineOutcome,
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
