/**
 * Lead Capture — detection orchestrator (CON-95 / C-06)
 *
 * The single entry point called from `/api/chat` on every inbound user
 * message. Returns the decision (captured? updated? unchanged?) without
 * blocking the SSE response.
 *
 * Flow:
 *   1. Extract explicit contact (email/phone/name) — regex-only.
 *   2. Score commercial intent — keyword-only.
 *   3. Decide whether to capture:
 *        a) Any explicit contact found → CAPTURE (voluntary_contact wins).
 *        b) Intent threshold crossed → CAPTURE (intent_keyword).
 *        c) Else → NO-OP.
 *   4. Merge with any existing `metadata.lead` (idempotent: never
 *      overwrites non-null contact fields, appends detection signals).
 *   5. Write back to `conversations` row: `metadata.lead`,
 *      `needs_followup = true`, `follow_up_type = 'lead'`.
 *
 * Notifications and AI summary are fired by the caller AFTER the SSE
 * stream completes so the chat never waits on them.
 */

import { db } from "../db";
import { conversations } from "../db/schema";
import { eq } from "drizzle-orm";
import { extractExplicitContact } from "./extract";
import { scoreIntent, type KeywordOverrides } from "./intent";
import type {
  ConversationLead,
  LeadContact,
  LeadDetectionSource,
  LeadIntentCategory,
} from "./types";
import { readLead } from "./types";

export interface CaptureInput {
  conversationId: string;
  message: string;
  /** Per-tenant keyword overrides from `forum.config.json::lead_capture`. */
  keywordOverrides?: KeywordOverrides;
  /** Whether lead capture is enabled for this tenant. Defaults to true. */
  enabled?: boolean;
}

export type CaptureOutcome =
  | { kind: "disabled" }
  | { kind: "no_signal" }
  | {
      kind: "captured" | "updated";
      lead: ConversationLead;
      newDetections: LeadDetectionSource[];
      newIntents: LeadIntentCategory[];
    };

/**
 * Determine which detection sources fired for this message.
 * Pure function — easy to unit-test.
 */
export function classifyMessage(
  message: string,
  overrides?: KeywordOverrides
): {
  detections: LeadDetectionSource[];
  intents: LeadIntentCategory[];
  contact: LeadContact;
} {
  const explicit = extractExplicitContact(message);
  const intent = scoreIntent(message, overrides);

  const detections: LeadDetectionSource[] = [];
  if (explicit.email) detections.push("explicit_email");
  if (explicit.phone) detections.push("explicit_phone");
  // Voluntary contact = email OR phone supplied. Tracked separately so a
  // visitor who just drops their email (no intent words) is still captured.
  if (explicit.email || explicit.phone) {
    detections.push("voluntary_contact");
  }
  if (intent.matched.length > 0) detections.push("intent_keyword");

  return {
    detections,
    intents: intent.matched,
    contact: {
      name: explicit.name,
      email: explicit.email,
      phone: explicit.phone,
    },
  };
}

/**
 * Merge a fresh detection result into an existing lead. Idempotent.
 * Returns the merged lead + which detection / intent values are new.
 */
export function mergeLead(
  existing: ConversationLead | null,
  fresh: {
    detections: LeadDetectionSource[];
    intents: LeadIntentCategory[];
    contact: LeadContact;
  },
  nowIso: string
): {
  merged: ConversationLead;
  newDetections: LeadDetectionSource[];
  newIntents: LeadIntentCategory[];
} {
  const base: ConversationLead = existing ?? {
    capturedAt: nowIso,
    status: "open",
    detection: [],
    intentSignals: [],
    contact: { name: null, email: null, phone: null },
    summary: null,
  };

  const newDetections = fresh.detections.filter(
    (d) => !base.detection.includes(d)
  );
  const newIntents = fresh.intents.filter(
    (i) => !base.intentSignals.includes(i)
  );

  // Never overwrite a known PII field with null. First win for each slot.
  const mergedContact: LeadContact = {
    name: base.contact.name ?? fresh.contact.name,
    email: base.contact.email ?? fresh.contact.email,
    phone: base.contact.phone ?? fresh.contact.phone,
  };

  const merged: ConversationLead = {
    capturedAt: base.capturedAt,
    status: base.status,
    detection: [...base.detection, ...newDetections],
    intentSignals: [...base.intentSignals, ...newIntents],
    contact: mergedContact,
    summary: base.summary,
  };

  return { merged, newDetections, newIntents };
}

/**
 * Run the full detection + persist flow. Returns the outcome so the caller
 * can decide whether to notify / summarise.
 */
export async function maybeCaptureLead(
  input: CaptureInput
): Promise<CaptureOutcome> {
  if (input.enabled === false) return { kind: "disabled" };

  const classification = classifyMessage(input.message, input.keywordOverrides);
  if (classification.detections.length === 0) {
    return { kind: "no_signal" };
  }

  // Fetch the conversation to read existing metadata + decide insert vs
  // update. Single round-trip; the followups index covers tenant scoping.
  const [row] = await db
    .select({ id: conversations.id, metadata: conversations.metadata })
    .from(conversations)
    .where(eq(conversations.id, input.conversationId))
    .limit(1);

  if (!row) return { kind: "no_signal" };

  const metadata = (row.metadata as Record<string, unknown> | null) ?? {};
  const existing = readLead(metadata);
  const nowIso = new Date().toISOString();
  const { merged, newDetections, newIntents } = mergeLead(
    existing,
    classification,
    nowIso
  );

  // If there's nothing new and a lead already exists, short-circuit.
  // (Prevents a chatty visitor from repeatedly re-notifying admins.)
  if (existing && newDetections.length === 0 && newIntents.length === 0) {
    // Still ensure follow-up flags are set in case a prior write missed them.
    return {
      kind: "updated",
      lead: merged,
      newDetections: [],
      newIntents: [],
    };
  }

  // Write back: patch metadata.lead, raise follow-up flags.
  const nextMetadata = { ...metadata, lead: merged };
  await db
    .update(conversations)
    .set({
      metadata: nextMetadata,
      needsFollowup: true,
      followUpType: "lead",
    })
    .where(eq(conversations.id, input.conversationId));

  return {
    kind: existing ? "updated" : "captured",
    lead: merged,
    newDetections,
    newIntents,
  };
}

/**
 * Patch a lead's summary in-place. Used by the post-stream summariser.
 * Idempotent: only writes if the conversation still has a lead block.
 */
export async function setLeadSummary(
  conversationId: string,
  summary: string
): Promise<void> {
  const [row] = await db
    .select({ id: conversations.id, metadata: conversations.metadata })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!row) return;

  const metadata = (row.metadata as Record<string, unknown> | null) ?? {};
  const existing = readLead(metadata);
  if (!existing) return;

  const next: ConversationLead = { ...existing, summary };
  const nextMetadata = { ...metadata, lead: next };

  await db
    .update(conversations)
    .set({ metadata: nextMetadata })
    .where(eq(conversations.id, conversationId));
}
