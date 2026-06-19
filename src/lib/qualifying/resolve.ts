/**
 * Qualifying Questions — resolver (CON-94 / C-05)
 *
 * Pure functions that decide:
 *   1. What questions a tenant has configured (preset + up to 4 additional)
 *   2. Given current conversation state, what to ask next (if anything)
 *
 * Source of truth: `tenants.settings.forumConfig.qualifying_questions`
 * (extends the existing `forum.config.json` schema established by K-01 /
 * wired into tenants.settings by CON-93).
 *
 * Trust model (mirrors CON-93 CTA): question text + option labels + persona
 * field names are ALL config-sourced. The model never sees the option strings
 * before the user picks one. The model only ever receives the *resolved
 * persona* (the field→value map), not the menu.
 */

import { parseForumConfigPerSlice } from "@/lib/forum-config/validate";
import type { QualifyingQuestion } from "@/lib/forum-config/schema";
import type {
  ConversationQualifying,
} from "./types";

/**
 * Wire-safe view of a single qualifying question — what the widget renders.
 * Mirrors `QualifyingQuestion` from the schema but typed independently so we
 * don't accidentally leak server-only fields if the schema grows.
 */
export interface QualifyingPrompt {
  field: string;
  question: string;
  options: Array<{ label: string; value: string }>;
}

/**
 * Read the ordered list of configured questions for a tenant.
 * Preset comes first, then `additional` in declared order.
 */
export function getConfiguredQuestions(
  settings: Record<string, unknown> | null | undefined
): QualifyingPrompt[] {
  const forumConfigRaw =
    (settings && (settings as Record<string, unknown>).forumConfig) ?? null;

  // CON-201: per-slice parse so a tenant with ONLY qualifying_questions in
  // their forumConfig (no ai_persona, no seo_defaults) still surfaces their
  // configured questions instead of silently falling through to the generic
  // "I have a question / I need advice / ..." defaults that leaked to the
  // AgPages widget in production.
  const cfg = parseForumConfigPerSlice(forumConfigRaw);
  const qq = cfg.qualifying_questions;

  const ordered: QualifyingQuestion[] = [];
  if (qq.preset) ordered.push(qq.preset);
  for (const q of qq.additional ?? []) ordered.push(q);

  return ordered.map((q) => ({
    field: q.persona_field,
    question: q.question,
    options: q.options.map((o) => ({ label: o.label, value: o.value })),
  }));
}

/**
 * Decide the next question to ask, given configured questions and the
 * conversation's current qualifying state.
 *
 * Returns null when:
 *   - there are no configured questions, OR
 *   - every configured question has an answer, OR
 *   - the flow was explicitly skipped.
 *
 * A configured question is considered "answered" iff the conversation
 * already has an answer with the matching `persona_field`. We don't allow
 * re-asking; once a visitor picks an option for a field, that's final
 * for the life of the conversation.
 */
export function getNextQuestion(
  configured: QualifyingPrompt[],
  state: ConversationQualifying | null
): QualifyingPrompt | null {
  if (state?.skipped) return null;
  if (configured.length === 0) return null;

  const answered = new Set(
    (state?.answers ?? []).map((a) => a.field)
  );

  for (const q of configured) {
    if (!answered.has(q.field)) return q;
  }
  return null;
}

/**
 * Convenience: true when the flow has been answered or skipped to completion.
 */
export function isQualifyingComplete(
  configured: QualifyingPrompt[],
  state: ConversationQualifying | null
): boolean {
  if (state?.skipped) return true;
  if (configured.length === 0) return true;
  return getNextQuestion(configured, state) === null;
}

/**
 * Format the persona map for inclusion in the system prompt.
 * Returns an empty string when there are no answers — caller can append
 * unconditionally without a "no context" stub leaking into the prompt.
 */
export function formatPersonaForPrompt(
  state: ConversationQualifying | null
): string {
  if (!state) return "";
  const entries = Object.entries(state.persona).filter(
    ([, v]) => typeof v === "string" && v.trim()
  );
  if (entries.length === 0) return "";

  const lines = entries.map(([k, v]) => `- ${k}: ${v}`);
  return [
    "# Visitor Context",
    "The visitor has answered these qualifying questions. Use this to personalise tone, depth, and recommendations. Do NOT re-ask.",
    ...lines,
  ].join("\n");
}
