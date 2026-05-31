/**
 * Conversation helper utilities.
 * Used by the chat API and (later) the dashboard.
 */
import { db } from "./db";
import { conversations, messages } from "./db/schema";
import { eq, desc, sql } from "drizzle-orm";
import type {
  ConversationQualifying,
  QualifyingAnswer,
} from "./qualifying/types";
import { readQualifying } from "./qualifying/types";

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

/**
 * Append a qualifying-question answer to a conversation's metadata blob.
 *
 * Merges in-process to preserve existing metadata (pageUrl, referrer, etc.)
 * and any prior qualifying answers. Returns the updated `qualifying` state
 * so callers can decide whether to ask the next question.
 *
 * Idempotent on `field`: if the same field is answered twice, the second
 * answer overwrites the first. Practically the widget locks the UI to
 * prevent this, but we defend against retries.
 */
export async function appendQualifyingAnswer(
  conversationId: string,
  answer: Omit<QualifyingAnswer, "answeredAt"> & { answeredAt?: string }
): Promise<ConversationQualifying> {
  const [row] = await db
    .select({ metadata: conversations.metadata })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  const existingMetadata =
    (row?.metadata as Record<string, unknown> | null) ?? {};
  const existingQualifying =
    readQualifying(existingMetadata) ?? {
      answers: [],
      persona: {},
    };

  // Drop any prior answer for the same field, then append fresh.
  const filtered = existingQualifying.answers.filter(
    (a) => a.field !== answer.field
  );
  const answeredAt = answer.answeredAt ?? new Date().toISOString();
  const fullAnswer: QualifyingAnswer = {
    field: answer.field,
    value: answer.value,
    question: answer.question,
    answeredAt,
  };

  const nextQualifying: ConversationQualifying = {
    answers: [...filtered, fullAnswer],
    persona: {
      ...existingQualifying.persona,
      [answer.field]: answer.value,
    },
    skipped: false,
    completedAt: existingQualifying.completedAt,
  };

  const nextMetadata = {
    ...existingMetadata,
    qualifying: nextQualifying,
  };

  await db
    .update(conversations)
    .set({ metadata: nextMetadata })
    .where(eq(conversations.id, conversationId));

  return nextQualifying;
}

/**
 * Mark the qualifying flow as complete (no more questions remain) or
 * explicitly skipped by the visitor.
 */
export async function setQualifyingState(
  conversationId: string,
  patch: { completedAt?: string; skipped?: boolean }
): Promise<ConversationQualifying | null> {
  const [row] = await db
    .select({ metadata: conversations.metadata })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  if (!row) return null;

  const existingMetadata =
    (row.metadata as Record<string, unknown> | null) ?? {};
  const existingQualifying =
    readQualifying(existingMetadata) ?? {
      answers: [],
      persona: {},
    };

  const nextQualifying: ConversationQualifying = {
    ...existingQualifying,
    ...(patch.completedAt !== undefined
      ? { completedAt: patch.completedAt }
      : {}),
    ...(patch.skipped !== undefined ? { skipped: patch.skipped } : {}),
  };

  const nextMetadata = {
    ...existingMetadata,
    qualifying: nextQualifying,
  };

  await db
    .update(conversations)
    .set({ metadata: nextMetadata })
    .where(eq(conversations.id, conversationId));

  return nextQualifying;
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
