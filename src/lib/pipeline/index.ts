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
import { conversations, messages } from "../db/schema";
import { eq } from "drizzle-orm";
import { extractTopics } from "./extract-topics";
import { dedup } from "./dedup";
import { generateArticle, type GeneratedArticle } from "./generate-article";

export interface PipelineResult {
  conversationId: string;
  success: boolean;
  topicId?: string;
  topicAction?: "create" | "update";
  article?: GeneratedArticle;
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

    return {
      conversationId,
      success: true,
      topicId: dedupResult.topicId,
      topicAction: dedupResult.action,
      article,
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
