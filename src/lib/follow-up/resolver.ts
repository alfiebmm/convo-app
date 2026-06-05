/**
 * Deterministic follow-up rule evaluator (CON-166, Epic C2).
 *
 * Pure function. No I/O. No DB. No LLM. No file reads. No network.
 *
 * Consumes the classifier output (CON-165), the parsed tenant
 * `follow_up` block (CON-157), and a small conversation-context object,
 * and returns a `ResolvedAction` describing what the lifecycle should do.
 *
 * Architectural contract:
 *   - Same input → same output, every time. No `Date.now`, no `Math.random`,
 *     no module-level state, no environment reads.
 *   - All inputs are treated as readonly. Rule arrays are never mutated;
 *     sorting is done on a fresh shallow copy.
 *   - The forum-config schema (CON-157) already validates that every rule's
 *     `action` ↔ `capture_policy_id` ↔ `contact_method_id` triple is
 *     well-formed, and that referenced policies / contact methods exist
 *     with matching `case_type`. This resolver TRUSTS those invariants and
 *     does not re-validate them — callers must run a config through
 *     `validateForumConfig` (or `followUpSchema.parse`) before invoking
 *     `resolveAction`.
 *   - Output is consumed by CON-167 (Epic C3 — re-eval lifecycle), which
 *     hooks the resolver into `/api/chat`.
 */

import type {
  ClassifierOutput,
} from "@/lib/classifier/schema";
import type {
  FollowUp,
  FollowUpRule,
  RuleCondition,
  RulePriority,
  Sensitivity,
} from "@/lib/forum-config/schema";

import type {
  ConversationContext,
  Evidence,
  ResolvedAction,
} from "./resolver-types";

// ---------------------------------------------------------------------------
// Sensitivity → threshold multiplier
// ---------------------------------------------------------------------------

/**
 * Sensitivity multiplier table.
 *
 * The multiplier is applied to each rule's `confidence_threshold` BEFORE
 * comparing against the rule's computed confidence. Result is clamped to
 * [0, 1] so a `conservative` multiplier on a 0.9 threshold doesn't push it
 * past 1.0.
 *
 *   conservative = 1.2  → raises the bar    (fewer matches, safer)
 *   balanced     = 1.0  → no change         (default)
 *   proactive    = 0.8  → lowers the bar    (more matches, more engagement)
 */
const SENSITIVITY_MULTIPLIER: Record<Sensitivity, number> = {
  conservative: 1.2,
  balanced: 1.0,
  proactive: 0.8,
};

export function applySensitivity(
  threshold: number,
  sensitivity: Sensitivity,
): number {
  const multiplier = SENSITIVITY_MULTIPLIER[sensitivity];
  const adjusted = threshold * multiplier;
  // Clamp to [0, 1] — confidences are bounded so the threshold should be too.
  if (adjusted < 0) return 0;
  if (adjusted > 1) return 1;
  return adjusted;
}

// ---------------------------------------------------------------------------
// Priority ordering
// ---------------------------------------------------------------------------

const PRIORITY_ORDER: Record<RulePriority, number> = {
  high: 0,
  normal: 1,
  low: 2,
};

/**
 * Stable sort: priority first (`high` → `normal` → `low`), then original
 * array order within the same priority.
 *
 * The schema default for `priority` is `normal`, so omitted priorities
 * land in the middle bucket. Returns a fresh array — input is not mutated.
 */
export function sortRulesByPriority(
  rules: readonly FollowUpRule[],
): FollowUpRule[] {
  return rules
    .map((rule, index) => ({ rule, index }))
    .sort((a, b) => {
      const pa = PRIORITY_ORDER[a.rule.priority];
      const pb = PRIORITY_ORDER[b.rule.priority];
      if (pa !== pb) return pa - pb;
      return a.index - b.index;
    })
    .map((entry) => entry.rule);
}

// ---------------------------------------------------------------------------
// Condition evaluation
// ---------------------------------------------------------------------------

/**
 * Result of evaluating a rule's `when` block against the classifier output.
 *
 * `matched` indicates whether every present condition was satisfied;
 * `matchedAttributes` records the subset of classifier attributes the
 * conditions actually inspected (for downstream `Evidence`).
 */
export type ConditionEvalResult = {
  matched: boolean;
  matchedAttributes: Record<string, unknown>;
};

/**
 * Case-insensitive set membership against the classifier's possibly-null
 * string attribute. Used for `topic_in`, `location_in`,
 * `product_or_service_in`. Mirrors the lowercase enum values the classifier
 * already emits for the enum-backed attributes.
 *
 * `topic_in` semantics for V1: EXACT case-insensitive match against the
 * classifier's `attributes.topic`. Substring matching was considered but
 * rejected — too easy to over-match (e.g. "shipping" inside "shipping
 * insurance disputes" when the rule only meant the operational topic).
 * Documented here so a future widening doesn't surprise consumers.
 */
function includesCi(
  list: readonly string[],
  value: string | null | undefined,
): boolean {
  if (value == null) return false;
  const lower = value.toLowerCase();
  return list.some((item) => item.toLowerCase() === lower);
}

/**
 * Evaluate a rule's `when` block. All present fields must match (AND).
 * Missing fields = no constraint.
 *
 * `qualifyingPersona.persona` (from CON-94) is treated as an OR-companion
 * to the classifier's `attributes.persona` for the `persona_in` check —
 * if the qualifying answer is in the list, the condition matches even if
 * the classifier said `unknown`.
 *
 * Returns the matched-attribute snapshot regardless of `matched`; an
 * unmatched rule simply discards it.
 */
export function evaluateConditions(
  when: RuleCondition,
  classifierOutput: ClassifierOutput,
  context: ConversationContext,
): ConditionEvalResult {
  const attrs = classifierOutput.attributes;
  const matched: Record<string, unknown> = {};

  // persona_in — classifier persona OR qualifying persona (CON-94)
  if (when.persona_in !== undefined) {
    const classifierMatch = when.persona_in.includes(attrs.persona);
    const qualifyingPersona = context.qualifyingPersona?.persona;
    const qualifyingMatch =
      qualifyingPersona !== undefined &&
      when.persona_in.includes(qualifyingPersona);
    if (!classifierMatch && !qualifyingMatch) {
      return { matched: false, matchedAttributes: {} };
    }
    matched.persona = classifierMatch ? attrs.persona : qualifyingPersona;
  }

  // intent_in
  if (when.intent_in !== undefined) {
    if (!when.intent_in.includes(attrs.intent)) {
      return { matched: false, matchedAttributes: {} };
    }
    matched.intent = attrs.intent;
  }

  // topic_in — case-insensitive exact match
  if (when.topic_in !== undefined) {
    if (!includesCi(when.topic_in, attrs.topic)) {
      return { matched: false, matchedAttributes: {} };
    }
    matched.topic = attrs.topic;
  }

  // exclude_topics — must NOT be in the list (case-insensitive exact)
  if (when.exclude_topics !== undefined) {
    if (includesCi(when.exclude_topics, attrs.topic)) {
      return { matched: false, matchedAttributes: {} };
    }
    matched.topic = attrs.topic;
  }

  // sentiment_in
  if (when.sentiment_in !== undefined) {
    if (!when.sentiment_in.includes(attrs.sentiment)) {
      return { matched: false, matchedAttributes: {} };
    }
    matched.sentiment = attrs.sentiment;
  }

  // urgency_in
  if (when.urgency_in !== undefined) {
    if (!when.urgency_in.includes(attrs.urgency)) {
      return { matched: false, matchedAttributes: {} };
    }
    matched.urgency = attrs.urgency;
  }

  // marketplace_side_in
  if (when.marketplace_side_in !== undefined) {
    if (!when.marketplace_side_in.includes(attrs.marketplace_side)) {
      return { matched: false, matchedAttributes: {} };
    }
    matched.marketplace_side = attrs.marketplace_side;
  }

  // page_url_pattern — regex against context.pageUrl
  if (when.page_url_pattern !== undefined) {
    const url = context.pageUrl;
    if (!url) {
      return { matched: false, matchedAttributes: {} };
    }
    let re: RegExp;
    try {
      re = new RegExp(when.page_url_pattern);
    } catch {
      // Malformed regex in tenant config → treat as no match. Schema-time
      // validation will be tightened up in a follow-up; for V1 we degrade
      // gracefully rather than throw inside a hot path.
      return { matched: false, matchedAttributes: {} };
    }
    if (!re.test(url)) {
      return { matched: false, matchedAttributes: {} };
    }
    matched.page_url = url;
  }

  // repeated_loop_count_gte
  if (when.repeated_loop_count_gte !== undefined) {
    if (classifierOutput.repeated_loop_count < when.repeated_loop_count_gte) {
      return { matched: false, matchedAttributes: {} };
    }
    matched.repeated_loop_count = classifierOutput.repeated_loop_count;
  }

  // unanswered_confidence_lte
  if (when.unanswered_confidence_lte !== undefined) {
    if (
      classifierOutput.unanswered_confidence > when.unanswered_confidence_lte
    ) {
      return { matched: false, matchedAttributes: {} };
    }
    matched.unanswered_confidence = classifierOutput.unanswered_confidence;
  }

  // direct_human_request — boolean equality
  if (when.direct_human_request !== undefined) {
    if (classifierOutput.direct_human_request !== when.direct_human_request) {
      return { matched: false, matchedAttributes: {} };
    }
    matched.direct_human_request = classifierOutput.direct_human_request;
  }

  // location_in — case-insensitive exact (string|null)
  if (when.location_in !== undefined) {
    if (!includesCi(when.location_in, attrs.location)) {
      return { matched: false, matchedAttributes: {} };
    }
    matched.location = attrs.location;
  }

  // product_or_service_in — case-insensitive exact (string|null)
  if (when.product_or_service_in !== undefined) {
    if (!includesCi(when.product_or_service_in, attrs.product_or_service)) {
      return { matched: false, matchedAttributes: {} };
    }
    matched.product_or_service = attrs.product_or_service;
  }

  return { matched: true, matchedAttributes: matched };
}

// ---------------------------------------------------------------------------
// Rule confidence
// ---------------------------------------------------------------------------

/**
 * Compute the confidence that the resolver compares against a rule's
 * `confidence_threshold`.
 *
 * Default: `commercial_intent.confidence` for `lead` rules,
 * `support_need.confidence` for `cx_support` rules.
 *
 * Override: when the rule's `when.direct_human_request === true` AND the
 * classifier reports `direct_human_request === true`, the rule's confidence
 * becomes 1.0. This is what justifies the high (≈0.90) threshold both
 * seed configs use on `direct_human_request_cx` — the threshold only fires
 * when the classifier is certain about the explicit human-request signal,
 * not when commercial intent or support need happens to look strong.
 */
export function computeRuleConfidence(
  rule: FollowUpRule,
  classifierOutput: ClassifierOutput,
): number {
  if (
    rule.when.direct_human_request === true &&
    classifierOutput.direct_human_request === true
  ) {
    return 1.0;
  }
  return rule.case_type === "lead"
    ? classifierOutput.commercial_intent.confidence
    : classifierOutput.support_need.confidence;
}

// ---------------------------------------------------------------------------
// Action builder
// ---------------------------------------------------------------------------

function buildResolvedAction(
  rule: FollowUpRule,
  confidence: number,
  evidence: Evidence,
): ResolvedAction {
  switch (rule.action) {
    case "continue_helping":
      return { type: "continue_helping" };
    case "clarify_then_recheck":
      return { type: "clarify_then_recheck" };
    case "offer_follow_up":
      // Schema guarantees `capture_policy_id` is set for this action.
      return {
        type: "offer_follow_up",
        capture_policy_id: rule.capture_policy_id as string,
        rule_id: rule.id,
        routing_key: rule.routing_key,
        case_type: rule.case_type,
        confidence,
        evidence,
        // CON-169 (Epic D1): pass through optional visitor-facing title so
        // the widget can render the rule-configured prompt.
        ...(rule.offer_title !== undefined
          ? { offer_title: rule.offer_title }
          : {}),
      };
    case "refer_to_approved_contact_method":
      // Schema guarantees `contact_method_id` is set for this action.
      return {
        type: "refer_to_approved_contact_method",
        contact_method_id: rule.contact_method_id as string,
        rule_id: rule.id,
        routing_key: rule.routing_key,
        case_type: rule.case_type,
        confidence,
        evidence,
      };
    case "capture_details_then_flag":
      return {
        type: "capture_details_then_flag",
        capture_policy_id: rule.capture_policy_id as string,
        rule_id: rule.id,
        routing_key: rule.routing_key,
        case_type: rule.case_type,
        confidence,
        evidence,
      };
    case "flag_for_staff_review_without_interrupting_visitor":
      return {
        type: "flag_for_staff_review_without_interrupting_visitor",
        rule_id: rule.id,
        routing_key: rule.routing_key,
        case_type: rule.case_type,
        confidence,
        evidence,
      };
    case "immediate_escalation":
      // Both `capture_policy_id` and `contact_method_id` are optional for
      // this action per the schema; propagate whichever the tenant set.
      return {
        type: "immediate_escalation",
        capture_policy_id: rule.capture_policy_id,
        contact_method_id: rule.contact_method_id,
        rule_id: rule.id,
        routing_key: rule.routing_key,
        case_type: rule.case_type,
        confidence,
        evidence,
      };
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export type ResolveActionInput = {
  classifierOutput: ClassifierOutput;
  followUpConfig: FollowUp;
  conversationContext: ConversationContext;
};

/**
 * Deterministically resolve the action the lifecycle should take for a
 * given (classifier output, follow-up config, conversation context) triple.
 *
 * Algorithm (PRD §8–§9, CON-166 spec):
 *
 *   1. Short-circuit on disabled config → `continue_helping`.
 *   2. Read `default_sensitivity` and pre-compute the multiplier.
 *   3. Filter out disabled rules.
 *   4. Sort remaining rules: priority (high → normal → low), then array
 *      order within the same priority.
 *   5. For each rule, evaluate `when` conditions (AND of present fields),
 *      compute rule confidence, compare against the sensitivity-adjusted
 *      threshold. First passing rule wins; build and return its
 *      `ResolvedAction`.
 *   6. No rule passes → `continue_helping`.
 *
 * Pure function. No mutations, no I/O. Same input → same output.
 */
export function resolveAction(input: ResolveActionInput): ResolvedAction {
  const { classifierOutput, followUpConfig, conversationContext } = input;

  // 1. Disabled config → noop.
  if (followUpConfig.enabled === false) {
    return { type: "continue_helping" };
  }

  const sensitivity: Sensitivity = followUpConfig.default_sensitivity;

  // 3. Filter disabled rules.
  const enabledRules = followUpConfig.rules.filter(
    (rule) => rule.enabled !== false,
  );

  // 4. Sort by priority then array order.
  const orderedRules = sortRulesByPriority(enabledRules);

  // 5. First matching rule wins.
  for (const rule of orderedRules) {
    const conditionResult = evaluateConditions(
      rule.when,
      classifierOutput,
      conversationContext,
    );
    if (!conditionResult.matched) {
      continue;
    }

    const confidence = computeRuleConfidence(rule, classifierOutput);
    const adjustedThreshold = applySensitivity(
      rule.confidence_threshold,
      sensitivity,
    );
    if (confidence < adjustedThreshold) {
      continue;
    }

    const evidence: Evidence = {
      matched_attributes: conditionResult.matchedAttributes,
      rule_conditions: rule.when,
      classifier_version: classifierOutput.classifier_version,
      classifier_confidence: {
        support_need: classifierOutput.support_need.confidence,
        commercial_intent: classifierOutput.commercial_intent.confidence,
      },
      sensitivity,
    };

    return buildResolvedAction(rule, confidence, evidence);
  }

  // 6. No rule matched → default.
  return { type: "continue_helping" };
}

// Re-export the public types so consumers can import from one module.
export type {
  ConversationContext,
  Evidence,
  ResolvedAction,
} from "./resolver-types";
