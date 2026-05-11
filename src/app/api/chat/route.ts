import { NextRequest } from "next/server";
import OpenAI from "openai";
import { getTenantById } from "@/lib/tenant";
import {
  createConversation,
  getConversationMessages,
  addMessage,
} from "@/lib/conversations";
import { buildSystemPrompt } from "@/lib/guardrails";
import { sendAdminNotification } from "@/lib/notifications";
import {
  retrieveRelevantChunks,
  formatChunksForPrompt,
} from "@/lib/knowledge/retrieval";

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }
  return new OpenAI({ apiKey });
}

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
    const isNewConversation = !convoId;
    if (!convoId) {
      const convo = await createConversation(tenantId, visitorId, metadata);
      convoId = convo.id;

      // Fire-and-forget admin notification for new conversations
      sendAdminNotification(
        {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          settings: tenant.settings as Record<string, unknown> | null,
        },
        {
          id: convo.id,
          visitorId,
          metadata: metadata as Record<string, unknown> | undefined,
        },
        message
      );
    }

    // Persist user message
    await addMessage(convoId, "user", message);

    // Load recent history for context (oldest first)
    const recentMessages = await getConversationMessages(convoId, 20);
    const history = recentMessages.reverse().map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Count user turns (for CTA timing)
    const userTurnCount = history.filter((m) => m.role === "user").length;

    // Build system prompt via guardrails
    const systemPrompt = buildSystemPrompt(
      {
        name: tenant.name,
        domain: tenant.domain,
        settings: tenant.settings as Record<string, unknown> | null,
      },
      {
        pageUrl: (metadata as Record<string, unknown>)?.pageUrl as string | undefined,
        referrer: (metadata as Record<string, unknown>)?.referrer as string | undefined,
        visitorId,
        turnCount: userTurnCount,
      }
    );

    // Retrieve relevant indexed site content for THIS user message (K-07 / CON-89).
    // Failure here must not break the chat — we degrade to no-context if anything
    // goes wrong. Tracking-only: errors are logged for ops.
    let retrievalContext = "";
    const retrievalStart = Date.now();
    try {
      const chunks = await retrieveRelevantChunks(tenant.id, message, {
        limit: 6,
        maxDistance: 0.7,
      });
      retrievalContext = formatChunksForPrompt(chunks);
      if (chunks.length > 0) {
        console.log(
          `[Chat] retrieved ${chunks.length} chunks in ${Date.now() - retrievalStart}ms ` +
            `for tenant ${tenant.id} (top distance ${chunks[0].distance.toFixed(3)})`
        );
      }
    } catch (err) {
      console.error("[Chat] retrieval failed (non-fatal):", err);
    }

    // System prompt gets the retrieved chunks appended (when any). Empty
    // string when retrieval yields nothing — effectively no behaviour change.
    const fullSystemPrompt = retrievalContext
      ? `${systemPrompt}\n\n${retrievalContext}`
      : systemPrompt;

    // Stream from OpenAI
    const stream = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      stream: true,
      messages: [
        { role: "system", content: fullSystemPrompt },
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
