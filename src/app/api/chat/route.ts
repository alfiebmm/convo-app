import { NextRequest } from "next/server";
import OpenAI from "openai";
import { getTenantById } from "@/lib/tenant";
import {
  createConversation,
  getConversationMessages,
  addMessage,
} from "@/lib/conversations";

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }
  return new OpenAI({ apiKey });
}

const DEFAULT_SYSTEM_PROMPT = `You are a friendly, knowledgeable assistant embedded on a website. 
Your goal is to help visitors by answering their questions clearly and conversationally.
Be concise but thorough. If you don't know something, say so honestly.
Always be polite and professional.`;

/**
 * POST /api/chat
 *
 * Accepts: { tenantId, conversationId?, visitorId, message, metadata? }
 * Returns: SSE stream with assistant response chunks.
 *
 * SSE event types:
 *   - data: { type: "token", content: "..." }
 *   - data: { type: "meta", conversationId: "..." }
 *   - data: { type: "done" }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenantId, conversationId, visitorId, message, metadata } = body;

    if (!tenantId || !message || !visitorId) {
      return new Response(
        JSON.stringify({ error: "tenantId, visitorId, and message are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Look up tenant
    const tenant = await getTenantById(tenantId);
    if (!tenant) {
      return new Response(
        JSON.stringify({ error: "Tenant not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Resolve or create conversation
    let convoId = conversationId;
    if (!convoId) {
      const convo = await createConversation(tenantId, visitorId, metadata);
      convoId = convo.id;
    }

    // Persist user message
    await addMessage(convoId, "user", message);

    // Load recent history for context (oldest first)
    const recentMessages = await getConversationMessages(convoId, 20);
    const history = recentMessages.reverse().map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Build system prompt from tenant settings
    const settings = tenant.settings as Record<string, unknown> | null;
    const systemPrompt =
      (settings?.persona as string) ||
      (settings?.systemPrompt as string) ||
      DEFAULT_SYSTEM_PROMPT;

    // Stream from OpenAI
    const stream = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        ...history,
      ],
    });

    // Build SSE response
    const encoder = new TextEncoder();
    let fullResponse = "";

    const readable = new ReadableStream({
      async start(controller) {
        // Send conversation ID first
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "meta", conversationId: convoId })}\n\n`
          )
        );

        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              fullResponse += content;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "token", content })}\n\n`
                )
              );
            }
          }

          // Persist assistant message after stream complete
          await addMessage(convoId, "assistant", fullResponse);

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
          );
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : "Stream error";
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", content: errorMessage })}\n\n`
            )
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Chat API error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}

/** Handle CORS preflight for widget cross-origin requests */
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
