/**
 * Conversation helper utilities.
 * Used by the chat API and (later) the dashboard.
 */
import { db } from "./db";
import { conversations, messages } from "./db/schema";
import { eq, desc, sql } from "drizzle-orm";

export async function createConversation(
  tenantId: string,
  visitorId: string,
  metadata?: Record<string, unknown>
) {
  const [conversation] = await db
    .insert(conversations)
    .values({
      tenantId,
      visitorId,
      metadata: metadata ?? {},
      status: "active",
      messageCount: 0,
    })
    .returning();
  return conversation;
}

export async function getConversation(id: string) {
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id))
    .limit(1);
  return conversation ?? null;
}

export async function getConversationMessages(
  conversationId: string,
  limit = 50
) {
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(limit);
}

export async function addMessage(
  conversationId: string,
  role: string,
  content: string
) {
  const [message] = await db
    .insert(messages)
    .values({ conversationId, role, content })
    .returning();

  // Increment message count
  await db
    .update(conversations)
    .set({
      messageCount: sql`${conversations.messageCount} + 1`,
    })
    .where(eq(conversations.id, conversationId));

  return message;
}

export async function completeConversation(id: string) {
  const [updated] = await db
    .update(conversations)
    .set({
      status: "completed",
      completedAt: new Date(),
    })
    .where(eq(conversations.id, id))
    .returning();
  return updated ?? null;
}
