/**
 * Content Pipeline Orchestrator
 *
 * processConversation(conversationId):
 *   1. Extract topics from conversation messages
 *   2. Dedup against existing topics
 *   3. Generate SEO article
 *   4. Mark conversation as completed
 */
import { db } from "../db";
import { conversations, messages, content, tenants } from "../db/schema";
import { eq } from "drizzle-orm";
import { extractTopics } from "./extract-topics";
import { dedup } from "./dedup";
import { generateArticle, type GeneratedArticle } from "./generate-article";
import {
  publishContent,
  hasCMSConfigured,
  type TenantSettings,
} from "../publishing";

export interface PipelineResult {
  conversationId: string;
  success: boolean;
  topicId?: string;
  topicAction?: "create" | "update";
  article?: GeneratedArticle;
  autoPublished?: boolean;
  audience?: string;
  contentCategory?: string;
  error?: string;
}

export async function processConversation(
  conversationId: string
): Promise<PipelineResult> {
  try {
    // 1. Load conversation and messages
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (!conversation) {
      return {
        conversationId,
        success: false,
        error: "Conversation not found",
      };
    }

    const convoMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);

    if (convoMessages.length < 2) {
      return {
        conversationId,
        success: false,
        error: "Conversation too short to extract meaningful topics",
      };
    }

    const messagePairs = convoMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // 2. Extract topics
    const topic = await extractTopics(messagePairs);

    if (topic.confidence < 0.3) {
      // Mark completed but skip content generation for low-confidence topics
      await db
        .update(conversations)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(conversations.id, conversationId));

      return {
        conversationId,
        success: true,
        error: "Topic confidence too low for content generation",
      };
    }

    // 3. Dedup
    const dedupResult = await dedup(
      conversation.tenantId,
      topic.primaryTopic,
      topic.subtopics.join(", ")
    );

    // 4. Generate article
    let article: GeneratedArticle | undefined;
    try {
      article = await generateArticle(
        conversation.tenantId,
        dedupResult.topicId,
        conversationId,
        topic,
        messagePairs
      );
    } catch (genErr) {
      console.error(
        `[Pipeline] Article generation failed for ${conversationId}:`,
        genErr
      );
      // Don't fail the whole pipeline — topic was still extracted
    }

    // 5. Mark conversation as completed
    await db
      .update(conversations)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(conversations.id, conversationId));

    // 6. Auto-publish check
    let autoPublished = false;
    if (article?.id) {
      try {
        autoPublished = await tryAutoPublish(
          conversation.tenantId,
          article.id,
          article.seoScore
        );
      } catch (apErr) {
        console.error(
          `[Pipeline] Auto-publish check failed for ${article.id}:`,
          apErr
        );
      }
    }

    return {
      conversationId,
      success: true,
      topicId: dedupResult.topicId,
      topicAction: dedupResult.action,
      article,
      autoPublished,
      audience: topic.audience,
      contentCategory: topic.contentCategory,
    };
  } catch (err) {
    console.error(`[Pipeline] Error processing ${conversationId}:`, err);
    return {
      conversationId,
      success: false,
      error: err instanceof Error ? err.message : "Unknown pipeline error",
    };
  }
}

/**
 * Auto-publish logic:
 * - Check tenant settings for autoPublish + autoPublishThreshold
 * - If enabled and seoScore meets threshold:
 *   - If CMS configured → approve + publish
 *   - If no CMS → just approve
 */
async function tryAutoPublish(
  tenantId: string,
  contentId: string,
  seoScore?: number
): Promise<boolean> {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) return false;

  const settings = (tenant.settings ?? {}) as TenantSettings;

  if (!settings.autoPublish) return false;

  const threshold = settings.autoPublishThreshold ?? 0.8;
  const score = seoScore ?? 0;

  if (score < threshold) {
    console.log(
      `[AutoPublish] Content ${contentId} score ${score} below threshold ${threshold}, skipping`
    );
    return false;
  }

  // Auto-approve first
  await db
    .update(content)
    .set({
      status: "approved",
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(content.id, contentId));

  console.log(
    `[AutoPublish] Auto-approved content ${contentId} (score: ${score})`
  );

  // If CMS configured, publish
  if (hasCMSConfigured(settings)) {
    const result = await publishContent(contentId);
    if (result.success) {
      console.log(
        `[AutoPublish] Published content ${contentId} → ${result.url}`
      );
      return true;
    } else {
      console.error(
        `[AutoPublish] Publish failed for ${contentId}: ${result.error}`
      );
      // Content stays approved even if publish fails
      return false;
    }
  }

  console.log(
    `[AutoPublish] No CMS configured for tenant ${tenantId}, content auto-approved only`
  );
  return false;
}
