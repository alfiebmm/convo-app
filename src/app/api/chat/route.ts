import { NextRequest } from "next/server";
import OpenAI from "openai";
import { getTenantById } from "@/lib/tenant";
import {
  createConversation,
  getConversationMessages,
  addMessage,
} from "@/lib/conversations";
import { buildSystemPrompt, GLOBAL_RULES } from "@/lib/guardrails";
import { resolveResponseEngine } from "@/lib/guardrails/response-engine";
import { createStreamingFilter } from "@/lib/guardrails/banned-words";
import { sendAdminNotification } from "@/lib/notifications";
import {
  retrieveRelevantChunks,
  formatChunksForPrompt,
} from "@/lib/knowledge/retrieval";
import {
  detectInjection,
  isInjectionDefenceEnabled,
  scanOutputForLeakage,
  wrapVisitorMessage,
  wrapRagContext,
  redactForAudit,
  OUTPUT_GUARD_FALLBACK,
} from "@/lib/guardrails/injection";
import { db } from "@/lib/db";
import { platformInjectionEvents } from "@/lib/db/schema";

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }
  return new OpenAI({ apiKey });
}

/**
 * Best-effort write to `platform_injection_events`. Never throws — the
 * chat path must keep working even if the audit table is unavailable.
 */
async function logInjectionEvent(params: {
  tenantId: string;
  conversationId: string | null;
  messageId: string | null;
  visitorId: string | null;
  patternMatched: string;
  rawMessage: string;
}): Promise<void> {
  try {
    await db.insert(platformInjectionEvents).values({
      tenantId: params.tenantId,
      conversationId: params.conversationId ?? undefined,
      messageId: params.messageId ?? undefined,
      visitorId: params.visitorId ?? undefined,
      patternMatched: params.patternMatched,
      rawMessageRedacted: redactForAudit(params.rawMessage),
    });
  } catch (err) {
    // Do not fail the chat request on audit-log failures.
    console.error("[CON-98] failed to log injection event (non-fatal):", err);
  }
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

    // CON-98: feature flag — default ON. Panic off-switch via
    // settings.guardrails.injectionDefence.enabled = false.
    const tenantSettings = tenant.settings as Record<string, unknown> | null;
    const injectionDefenceOn = isInjectionDefenceEnabled(tenantSettings);

    // CON-98 layer 1: regex pre-filter. Pure flag-and-log; the message
    // still goes to the model unchanged (wrapped on layer 2 below).
    // Behaviour is silent to the visitor — they get a normal response.
    const injectionFlag = injectionDefenceOn
      ? detectInjection(message)
      : { flagged: false, pattern: null };

    // Resolve or create conversation
    let convoId = conversationId;
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

    // Persist user message (raw — we don't mutate stored content; the
    // CON-98 wrapping is applied only to what we send to OpenAI).
    const persistedUser = await addMessage(convoId, "user", message);

    // CON-98 audit: log the regex hit (if any) now that we have a
    // conversation + message id to associate it with. Non-blocking.
    if (injectionFlag.flagged && injectionFlag.pattern) {
      void logInjectionEvent({
        tenantId: tenant.id,
        conversationId: convoId,
        messageId: persistedUser?.id ?? null,
        visitorId,
        patternMatched: injectionFlag.pattern,
        rawMessage: message,
      });
    }

    // Load recent history for context (oldest first)
    const recentMessages = await getConversationMessages(convoId, 20);
    const history = recentMessages.reverse().map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Count user turns (for CTA timing)
    const userTurnCount = history.filter((m) => m.role === "user").length;

    // CON-98 layer 2: wrap the LATEST user turn so the model can tell
    // visitor input apart from system instructions. Older history is left
    // un-wrapped intentionally — re-wrapping in-flight conversations would
    // change model behaviour for benign visitors mid-conversation.
    if (injectionDefenceOn && history.length > 0) {
      const last = history[history.length - 1];
      if (last.role === "user") {
        last.content = wrapVisitorMessage(last.content);
      }
    }

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
      const formatted = formatChunksForPrompt(chunks);
      // CON-98 layer 2 (cont.): fence-wrap RAG chunks as DATA so the
      // model can't be tricked by a chunk containing "ignore previous
      // instructions" (indirect injection — the threat that matters
      // most for CON-143 + CON-89).
      retrievalContext = injectionDefenceOn
        ? wrapRagContext(formatted)
        : formatted;
      if (chunks.length > 0) {
        console.log(
          `[Chat] retrieved ${chunks.length} chunks in ${Date.now() - retrievalStart}ms ` +
            `for tenant ${tenant.id} (top distance ${chunks[0].distance.toFixed(3)})`
        );
      }
    } catch (err) {
      console.error("[Chat] retrieval failed (non-fatal):", err);
    }

    // CON-90: resolve forum.config.json driven response-engine settings
    // (3-part structure, locale, banned-word filter, max_output_tokens).
    // Falls back to schema defaults when tenant has no `forumConfig`.
    const responseEngine = resolveResponseEngine(
      tenant.settings as Record<string, unknown> | null,
    );

    // System prompt gets the retrieved chunks appended (when any), then
    // the CON-90 response-engine addendum (3-part structure + locale).
    // Empty addendum when all CON-90 flags are off — preserves prior
    // behaviour for tenants who explicitly opt out.
    const fullSystemPrompt = [
      systemPrompt,
      retrievalContext,
      responseEngine.promptAddendum,
    ]
      .filter((s) => s && s.length > 0)
      .join("\n\n");

    // Stream from OpenAI — CON-90 enforces max_output_tokens from the
    // tenant's forum config (default 1500, schema-enforced positive int).
    const stream = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      stream: true,
      messages: [
        { role: "system", content: fullSystemPrompt },
        ...history,
      ],
      ...(responseEngine.maxTokens !== undefined
        ? { max_tokens: responseEngine.maxTokens }
        : {}),
    });

    // Build SSE response
    const encoder = new TextEncoder();
    let fullResponse = "";

    // CON-90: banned-word / exclusion-list streaming filter. Tail-
    // buffered so we never emit a partial banned term mid-stream.
    // Becomes a passthrough when no terms are configured.
    const bannedFilter = createStreamingFilter(responseEngine.bannedTerms);

    const readable = new ReadableStream({
      async start(controller) {
        // Send conversation ID first
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "meta", conversationId: convoId })}\n\n`
          )
        );

        let tokensEmittedToVisitor = false;

        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              // CON-90: pass each chunk through the banned-word streaming
              // filter first. It tail-buffers so partial banned terms
              // can't slip out mid-stream; passthrough when no terms.
              const safe = bannedFilter.push(content);
              if (safe) {
                fullResponse += safe;
                tokensEmittedToVisitor = true;
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: "token", content: safe })}\n\n`
                  )
                );
              }
            }
          }

          // CON-90: drain the banned-word filter's tail buffer at
          // end-of-stream so any residual safe text reaches the visitor.
          const tail = bannedFilter.flush();
          if (tail) {
            fullResponse += tail;
            tokensEmittedToVisitor = true;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "token", content: tail })}\n\n`
              )
            );
          }

          if (bannedFilter.redactionCount() > 0) {
            console.log(
              `[Chat] CON-90 banned-word filter redacted ` +
                `${bannedFilter.redactionCount()} term(s) for tenant ${tenant.id}`,
            );
          }

          // CON-98 layer 4: best-effort output guard.
          //
          // IMPORTANT: by the time we get here we have ALREADY streamed
          // tokens to the visitor over SSE. We can't unsend them. So:
          //   - We ALWAYS scan and log.
          //   - We swap `fullResponse` (the persisted copy) ONLY when no
          //     tokens were emitted (defensive — should be rare since
          //     tokens stream as they arrive). In all other cases we log
          //     the event and let the response stand. The real defence
          //     is layers 1–3; this is detection-only after the fact.
          let persistedContent = fullResponse;
          if (injectionDefenceOn) {
            const leak = scanOutputForLeakage(fullResponse, GLOBAL_RULES);
            if (leak.leaked && leak.marker) {
              void logInjectionEvent({
                tenantId: tenant.id,
                conversationId: convoId,
                messageId: null,
                visitorId,
                patternMatched: leak.marker,
                rawMessage: fullResponse,
              });
              if (!tokensEmittedToVisitor) {
                // Safe to substitute — visitor hasn't seen anything yet.
                persistedContent = OUTPUT_GUARD_FALLBACK;
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "token",
                      content: OUTPUT_GUARD_FALLBACK,
                    })}\n\n`
                  )
                );
              }
              // else: tokens already sent. Logged. Let it stand.
            }
          }

          // Persist assistant message after stream complete
          await addMessage(convoId, "assistant", persistedContent);

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
