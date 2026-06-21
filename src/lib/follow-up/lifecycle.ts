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
 * Persistence (`follow_up_cases`, `follow_up_events`) is wired at the
 * chat-route layer via the tenant-scoped B5 helpers from `@/lib/cases`
 * (CON-164). CON-170 / D2a: callers use `actionRequiresCasePersistence`
 * to decide whether to call `createCase` + `recordCaseEvent` before
 * emitting the widget SSE `case` event. Attribute upserts
 * (`follow_up_case_attributes`) remain a future addition once the inbox
 * surfaces (Epic E) need per-turn classifier snapshots.
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
import type {
  CapturePolicy,
  CaseType,
  ContactMethod,
  FollowUp,
} from "@/lib/forum-config/schema";

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
 * Inlined capture-policy payload emitted on the SSE `case` event
 * (CON-170 / D2a). The widget (Epic D — D2b) needs the full resolved
 * policy on the wire, not just the id, so it can render required +
 * optional fields and surface privacy copy without a second round-trip.
 *
 * Sourced from `tenantClassifierConfig.followUp.capture_policies` on the
 * server, resolved by id at chat-route time. Matches the
 * `capturePolicySchema` shape but typed as `Pick<>` so this module never
 * has to evolve when the schema gains audit-only fields.
 */
export type CaseSseCapturePolicy = Pick<
  CapturePolicy,
  "id" | "case_type" | "required_fields" | "optional_fields" | "privacy_notice" | "privacy_policy_url"
>;

/**
 * Inlined approved-contact-method payload emitted on the SSE `case`
 * event (CON-172 / D4 — `refer_to_approved_contact_method`). The widget
 * needs the full resolved method (label + delivery value / url) inline
 * so it can render a `mailto:`, `tel:`, or button-to-URL surface
 * without a second round-trip. The model never sees this payload —
 * same architectural pattern as the CON-93 CTA. Resolved server-side
 * from `followUp.contact_methods` by id.
 */
export type CaseSseContactMethod = Pick<
  ContactMethod,
  "id" | "type" | "label" | "value" | "url"
>;

/**
 * SSE `case` event payload emitted to the widget when a `ResolvedAction`
 * needs widget-side UI (Epic D consumes this). Pulled to a typed surface
 * here so the route file simply passes it to the encoder.
 *
 * Discriminator: `case.action` — maps 1:1 to `ResolvedAction["type"]`.
 *
 * Required fields on the widget contract (CON-170 / D2a):
 *   - `case_id` — stable id the widget binds capture-form submissions to.
 *   - `capture_policy` — inlined full policy object (`required_fields`,
 *     `optional_fields`, `privacy_notice`, `privacy_policy_url`). Only
 *     present when the action carries a `capture_policy_id`.
 *
 * Back-compat fields preserved (older widget builds key off id strings):
 *   - `capture_policy_id`, `contact_method_id`
 *
 * Other optional fields populated based on the action variant:
 *   - `offer_follow_up`, `capture_details_then_flag`: `capture_policy_id`
 *     (+ inlined `capture_policy`)
 *   - `immediate_escalation`: either or both of `capture_policy_id` /
 *     `contact_method_id` (+ inlined `capture_policy` when policy id present)
 *   - All non-noop variants: `rule_id`, `routing_key`, `case_type`,
 *     `confidence`
 *
 * Evidence is NOT emitted to the widget — it's staff-side audit data.
 */
export type CaseSseEvent = {
  type: "case";
  case: {
    action: ResolvedAction["type"];
    case_id: string;
    rule_id?: string;
    routing_key?: string;
    case_type?: CaseType;
    confidence?: number;
    capture_policy_id?: string;
    capture_policy?: CaseSseCapturePolicy;
    contact_method_id?: string;
    /**
     * CON-172 (Epic D4): inlined contact method (resolved server-side
     * from `followUp.contact_methods` by `contact_method_id`). Present
     * only when the action variant carries a `contact_method_id` and
     * the id resolved against the validated tenant config.
     */
    contact_method?: CaseSseContactMethod;
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
 *   - `refer_to_approved_contact_method` → YES (CON-172 / D4 — surfaces
 *     the tenant's approved contact method as an inline card; the
 *     model never sees the address)
 *   - `continue_helping` → NO (the default; no case, no event)
 *   - `clarify_then_recheck` → NO (next turn handles it via classifier)
 */
export function actionRequiresWidget(action: ResolvedAction): boolean {
  switch (action.type) {
    case "offer_follow_up":
    case "capture_details_then_flag":
    case "immediate_escalation":
    case "refer_to_approved_contact_method":
      return true;
    case "flag_for_staff_review_without_interrupting_visitor":
    case "continue_helping":
    case "clarify_then_recheck":
      return false;
  }
}

/**
 * Options passed to `buildCaseEvent` carrying the server-resolved data
 * the widget needs but that the resolver cannot produce on its own.
 *
 * CON-170 / D2a:
 *   - `caseId` is the persisted `follow_up_cases.id`. The chat route
 *     creates the case BEFORE calling `buildCaseEvent`, so the id is
 *     always known when this function is invoked.
 *   - `capturePolicy` is the FULL resolved policy looked up from
 *     `followUp.capture_policies` by `action.capture_policy_id`. The
 *     widget needs `required_fields`, `optional_fields`, `privacy_notice`,
 *     and `privacy_policy_url` inlined so it can render the form without
 *     a second fetch. `undefined` when the action does not carry a
 *     `capture_policy_id` (e.g. `immediate_escalation` without a policy).
 */
export type BuildCaseEventOptions = {
  caseId: string;
  capturePolicy?: CaseSseCapturePolicy;
  /**
   * CON-172 (Epic D4) — resolved contact method for the
   * `refer_to_approved_contact_method` action. The route layer looks
   * it up from the tenant's validated `followUp.contact_methods` by
   * `action.contact_method_id` and passes it through here. When the
   * action variant carries a `contact_method_id` (refer, or
   * `immediate_escalation` with a contact set), this MUST be supplied
   * for the widget to render anything useful; if omitted, the event is
   * still emitted with the id only and the widget falls back
   * gracefully (no card rendered, transcript stands on its own).
   */
  contactMethod?: CaseSseContactMethod;
};

/**
 * Build a `CaseSseEvent` payload for a `ResolvedAction`, or `null` when
 * the action does not need widget UI. Pure function — the route handler
 * just JSON-stringifies the result.
 *
 * Requires `opts.caseId` (the persisted `follow_up_cases.id`). If the
 * action carries a `capture_policy_id`, the caller MUST also pass
 * `opts.capturePolicy` resolved from the tenant's follow-up config; the
 * inlined object is what the widget reads to render its capture form
 * (CON-170 / D2a).
 */
export function buildCaseEvent(
  action: ResolvedAction,
  opts: BuildCaseEventOptions,
): CaseSseEvent | null {
  if (!actionRequiresWidget(action)) return null;

  const policyFields =
    opts.capturePolicy !== undefined
      ? { capture_policy: opts.capturePolicy }
      : {};

  switch (action.type) {
    case "offer_follow_up":
      return {
        type: "case",
        case: {
          action: action.type,
          case_id: opts.caseId,
          rule_id: action.rule_id,
          routing_key: action.routing_key,
          case_type: action.case_type,
          confidence: action.confidence,
          capture_policy_id: action.capture_policy_id,
          ...policyFields,
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
          case_id: opts.caseId,
          rule_id: action.rule_id,
          routing_key: action.routing_key,
          case_type: action.case_type,
          confidence: action.confidence,
          capture_policy_id: action.capture_policy_id,
          ...policyFields,
        },
      };
    case "immediate_escalation":
      return {
        type: "case",
        case: {
          action: action.type,
          case_id: opts.caseId,
          rule_id: action.rule_id,
          routing_key: action.routing_key,
          case_type: action.case_type,
          confidence: action.confidence,
          ...(action.capture_policy_id !== undefined
            ? { capture_policy_id: action.capture_policy_id }
            : {}),
          ...(action.capture_policy_id !== undefined ? policyFields : {}),
          ...(action.contact_method_id !== undefined
            ? { contact_method_id: action.contact_method_id }
            : {}),
          ...(action.contact_method_id !== undefined &&
          opts.contactMethod !== undefined
            ? { contact_method: opts.contactMethod }
            : {}),
        },
      };
    case "refer_to_approved_contact_method":
      // CON-172 / D4 — surface the tenant's approved contact method.
      // `contact_method_id` always present (schema-enforced); the
      // inlined `contact_method` is present whenever the route layer
      // resolved the id against the tenant's validated config.
      return {
        type: "case",
        case: {
          action: action.type,
          case_id: opts.caseId,
          rule_id: action.rule_id,
          routing_key: action.routing_key,
          case_type: action.case_type,
          confidence: action.confidence,
          contact_method_id: action.contact_method_id,
          ...(opts.contactMethod !== undefined
            ? { contact_method: opts.contactMethod }
            : {}),
        },
      };
    /* c8 ignore next 4 — unreachable given actionRequiresWidget gate */
    default:
      return null;
  }
}

/**
 * Pure predicate: does this action require the route layer to persist a
 * `follow_up_cases` row?
 *
 * Mirrors `actionRequiresWidget` but also includes
 * `flag_for_staff_review_without_interrupting_visitor` — silent flags
 * still create a case (staff inbox visibility), they just don't emit a
 * widget SSE event. This is the PRD-locked invariant: "a case may exist
 * without a contact".
 *
 * CON-172 / D4: `refer_to_approved_contact_method` is NOW persisted —
 * the case row gives staff visibility that the visitor was referred
 * out-of-chat, and the `case_resolved` audit event carries the
 * `channels_shown` payload (the contact method id + label the visitor
 * actually saw). Per Linear acceptance criteria: "Case still created
 * (with action audit and `contact_method_id` recorded on the case)."
 */
export function actionRequiresCasePersistence(
  action: ResolvedAction,
): action is Extract<
  ResolvedAction,
  {
    type:
      | "offer_follow_up"
      | "capture_details_then_flag"
      | "immediate_escalation"
      | "flag_for_staff_review_without_interrupting_visitor"
      | "refer_to_approved_contact_method";
  }
> {
  switch (action.type) {
    case "offer_follow_up":
    case "capture_details_then_flag":
    case "immediate_escalation":
    case "flag_for_staff_review_without_interrupting_visitor":
    case "refer_to_approved_contact_method":
      return true;
    case "continue_helping":
    case "clarify_then_recheck":
      return false;
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
 * Persistence (case row + audit event) is handled at the chat-route
 * layer using the tenant-scoped B5 helpers from `@/lib/cases` (CON-164).
 * This module stays I/O-free per its non-throwing contract; callers use
 * `actionRequiresCasePersistence(action)` to decide whether to persist.
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

    // Persistence (case row + audit event) happens at the chat-route
    // layer using the tenant-scoped B5 helpers from `@/lib/cases`
    // (CON-164). This module stays I/O-free per its non-throwing contract
    // — the route caller reads `action.type`, dispatches via
    // `actionRequiresCasePersistence`, and uses `createCase` +
    // `recordCaseEvent`. CON-170 / D2a wires that.

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
