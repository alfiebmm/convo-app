/**
 * Classifier output schema (CON-165, Epic C1).
 *
 * Structured JSON shape the LLM secondary-pass classifier produces for every
 * conversation snapshot. Mirrors PRD §14 and lines up with `ruleConditionSchema`
 * in `src/lib/forum-config/schema.ts` so the C2 (CON-166) deterministic rule
 * evaluator can consume this directly.
 *
 * Stability:
 *   - `classifier_version` is stamped on every output; bump on any vocabulary
 *     or shape change so downstream consumers can branch safely.
 *   - The enums below MUST match the values listed in PRD §14 and the
 *     `ruleConditionSchema` `*_in` arrays. Extending an enum requires a
 *     matching schema change on the rule evaluator side.
 */

import { z } from "zod";

export const CLASSIFIER_VERSION = "v1" as const;

// ---- Attribute enums ----------------------------------------------------

// Vertical-neutral persona enum. The Convo classifier ships across many
// tenant types (ag, pet, professional services, retail, etc.), so the
// persona vocabulary must describe the *relationship* to the tenant
// rather than a vertical-specific role.
//   - customer: wants to buy / use the tenant's product or service
//   - partner:  wants to collaborate or co-sell with the tenant
//   - supplier: offers goods or services TO the tenant
//   - browser:  just looking, not yet on a path
//   - unknown:  insufficient signal
export const classifierPersonaEnum = z.enum([
  "customer",
  "partner",
  "supplier",
  "browser",
  "unknown",
]);

// Vertical-neutral intent enum. Broad verbs that work for plumbers,
// accountants, gyms, vets, breeders, contractors, etc. Same semantic
// coverage as the original ag/pet-specific set.
export const classifierIntentEnum = z.enum([
  "enquire",
  "request_quote",
  "check_availability",
  "compare_options",
  "request_support",
  "become_partner",
  "offer_service",
  "site_navigation",
  "general_research",
  "unknown",
]);

export const classifierSentimentEnum = z.enum([
  "positive",
  "neutral",
  "negative",
  "frustrated",
  "angry",
]);

export const classifierUrgencyEnum = z.enum(["low", "normal", "high"]);

export const classifierMarketplaceSideEnum = z.enum([
  "demand",
  "supply",
  "unknown",
]);

export const classifierSpamRiskEnum = z.enum(["low", "medium", "high"]);

// ---- Attributes block ---------------------------------------------------

export const classifierAttributesSchema = z.object({
  persona: classifierPersonaEnum,
  intent: classifierIntentEnum,
  topic: z.string().min(1).max(120),
  sentiment: classifierSentimentEnum,
  urgency: classifierUrgencyEnum,
  marketplace_side: classifierMarketplaceSideEnum,
  location: z.string().min(1).max(120).nullable(),
  product_or_service: z.string().min(1).max(160).nullable(),
  spam_risk: classifierSpamRiskEnum,
});

// ---- Detector sub-blocks ------------------------------------------------

const confidence = z.number().min(0).max(1);

export const classifierDetectionSchema = z.object({
  detected: z.boolean(),
  confidence,
  reason: z.string().min(1).max(240).nullable(),
});

// ---- Root output --------------------------------------------------------

export const classifierOutputSchema = z.object({
  classifier_version: z.literal(CLASSIFIER_VERSION),
  attributes: classifierAttributesSchema,
  support_need: classifierDetectionSchema,
  commercial_intent: classifierDetectionSchema,
  missing_fields: z.array(z.string().min(1).max(40)).default([]),
  direct_human_request: z.boolean(),
  repeated_loop_count: z.number().int().nonnegative(),
  unanswered_confidence: confidence,
});

export type ClassifierAttributes = z.infer<typeof classifierAttributesSchema>;
export type ClassifierDetection = z.infer<typeof classifierDetectionSchema>;
export type ClassifierOutput = z.infer<typeof classifierOutputSchema>;

// ---- Safe default -------------------------------------------------------

/**
 * Returned by `classifyConversation()` when the LLM call, JSON parse, or
 * schema validation fails. Calibrated to be inert: every confidence is 0,
 * every enum is `unknown`/`low`/`neutral`. The downstream rule evaluator
 * (C2) will match nothing → no action → graceful degradation.
 */
export function safeDefaultClassifierOutput(): ClassifierOutput {
  return {
    classifier_version: CLASSIFIER_VERSION,
    attributes: {
      persona: "unknown",
      intent: "unknown",
      topic: "unknown",
      sentiment: "neutral",
      urgency: "low",
      marketplace_side: "unknown",
      location: null,
      product_or_service: null,
      spam_risk: "low",
    },
    support_need: { detected: false, confidence: 0, reason: null },
    commercial_intent: { detected: false, confidence: 0, reason: null },
    missing_fields: [],
    direct_human_request: false,
    repeated_loop_count: 0,
    unanswered_confidence: 0,
  };
}
