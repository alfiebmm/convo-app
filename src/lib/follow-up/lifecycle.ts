/**
 * Follow-up re-evaluation lifecycle (CON-167, Epic C3).
 *
 * Wires the LLM classifier (CON-165) and the deterministic rule evaluator
 * (CON-166) into the live `/api/chat` SSE loop. This module is the single
 * extraction point for the lifecycle so the route file change stays small
 * and surgical.
 *
 * Lifecycle triggers implemented at V1 (PRD §14):
 *   1. After meaningful visitor turn — greetings/acknowledgements skipped.
 *   4. On conversation completion — handled by the same code path (the
 *      route calls `runReEvaluation` once per assistant turn; if the
 *      conversation status changes to `completed`, the final turn re-eval
 *      is the "completion" trigger).
 *
 * Out of scope at V1 (Epic D/E will plug in):
 *   2. After visitor answers a capture question — Epic D triggers this
 *      via a separate code path that re-uses `runReEvaluation`.
 *   5. Staff-requested manual refresh — Epic E inbox UI.
 *
 * Persistence (`follow_up_cases`, `follow_up_case_attributes`,
 * `follow_up_events`) is stubbed pending B5 helpers under Epic B
 * (CON-151), currently P0-blocked. The lifecycle returns enough info for
 * B5 to wire in without changing this module.
 *
 * Hard guarantees:
 *   - Never throws. Classifier already returns `{ok:false}` on degradation;
 *     `runReEvaluation` belt-and-braces wraps the resolver call in a
 *     try/catch and returns `null` on any error.
 *   - Tenant-scoped. `ClassifierTenantConfig` is a strict `Pick<>` so
 *     connector data is structurally unreachable. `FollowUp` config is
 *     loaded from the authenticated tenant's `settings.forumConfig` only.
 *   - No new SSE event shapes other than `case`. Existing `meta`, `token`,
 *     `done`, `error`, `cta` events are untouched.
 */

import {
  classifyConversation,
  type ClassifierTenantConfig,
  type ClassifyConversationResult,
} from "@/lib/classifier";
import type { ClassifierMessage } from "@/lib/classifier/prompt";
import type { CaseType, FollowUp } from "@/lib/forum-config/schema";

import { resolveAction } from "./resolver";
import type { ConversationContext, ResolvedAction } from "./resolver-types";

// ---------------------------------------------------------------------------
// Greeting / short-message bypass (CON-90 pattern, private mirror)
// ---------------------------------------------------------------------------

/**
 * Patterns that mark a message as a greeting / acknowledgement and
 * therefore NOT a re-eval trigger. Re-uses CON-90's exception-list logic.
 * Kept private to this module; when CON-90's helper is exposed publicly we
 * swap to it.
 */
const GREETING_PATTERNS: readonly RegExp[] = [
  /^(hi|hello|hey|howdy|sup|yo|hiya|gday|g'day)\b/i,
  /^(thanks?|thx|cheers|ta|ok|okay|kay|cool|nice|great|awesome|sure|yes|yep|yeah|no|nah|nope)\b/i,
  /^(bye|goodbye|cya|see ya|later)\b/i,
  /^👋|^👍|^🙏|^😊|^❤|^🎉/u,
];

const TRAILING_PUNCT = /[.!?…\s]+$/;

/**
 * Pure predicate: true if the visitor message is a greeting,
 * acknowledgement, or otherwise too short to warrant a re-eval.
 *
 * Rationale: classifier calls cost a model invocation. Skipping known no-op
 * inputs keeps the per-turn budget sane and avoids polluting the rule
 * evaluator with noise.
 */
export function looksLikeGreeting(message: string): boolean {
  const trimmed = message.trim().replace(TRAILING_PUNCT, "");
  if (trimmed.length === 0) return true;
  // Single-token short answers like "hi", "thx", "ok", "kk".
  if (trimmed.length <= 4 && /^[a-z\p{Emoji}]+$/iu.test(trimmed)) return true;
  return GREETING_PATTERNS.some((re) => re.test(trimmed));
}

// ---------------------------------------------------------------------------
// SSE `case` event shape
// ---------------------------------------------------------------------------

/**
 * SSE `case` event payload emitted to the widget when a `ResolvedAction`
 * needs widget-side UI (Epic D consumes this). Pulled to a typed surface
 * here so the route file simply passes it to the encoder.
 *
 * Discriminator: `case.action` — maps 1:1 to `ResolvedAction["type"]`.
 *
 * Optional fields are populated based on the action variant:
 *   - `offer_follow_up`, `capture_details_then_flag`: `capture_policy_id`
 *   - `immediate_escalation`: either or both of `capture_policy_id` /
 *     `contact_method_id`
 *   - All non-noop variants: `rule_id`, `routing_key`, `case_type`,
 *     `confidence`
 *
 * Evidence is NOT emitted to the widget — it's staff-side audit data.
 */
export type CaseSseEvent = {
  type: "case";
  case: {
    action: ResolvedAction["type"];
    rule_id?: string;
    routing_key?: string;
    case_type?: CaseType;
    confidence?: number;
    capture_policy_id?: string;
    contact_method_id?: string;
    // CON-169 (Epic D1): visitor-facing title for the `offer_follow_up`
    // card. Only populated when the matched rule sets `offer_title`.
    offer_title?: string;
  };
};

/**
 * Pure predicate: does this action require the widget to render UI?
 *
 * V1 mapping:
 *   - `offer_follow_up` → yes (capture form)
 *   - `capture_details_then_flag` → yes (capture form, then silent flag)
 *   - `immediate_escalation` → yes (escalation handoff banner; capture form
 *     if `capture_policy_id` present)
 *   - `flag_for_staff_review_without_interrupting_visitor` → NO (silent
 *     flag, case still created per acceptance criteria, no widget UI)
 *   - `refer_to_approved_contact_method` → NO at V1 (Epic D will decide
 *     whether to surface the contact via prompt vs widget; for now
 *     silent)
 *   - `continue_helping` → NO (the default; no case, no event)
 *   - `clarify_then_recheck` → NO (next turn handles it via classifier)
 */
export function actionRequiresWidget(action: ResolvedAction): boolean {
  switch (action.type) {
    case "offer_follow_up":
    case "capture_details_then_flag":
    case "immediate_escalation":
      return true;
    case "flag_for_staff_review_without_interrupting_visitor":
    case "refer_to_approved_contact_method":
    case "continue_helping":
    case "clarify_then_recheck":
      return false;
  }
}

/**
 * Build a `CaseSseEvent` payload for a `ResolvedAction`, or `null` when
 * the action does not need widget UI. Pure function — the route handler
 * just JSON-stringifies the result.
 */
export function buildCaseEvent(action: ResolvedAction): CaseSseEvent | null {
  if (!actionRequiresWidget(action)) return null;

  switch (action.type) {
    case "offer_follow_up":
      return {
        type: "case",
        case: {
          action: action.type,
          rule_id: action.rule_id,
          routing_key: action.routing_key,
          case_type: action.case_type,
          confidence: action.confidence,
          capture_policy_id: action.capture_policy_id,
          // CON-169 (Epic D1): surface rule-configured title to the widget.
          ...(action.offer_title !== undefined
            ? { offer_title: action.offer_title }
            : {}),
        },
      };
    case "capture_details_then_flag":
      return {
        type: "case",
        case: {
          action: action.type,
          rule_id: action.rule_id,
          routing_key: action.routing_key,
          case_type: action.case_type,
          confidence: action.confidence,
          capture_policy_id: action.capture_policy_id,
        },
      };
    case "immediate_escalation":
      return {
        type: "case",
        case: {
          action: action.type,
          rule_id: action.rule_id,
          routing_key: action.routing_key,
          case_type: action.case_type,
          confidence: action.confidence,
          ...(action.capture_policy_id !== undefined
            ? { capture_policy_id: action.capture_policy_id }
            : {}),
          ...(action.contact_method_id !== undefined
            ? { contact_method_id: action.contact_method_id }
            : {}),
        },
      };
    /* c8 ignore next 4 — unreachable given actionRequiresWidget gate */
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Re-evaluation entry point
// ---------------------------------------------------------------------------

export type LifecycleInput = {
  tenantId: string;
  conversationId: string;
  /** The latest visitor message (the one that triggered this turn). */
  visitorMessage: string;
  /**
   * Full classifier-shaped history including the latest visitor message
   * AND the just-streamed assistant message. The route passes its history
   * array verbatim after appending the new turns.
   */
  history: ClassifierMessage[];
  followUpConfig: FollowUp;
  tenantConfig: ClassifierTenantConfig;
  conversationContext: ConversationContext;
  /**
   * Optional classifier override for tests. Production callers leave this
   * undefined and the real `classifyConversation` is invoked.
   */
  classifierFn?: typeof classifyConversation;
};

export type LifecycleResult = {
  action: ResolvedAction;
  classifierResult: ClassifyConversationResult;
};

/**
 * Run one re-evaluation pass.
 *
 * Returns `null` if the re-eval was skipped (greeting bypass, disabled
 * config) or if any unexpected error was caught. A non-null return means
 * the resolver produced a definitive action.
 *
 * Algorithm:
 *   1. Short-circuit on `followUpConfig.enabled === false` — no classifier
 *      call. (Matches resolver's own short-circuit, but we want to skip
 *      the expensive LLM round-trip too.)
 *   2. Short-circuit on greeting via `looksLikeGreeting(visitorMessage)`.
 *   3. Call classifier (never throws — returns `{ok:false}` on failure).
 *   4. Call deterministic resolver (pure function, never throws).
 *   5. Wrap entire body in try/catch as belt-and-braces; return `null` on
 *      any caught throw.
 *
 * Persistence stubs (B5, see module header) are documented at the route
 * call-site as inline `TODO(B5)` markers. This module returns enough info
 * for B5 to wire in later without changes here.
 */
export async function runReEvaluation(
  input: LifecycleInput,
): Promise<LifecycleResult | null> {
  try {
    // 1. Disabled config — skip classifier (cost) and resolver entirely.
    if (input.followUpConfig.enabled === false) {
      return null;
    }

    // 2. Greeting / acknowledgement — skip re-eval per PRD §14 #1.
    if (looksLikeGreeting(input.visitorMessage)) {
      return null;
    }

    // 3. Classify. `classifyConversation` is non-throwing by contract.
    const classifyFn = input.classifierFn ?? classifyConversation;
    const classifierResult = await classifyFn({
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      messages: input.history,
      tenantConfig: input.tenantConfig,
    });

    // 4. Resolve. Pure function, no I/O.
    const action = resolveAction({
      classifierOutput: classifierResult.output,
      followUpConfig: input.followUpConfig,
      conversationContext: input.conversationContext,
    });

    // TODO(B5): persist case + attributes + evidence event.
    //   - if (action.type is one of offer_follow_up, capture_details_then_flag,
    //     flag_for_staff_review_without_interrupting_visitor,
    //     immediate_escalation) → upsert row in `follow_up_cases` keyed
    //     (tenant_id, conversation_id).
    //   - Always upsert `follow_up_case_attributes` for the current turn
    //     with classifierResult.output.
    //   - Always append a `follow_up_events` row with action.evidence (if
    //     present), classifierResult.output, and CLASSIFIER_VERSION.
    //   The lifecycle returns enough info for B5 to wire these in without
    //   modifying this module.

    return { action, classifierResult };
  } catch (err) {
    // Belt-and-braces. Classifier already non-throwing; resolver is pure.
    // If something downstream changes that contract, we still must not
    // break the chat response. Log and return null.
    console.error("[follow-up] re-eval lifecycle threw unexpectedly", {
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// SSE emission helper
// ---------------------------------------------------------------------------

/**
 * Encode and enqueue a `case` SSE event onto the existing
 * ReadableStream controller. The route handler owns the controller /
 * encoder pair; we accept them as parameters so this module is testable
 * without mocking a TransformStream.
 */
export function emitCaseEvent(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  event: CaseSseEvent,
): void {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
}
