/**
 * Qualifying Questions — shared types (CON-94 / C-05)
 *
 * The shape of qualifying-question state persisted on `conversations.metadata.qualifying`.
 * Locked here so CON-95 (Lead Capture) and any future downstream features can consume
 * a stable contract.
 *
 * Storage contract:
 *
 *   conversations.metadata = {
 *     ...existing fields,
 *     qualifying?: {
 *       answers: QualifyingAnswer[];      // append-only audit trail
 *       persona: Record<string, string>;  // flat { field: value } map for fast lookup
 *       completedAt?: string;             // ISO timestamp when the last question answered
 *       skipped?: boolean;                // visitor dismissed the flow
 *     }
 *   }
 *
 * "Persona" is the union of all `persona_field` → answer mappings. The model is told
 * the persona via a structured prompt section; the widget never lets the model
 * generate qualifying questions.
 */

export interface QualifyingAnswer {
  /** The `persona_field` from forum.config.json (e.g. "visitor_intent"). */
  field: string;
  /** The selected option value. Free-text not supported (button-only flow). */
  value: string;
  /** Snapshot of the question text, for audit and UI rehydration. */
  question: string;
  /** ISO timestamp. */
  answeredAt: string;
}

export interface ConversationQualifying {
  answers: QualifyingAnswer[];
  persona: Record<string, string>;
  completedAt?: string;
  skipped?: boolean;
}

/**
 * Type guard for safely reading `metadata.qualifying` from a jsonb blob.
 */
export function isConversationQualifying(
  value: unknown
): value is ConversationQualifying {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.answers) &&
    typeof v.persona === "object" &&
    v.persona !== null
  );
}

/**
 * Read `qualifying` from a conversation's metadata blob, with safe fallbacks.
 */
export function readQualifying(
  metadata: Record<string, unknown> | null | undefined
): ConversationQualifying | null {
  if (!metadata) return null;
  const q = (metadata as Record<string, unknown>).qualifying;
  return isConversationQualifying(q) ? q : null;
}
