/**
 * Lead Capture — keyword-based intent detection (CON-95 / C-06)
 *
 * Deterministic intent classification using small, conservative keyword
 * lists. Each category is matched independently; a single message can
 * trigger multiple categories (which is useful signal for the summariser).
 *
 * Tenants can override or extend each category via
 * `forum.config.json::lead_capture.detection.{pricing,booking,project}Keywords`.
 *
 * No LLM. No network. No allocations beyond the lowercased input.
 */

import type { LeadIntentCategory } from "./types";

/** Default keyword bank — kept tight on purpose. */
export const DEFAULT_KEYWORDS: Record<LeadIntentCategory, string[]> = {
  pricing: [
    "price",
    "pricing",
    "how much",
    "cost",
    "costs",
    "quote",
    "quotation",
    "rates",
    "rate card",
    "fees",
    "fee",
    "estimate",
    "budget",
    "afford",
  ],
  booking: [
    "book",
    "booking",
    "appointment",
    "schedule",
    "available",
    "availability",
    "consultation",
    "demo",
    "trial",
    "sign up",
    "signup",
    "get started",
  ],
  project: [
    "project",
    "engage",
    "engagement",
    "hire you",
    "work with",
    "working with",
    "proposal",
    "scope",
    "timeline",
  ],
  contact_request: [
    "call me",
    "contact me",
    "get in touch",
    "reach out",
    "email me",
    "ring me",
    "speak to someone",
    "talk to someone",
    "human",
    "callback",
    "call back",
  ],
};

export interface IntentScore {
  /** Categories matched in this message. */
  matched: LeadIntentCategory[];
  /** Total number of distinct keyword hits across all categories. */
  hits: number;
}

export type KeywordOverrides = Partial<Record<LeadIntentCategory, string[] | undefined>>;

/**
 * Score a single user message for commercial intent.
 *
 * @param message User message.
 * @param overrides Per-tenant keyword overrides. `null`/`undefined` per
 *                  category falls back to the default bank.
 */
export function scoreIntent(
  message: string,
  overrides?: KeywordOverrides
): IntentScore {
  if (!message || typeof message !== "string") {
    return { matched: [], hits: 0 };
  }
  const lower = ` ${message.toLowerCase()} `;
  const matched: LeadIntentCategory[] = [];
  let hits = 0;

  const categories: LeadIntentCategory[] = [
    "pricing",
    "booking",
    "project",
    "contact_request",
  ];

  for (const cat of categories) {
    const list = overrides?.[cat] ?? DEFAULT_KEYWORDS[cat];
    let categoryHit = false;
    for (const kw of list) {
      if (!kw) continue;
      // Word-boundary-ish: surround keyword with non-letter context.
      const needle = ` ${kw.toLowerCase()} `;
      if (lower.includes(needle)) {
        categoryHit = true;
        hits += 1;
      } else if (
        lower.includes(kw.toLowerCase() + " ") ||
        lower.includes(" " + kw.toLowerCase()) ||
        lower.includes(kw.toLowerCase() + "?") ||
        lower.includes(kw.toLowerCase() + ".") ||
        lower.includes(kw.toLowerCase() + ",")
      ) {
        // Fallback: keyword at message edge or followed by punctuation.
        categoryHit = true;
        hits += 1;
      }
    }
    if (categoryHit) matched.push(cat);
  }

  return { matched, hits };
}

/**
 * Convenience: does this message cross the intent threshold (≥ 1 category)?
 */
export function hasCommercialIntent(
  message: string,
  overrides?: KeywordOverrides
): boolean {
  return scoreIntent(message, overrides).matched.length > 0;
}
