import { NextRequest } from "next/server";
import OpenAI from "openai";
import { getTenantById } from "@/lib/tenant";
import {
  createConversation,
  getConversation,
  getConversationForVisitor,
  getConversationMessages,
  addMessage,
} from "@/lib/conversations";
import { buildSystemPrompt, GLOBAL_RULES } from "@/lib/guardrails";
import { resolveResponseEngine } from "@/lib/guardrails/response-engine";
import { createStreamingFilter } from "@/lib/guardrails/banned-words";
import { sendAdminNotification, sendLeadNotification } from "@/lib/notifications";
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
import { resolveCta } from "@/lib/cta/resolve";
import { readQualifying } from "@/lib/qualifying/types";
import { formatPersonaForPrompt } from "@/lib/qualifying/resolve";
import { buildGreetingAddendum } from "@/lib/qualifying/greeting";
import { maybeCaptureLead } from "@/lib/leads/capture";
import { fireAndForgetLeadSummary } from "@/lib/leads/summary";
import type { KeywordOverrides } from "@/lib/leads/intent";
import {
  aiPersonaSchema,
  allowedTopicsSchema,
  followUpSchema,
  qualifyingQuestionsSchema,
} from "@/lib/forum-config/schema";
import {
  runReEvaluation,
  buildCaseEvent,
  emitCaseEvent,
  actionRequiresCasePersistence,
  type CaseSseCapturePolicy,
  type CaseSseContactMethod,
} from "@/lib/follow-up/lifecycle";
import { createCase, getCaseByConversation } from "@/lib/cases";
import { recordCaseEvent } from "@/lib/cases/events";
import { CLASSIFIER_VERSION } from "@/lib/classifier/schema";
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
    const {
      tenantId,
      conversationId,
      visitorId,
      message,
      metadata,
      triggerGreeting,
      skipped,
    } = body;

    // `triggerGreeting` is a hidden assistant turn fired by the widget
    // after the visitor completes (or skips) the qualifying flow. No
    // visitor message exists; we run a single-sentence acknowledgement
    // turn so the bot doesn't go silent. See widget `triggerGreeting`.
    const isGreetingTurn = triggerGreeting === true;

    if (!tenantId || !visitorId) {
      return new Response(
        JSON.stringify({ error: "tenantId and visitorId are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    if (!isGreetingTurn && !message) {
      return new Response(
        JSON.stringify({ error: "message is required" }),
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
    // Skipped on greeting turns (no visitor message to scan).
    const injectionFlag = injectionDefenceOn && !isGreetingTurn
      ? detectInjection(message)
      : { flagged: false, pattern: null };

    // Resolve or create conversation
    let convoId = conversationId;
    if (!convoId) {
      const convo = await createConversation(tenantId, visitorId, metadata);
      convoId = convo.id;

      // Fire-and-forget admin notification for new conversations.
      // Skipped on greeting turns — there's nothing useful to notify
      // about until the visitor sends a real message.
      if (!isGreetingTurn) {
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
    } else {
      const existingConversation = await getConversationForVisitor(
        convoId,
        tenantId,
        visitorId
      );
      if (!existingConversation) {
        return new Response(
          JSON.stringify({ error: "Conversation not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Persist user message (raw — we don't mutate stored content; the
    // CON-98 wrapping is applied only to what we send to OpenAI).
    // Greeting turns have no visitor message, so nothing to persist.
    const persistedUser = isGreetingTurn
      ? null
      : await addMessage(convoId, "user", message);

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

    // CON-94: load resolved persona from this conversation's qualifying
    // state (if any). The model receives the persona as a structured
    // context block — it never sees the menu or option labels.
    const conversationRow = await getConversation(convoId);
    const qualifyingState = readQualifying(
      conversationRow?.metadata as Record<string, unknown> | null
    );
    const personaContext = formatPersonaForPrompt(qualifyingState);

    // ── CON-95: Lead capture & detection ────────────────────────────
    // Run BEFORE we kick off OpenAI. Pure regex + keyword scan; no
    // network calls in the hot path. The capture update is awaited
    // (single UPDATE) but the admin notification + AI summary are
    // fire-and-forget after the SSE stream closes so chat latency is
    // unaffected. Failures here must never break the chat response.
    // CON-98 already pulled `tenantSettings` above; reuse it here.
    const tenantSettingsForLead = (tenantSettings as Record<string, unknown> | null) ?? {};
    const leadConfig = (tenantSettingsForLead.lead_capture ??
      (tenantSettingsForLead as Record<string, unknown>).leadCapture) as
      | { enabled?: boolean; detection?: { keywords?: KeywordOverrides } }
      | undefined;
    const leadEnabled = leadConfig?.enabled !== false;
    const keywordOverrides = leadConfig?.detection?.keywords;

    let leadOutcome: Awaited<ReturnType<typeof maybeCaptureLead>> | null = null;
    // Greeting turns have no visitor message to scan for lead intent.
    if (!isGreetingTurn) {
      try {
        leadOutcome = await maybeCaptureLead({
          conversationId: convoId,
          message,
          keywordOverrides,
          enabled: leadEnabled,
        });
      } catch (err) {
        console.error("[Chat] lead capture failed (non-fatal):", err);
      }
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
    // Greeting turns have no fresh visitor message so there's nothing
    // new to wrap.
    if (injectionDefenceOn && !isGreetingTurn && history.length > 0) {
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
    // Greeting turns have no query, so we skip retrieval entirely.
    let retrievalContext = "";
    const retrievalStart = Date.now();
    if (!isGreetingTurn) {
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
    }

    // CON-90: resolve forum.config.json driven response-engine settings
    // (3-part structure, locale, banned-word filter, max_output_tokens).
    // Falls back to schema defaults when tenant has no `forumConfig`.
    const responseEngine = resolveResponseEngine(
      tenant.settings as Record<string, unknown> | null,
    );

    // Greeting-turn override (qualifying just finished or was skipped).
    // Drop the 3-part response-structure addendum and append a single,
    // tightly-scoped instruction so the model emits a one-sentence
    // acknowledgement instead of a substantive answer to nothing.
    // Copy lives in `buildGreetingAddendum` for unit-testability.
    const greetingAddendum = isGreetingTurn
      ? buildGreetingAddendum({ skipped: skipped === true })
      : "";

    // System prompt assembly:
    //   - base systemPrompt (tenant config + global rules)
    //   - CON-94 personaContext (resolved qualifying state, when any)
    //   - retrievalContext (RAG chunks for this turn)
    //   - CON-90 response-engine addendum (3-part structure + locale)
    // Empty strings are filtered — no behaviour change for tenants
    // without qualifying / RAG / response-engine config.
    //
    // Greeting turns swap the 3-part addendum for `greetingAddendum`
    // (single-sentence instruction). Locale handling — baked into the
    // response-engine addendum on normal turns — doesn't ride along
    // here; greeting turns are short enough that the base persona
    // prompt + Australian-English convention covers it.
    const fullSystemPrompt = [
      systemPrompt,
      personaContext,
      retrievalContext,
      isGreetingTurn ? greetingAddendum : responseEngine.promptAddendum,
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

          // CON-93 — resolve structured CTA from tenant config and emit as
          // its own SSE event. URLs come from `cta_rules` only; the model
          // never sees them, so it cannot invent one.
          // Skipped on greeting turns — no visitor message to classify
          // against, and we don't want a CTA on a one-sentence "hi".
          if (!isGreetingTurn) try {
            const ctaResult = resolveCta({
              settings: tenant.settings as Record<string, unknown> | null,
              messages: [...history, { role: "assistant", content: fullResponse }],
              assistantResponse: fullResponse,
            });
            if (ctaResult.shouldEmit) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "cta",
                    cta: ctaResult.cta,
                    followUp: ctaResult.followUp,
                  })}\n\n`
                )
              );
            }
          } catch (ctaErr) {
            // CTA resolution failures must never break the reply. Log and
            // continue — the user still gets a clean answer, just no button.
            console.error("[Chat] CTA resolution failed (non-fatal):", ctaErr);
          }

          // Follow-up re-evaluation lifecycle (CON-167, Epic C3).
          // Runs AFTER the token stream completes and the assistant message
          // is persisted, BEFORE the `done` event. Re-eval failure MUST NOT
          // break the chat response — `runReEvaluation` is non-throwing by
          // contract, and the surrounding try/catch is belt-and-braces.
          // Skipped on greeting turns — there's no visitor message to
          // re-evaluate, so the classifier has nothing to act on.
          if (!isGreetingTurn) try {
            const settings = (tenant.settings ?? {}) as Record<string, unknown>;
            const forumConfigRaw = (settings.forumConfig ?? {}) as Record<
              string,
              unknown
            >;
            const followUpRaw = forumConfigRaw.follow_up;
            const parsedFollowUp =
              followUpRaw !== undefined
                ? followUpSchema.safeParse(followUpRaw)
                : null;
            const parsedPersona = aiPersonaSchema.safeParse(
              forumConfigRaw.ai_persona,
            );
            const parsedQualifying = qualifyingQuestionsSchema.safeParse(
              forumConfigRaw.qualifying_questions ?? {},
            );
            const parsedTopics = allowedTopicsSchema.safeParse(
              forumConfigRaw.allowed_topics ?? [],
            );

            // Re-eval requires a valid follow_up block (enabled) AND a
            // schema-valid ai_persona slice for the classifier. If the
            // tenant has follow_up but no persona, we silently skip —
            // there's nothing meaningful to classify against.
            if (
              parsedFollowUp?.success &&
              parsedFollowUp.data.enabled &&
              parsedPersona.success &&
              parsedQualifying.success &&
              parsedTopics.success
            ) {
              const followUp = parsedFollowUp.data;
              const tenantClassifierConfig = {
                ai_persona: parsedPersona.data,
                qualifying_questions: parsedQualifying.data,
                allowed_topics: parsedTopics.data,
              };

              const qualifying = (
                metadata as Record<string, unknown> | undefined
              )?.qualifying as Record<string, string> | undefined;

              const lifecycleResult = await runReEvaluation({
                tenantId: tenant.id,
                conversationId: convoId,
                visitorMessage: message,
                history: [
                  ...history,
                  { role: "assistant", content: fullResponse },
                ],
                followUpConfig: followUp,
                tenantConfig: tenantClassifierConfig,
                conversationContext: {
                  tenantId: tenant.id,
                  conversationId: convoId,
                  pageUrl: (metadata as Record<string, unknown>)?.pageUrl as
                    | string
                    | undefined,
                  qualifyingPersona: qualifying,
                },
              });

              if (lifecycleResult) {
                // CON-170 / D2a — persist the case row BEFORE emitting
                // the widget `case` event. The widget binds its capture
                // form to `case_id`; the event must not fire without a
                // committed row, or the subsequent POST
                // `/api/cases/{caseId}/capture` would 404.
                //
                // Persistence is tenant-scoped via the B5 helpers from
                // CON-164 (`createCase`, `getCaseByConversation`,
                // `recordCaseEvent`). The unique index
                // `follow_up_cases_tenant_conversation_unique` guarantees
                // one case per (tenant, conversation); we use a
                // find-then-create dance to stay idempotent across
                // re-eval turns within the same conversation.
                //
                // Failures here MUST NOT break the chat response. The
                // outer `reevalErr` catch covers throws — we additionally
                // guard the widget event emission below so a persistence
                // failure short-circuits the widget without crashing the
                // SSE stream.
                const { action } = lifecycleResult;
                let persistedCaseId: string | null = null;

                // CON-172 / D4 — resolve the contact method from
                // the tenant's validated config so we can both inline
                // it on the SSE `case` event (widget render) AND log
                // `channels_shown` into the case audit event. The
                // model never sees the address; resolution happens
                // server-side from the validated `followUp.contact_methods`
                // by id. The schema already enforced rule → method
                // linkage at parse time, so a known contact_method_id
                // MUST resolve here; if not (e.g. config drift), we
                // omit the inlined object and log + carry on.
                const contactMethodId =
                  action.type === "refer_to_approved_contact_method" ||
                  action.type === "immediate_escalation"
                    ? action.contact_method_id
                    : undefined;

                let contactMethod: CaseSseContactMethod | undefined;
                if (contactMethodId !== undefined) {
                  const cm = followUp.contact_methods.find(
                    (c) => c.id === contactMethodId,
                  );
                  if (cm) {
                    contactMethod = {
                      id: cm.id,
                      type: cm.type,
                      label: cm.label,
                      value: cm.value,
                      url: cm.url,
                    };
                  } else {
                    console.error(
                      "[follow-up] contact_method_id not resolvable from tenant config",
                      {
                        tenantId: tenant.id,
                        conversationId: convoId,
                        contact_method_id: contactMethodId,
                      },
                    );
                  }
                }

                if (actionRequiresCasePersistence(action)) {
                  try {
                    const existing = await getCaseByConversation(
                      tenant.id,
                      convoId,
                    );
                    if (existing) {
                      persistedCaseId = existing.id;
                    } else {
                      const created = await createCase(tenant.id, {
                        conversationId: convoId,
                        caseType: action.case_type,
                        routingKey: action.routing_key,
                        ruleId: action.rule_id,
                        classifierConfidence: action.confidence,
                        source: "follow_up_classifier",
                      });
                      persistedCaseId = created.id;
                    }

                    // CON-170: append an audit event capturing the
                    // classifier output + evidence for this turn. Best
                    // effort — a failure to log does not block the
                    // widget event since the case row is already
                    // committed.
                    //
                    // CON-172 / D4: when the action is
                    // `refer_to_approved_contact_method`, also include
                    // `channels_shown` in the payload so the audit log
                    // records exactly which approved methods the visitor
                    // saw (id + type + label — NEVER the raw delivery
                    // value; that stays inside the resolved tenant
                    // config and the widget render).
                    try {
                      const channelsShown =
                        action.type === "refer_to_approved_contact_method" &&
                        contactMethod !== undefined
                          ? [
                              {
                                id: contactMethod.id,
                                type: contactMethod.type,
                                label: contactMethod.label,
                              },
                            ]
                          : undefined;

                      await recordCaseEvent(tenant.id, {
                        caseId: persistedCaseId,
                        conversationId: convoId,
                        actorType: "classifier",
                        actorId: CLASSIFIER_VERSION,
                        eventType: "case_resolved",
                        payload: {
                          action: action.type,
                          rule_id: action.rule_id,
                          routing_key: action.routing_key,
                          case_type: action.case_type,
                          confidence: action.confidence,
                          evidence: action.evidence,
                          classifier_output: lifecycleResult.classifierResult.output,
                          classifier_version: CLASSIFIER_VERSION,
                          ...(channelsShown !== undefined
                            ? { channels_shown: channelsShown }
                            : {}),
                        },
                      });
                    } catch (eventErr) {
                      console.error(
                        "[follow-up] case audit event append failed (non-fatal):",
                        {
                          tenantId: tenant.id,
                          conversationId: convoId,
                          caseId: persistedCaseId,
                          err:
                            eventErr instanceof Error
                              ? eventErr.message
                              : String(eventErr),
                        },
                      );
                    }
                  } catch (persistErr) {
                    console.error(
                      "[follow-up] case persistence failed (non-fatal):",
                      {
                        tenantId: tenant.id,
                        conversationId: convoId,
                        action: action.type,
                        err:
                          persistErr instanceof Error
                            ? persistErr.message
                            : String(persistErr),
                      },
                    );
                  }
                }

                // Resolve full capture_policy from tenant config so the
                // widget gets `required_fields[]`, `optional_fields[]`,
                // `privacy_notice`, and `privacy_policy_url` inlined on
                // the SSE `case` event (CON-170 / D2a). The schema
                // already enforced rule → policy linkage at parse time,
                // so a known capture_policy_id MUST resolve here; if not,
                // we omit the inlined object and rely on the back-compat
                // `capture_policy_id` string instead.
                const policyId =
                  action.type === "offer_follow_up" ||
                  action.type === "capture_details_then_flag" ||
                  action.type === "immediate_escalation"
                    ? action.capture_policy_id
                    : undefined;

                let capturePolicy: CaseSseCapturePolicy | undefined;
                if (policyId !== undefined) {
                  const policy = followUp.capture_policies.find(
                    (p) => p.id === policyId,
                  );
                  if (policy) {
                    capturePolicy = {
                      id: policy.id,
                      case_type: policy.case_type,
                      required_fields: policy.required_fields,
                      optional_fields: policy.optional_fields,
                      privacy_notice: policy.privacy_notice,
                      privacy_policy_url: policy.privacy_policy_url,
                    };
                  } else {
                    console.error(
                      "[follow-up] capture_policy_id not resolvable from tenant config",
                      {
                        tenantId: tenant.id,
                        conversationId: convoId,
                        capture_policy_id: policyId,
                      },
                    );
                  }
                }

                // Emit the widget event only when both: (a) the action
                // requires widget UI and (b) we have a persisted case_id
                // for the widget to bind to. If persistence failed and we
                // have no case_id, we silently skip — the visitor still
                // gets a clean assistant reply, and the next re-eval turn
                // will retry persistence.
                if (persistedCaseId !== null) {
                  const caseEvent = buildCaseEvent(action, {
                    caseId: persistedCaseId,
                    capturePolicy,
                    contactMethod,
                  });
                  if (caseEvent) {
                    emitCaseEvent(controller, encoder, caseEvent);
                  }
                }
              }
            }
          } catch (reevalErr) {
            // Re-eval failure MUST NOT break the chat response. Log + carry on.
            console.error("[follow-up] re-eval failed (non-fatal):", {
              tenantId: tenant.id,
              conversationId: convoId,
              err:
                reevalErr instanceof Error
                  ? reevalErr.message
                  : String(reevalErr),
            });
          }

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
          );

          // CON-95: post-stream lead notification + AI summary.
          // Strictly after the visitor's response is delivered so chat
          // latency is untouched. Both calls are internally fire-and-
          // forget; errors are caught + logged.
          // Greeting turns never set `leadOutcome` (no visitor message
          // to scan), so the guard already short-circuits, but the
          // explicit check makes the intent obvious.
          if (
            !isGreetingTurn &&
            leadOutcome &&
            (leadOutcome.kind === "captured" || leadOutcome.kind === "updated") &&
            (leadOutcome.newDetections.length > 0 ||
              leadOutcome.newIntents.length > 0)
          ) {
            try {
              sendLeadNotification(
                {
                  id: tenant.id,
                  name: tenant.name,
                  slug: tenant.slug,
                  settings: tenant.settings as Record<string, unknown> | null,
                },
                {
                  id: convoId,
                  visitorId,
                  metadata: metadata as Record<string, unknown> | undefined,
                },
                leadOutcome.lead,
                {
                  newDetections: leadOutcome.newDetections,
                  newIntents: leadOutcome.newIntents,
                  firstCapture: leadOutcome.kind === "captured",
                }
              );
            } catch (err) {
              console.error("[Chat] lead notification dispatch failed:", err);
            }

            try {
              fireAndForgetLeadSummary({
                conversationId: convoId,
                tenantName: tenant.name,
                history: [
                  ...history,
                  { role: "user", content: message },
                  { role: "assistant", content: fullResponse },
                ],
                lead: leadOutcome.lead,
                metadata: (metadata as Record<string, unknown> | null) ?? null,
              });
            } catch (err) {
              console.error("[Chat] lead summary dispatch failed:", err);
            }
          }
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
