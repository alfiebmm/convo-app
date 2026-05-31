/**
 * Follow-up resolver types (CON-166, Epic C2).
 *
 * The deterministic rule evaluator (`resolveAction`) returns a
 * `ResolvedAction` — a discriminated union that maps 1:1 to the
 * `actionModeEnum` in `src/lib/forum-config/schema.ts` (CON-157).
 *
 * `ResolvedAction` is consumed by CON-167 (Epic C3 — re-eval lifecycle),
 * which hooks the resolver into `/api/chat`. Downstream surfaces
 * (`offer_follow_up`, `capture_details_then_flag`, …) use the embedded
 * `capture_policy_id` / `contact_method_id` to look up the relevant
 * policy/contact in the same `FollowUp` config that produced this match.
 *
 * Type alignment with the schema:
 *   - `case_type`, `Sensitivity`, and `RuleCondition` are re-exported from
 *     the schema layer (no parallel duplicate enums).
 *   - Each non-default variant carries the matched rule's `rule_id`,
 *     `routing_key`, `case_type`, `confidence`, and an `Evidence` block
 *     for downstream auditing.
 */

import type {
  CaseType,
  RuleCondition,
  Sensitivity,
} from "@/lib/forum-config/schema";

/**
 * Audit payload attached to every non-default `ResolvedAction`.
 *
 * `matched_attributes` records only the classifier attributes that the rule's
 * `when` block actually consulted (a subset of the full classifier output).
 * Downstream telemetry/storage can persist this verbatim for explainability
 * without recomputing the match.
 */
export type Evidence = {
  matched_attributes: Record<string, unknown>;
  rule_conditions: RuleCondition;
  classifier_version: string;
  classifier_confidence: {
    support_need: number;
    commercial_intent: number;
  };
  sensitivity: Sensitivity;
};

/**
 * Discriminated union of every action the resolver may emit.
 *
 * Discriminant: `type`. Maps 1:1 to `actionModeEnum` in the forum-config
 * schema. The two "do-nothing" variants (`continue_helping`,
 * `clarify_then_recheck`) intentionally omit rule/evidence — they're emitted
 * either when no rule matches or when the rule itself prescribed a no-op
 * outcome.
 */
export type ResolvedAction =
  | { type: "continue_helping" }
  | {
      type: "clarify_then_recheck";
      suggested_clarification?: string;
    }
  | {
      type: "offer_follow_up";
      capture_policy_id: string;
      rule_id: string;
      routing_key: string;
      case_type: CaseType;
      confidence: number;
      evidence: Evidence;
    }
  | {
      type: "refer_to_approved_contact_method";
      contact_method_id: string;
      rule_id: string;
      routing_key: string;
      case_type: CaseType;
      confidence: number;
      evidence: Evidence;
    }
  | {
      type: "capture_details_then_flag";
      capture_policy_id: string;
      rule_id: string;
      routing_key: string;
      case_type: CaseType;
      confidence: number;
      evidence: Evidence;
    }
  | {
      type: "flag_for_staff_review_without_interrupting_visitor";
      rule_id: string;
      routing_key: string;
      case_type: CaseType;
      confidence: number;
      evidence: Evidence;
    }
  | {
      type: "immediate_escalation";
      capture_policy_id?: string;
      contact_method_id?: string;
      rule_id: string;
      routing_key: string;
      case_type: CaseType;
      confidence: number;
      evidence: Evidence;
    };

/**
 * Conversation-side context the resolver needs that is not contained in the
 * classifier output. Treated as readonly.
 *
 * `qualifyingPersona` mirrors `conversations.metadata.qualifying` from
 * CON-94: a flat string→string map of answers to qualifying questions, e.g.
 * `{ persona: "breeder" }`. The resolver only reads the `persona` key for
 * the `persona_in` condition override; other keys are ignored at V1.
 */
export type ConversationContext = {
  tenantId: string;
  conversationId: string;
  pageUrl?: string;
  qualifyingPersona?: Record<string, string>;
};
