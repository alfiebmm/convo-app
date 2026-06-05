/**
 * Lead Capture — shared types (CON-95 / C-06)
 *
 * Stable contract for the `lead` block on `conversations.metadata`.
 * Mirrors the CON-94 `metadata.qualifying` pattern: keep PII bundled in
 * jsonb rather than spread across flat columns.
 *
 * Storage:
 *
 *   conversations.metadata = {
 *     ...existing,
 *     lead?: ConversationLead
 *   }
 *
 *   conversations.followUpType = 'lead' (when a lead is captured)
 *   conversations.needsFollowup = true   (when a lead is captured)
 */

export type LeadStatus = "open" | "contacted" | "closed";

export type LeadDetectionSource =
  | "explicit_email"
  | "explicit_phone"
  | "intent_keyword"
  | "voluntary_contact";

/** Categories of commercial intent that the keyword scorer recognises. */
export type LeadIntentCategory =
  | "pricing"
  | "booking"
  | "project"
  | "contact_request";

export interface LeadContact {
  name: string | null;
  email: string | null;
  phone: string | null;
}

export interface ConversationLead {
  /** ISO timestamp of first capture. */
  capturedAt: string;
  /** Lifecycle status. Admin/dashboard mutates this in future. */
  status: LeadStatus;
  /** Append-only trail of detection sources. */
  detection: LeadDetectionSource[];
  /** Intent categories matched at least once across the conversation. */
  intentSignals: LeadIntentCategory[];
  /** Captured PII. Always present; fields filled in as they appear. */
  contact: LeadContact;
  /** Short AI-generated summary, written async after capture. */
  summary: string | null;
}

/** Type guard for safely reading `metadata.lead` from a jsonb blob. */
export function isConversationLead(value: unknown): value is ConversationLead {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.capturedAt === "string" &&
    typeof v.status === "string" &&
    Array.isArray(v.detection) &&
    Array.isArray(v.intentSignals) &&
    typeof v.contact === "object" &&
    v.contact !== null
  );
}

/** Read `lead` from a conversation's metadata blob, with safe fallbacks. */
export function readLead(
  metadata: Record<string, unknown> | null | undefined
): ConversationLead | null {
  if (!metadata) return null;
  const l = (metadata as Record<string, unknown>).lead;
  return isConversationLead(l) ? l : null;
}
