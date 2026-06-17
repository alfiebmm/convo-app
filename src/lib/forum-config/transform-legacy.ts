/**
 * Legacy → forumConfig transform (CON-192).
 *
 * Pure function. Maps the three pre-CON-191 settings surfaces
 *   - settings.widget.systemPrompt          (free-text persona prose)
 *   - settings.widget.allowedTopics         (comma-separated topic list)
 *   - settings.guardrails.audiences[].persona   (per-audience persona)
 *   - settings.guardrails.topicBoundaries.allow (structured topic list)
 *
 * into a partial forumConfig draft suitable as INITIAL form state for the
 * Chatbot Behaviour editor when a tenant has not yet engaged with
 * forumConfig at all.
 *
 * Rules
 *   - voice_description prefers `widget.systemPrompt` (legacy primary), then
 *     falls back to `guardrails.audiences[0].persona`.
 *   - allowed_topics = `guardrails.topicBoundaries.allow ∪ widget.allowedTopics`
 *     (deduped, order-preserving, structured-first).
 *   - tone defaults to "professional" — there is no legacy field that
 *     reliably encodes tone, so we pick the safest default.
 *   - locale defaults to "en-AU" (matches DEFAULT_FORUM_CONFIG).
 *   - banned_words and qualifying_questions / follow_up / cta_rules are
 *     left to the editor's normal defaults — there's no legacy source.
 *
 * This function is intentionally tolerant of unknown / malformed input —
 * legacy DB rows may have partial or mis-typed slices. Anything we can't
 * read returns an empty/default value rather than throwing.
 */

import type { AiPersona } from "./schema";

/** The legacy fields we care about, as they sit on `tenant.settings`. */
export interface LegacySettings {
  widget?: {
    systemPrompt?: unknown;
    allowedTopics?: unknown;
  };
  guardrails?: {
    audiences?: Array<{ persona?: unknown }>;
    topicBoundaries?: {
      allow?: unknown;
    };
  };
  persona?: unknown;
  systemPrompt?: unknown;
}

/** The partial forumConfig draft we produce. */
export interface ForumConfigDraft {
  ai_persona: AiPersona;
  allowed_topics: string[];
}

/** Detect at least one usable legacy signal worth pre-filling from. */
export function hasLegacySignal(settings: unknown): boolean {
  const draft = buildLegacyDraft(settings);
  return (
    draft.ai_persona.voice_description.length > 0 ||
    draft.allowed_topics.length > 0
  );
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .filter((s) => s.length > 0);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return [];
}

function pickLegacyVoice(settings: LegacySettings): string {
  // Prefer widget.systemPrompt (the legacy "primary" persona surface), then
  // first audience persona, then settings.persona/settings.systemPrompt
  // fall-throughs that buildSystemPrompt also honours.
  const widget = readString(settings.widget?.systemPrompt);
  if (widget) return widget;
  const audiences = Array.isArray(settings.guardrails?.audiences)
    ? settings.guardrails!.audiences!
    : [];
  for (const a of audiences) {
    const p = readString(a?.persona);
    if (p) return p;
  }
  const persona = readString(settings.persona);
  if (persona) return persona;
  const systemPrompt = readString(settings.systemPrompt);
  if (systemPrompt) return systemPrompt;
  return "";
}

function pickLegacyTopics(settings: LegacySettings): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  // Structured (guardrails.topicBoundaries.allow) takes order precedence —
  // it's the newer of the two legacy sources and tenants who have it
  // expect those topics to lead.
  for (const t of readStringArray(settings.guardrails?.topicBoundaries?.allow)) {
    const k = t.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(t);
    }
  }
  for (const t of readStringArray(settings.widget?.allowedTopics)) {
    const k = t.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(t);
    }
  }
  return out;
}

/**
 * Build a forumConfig draft from legacy settings. Always returns a
 * structurally valid draft — empty fields if no legacy signal is found.
 *
 * Does NOT mutate input. Safe to call with any unknown-shaped object.
 */
export function buildLegacyDraft(settings: unknown): ForumConfigDraft {
  const s = (settings && typeof settings === "object" ? settings : {}) as LegacySettings;
  return {
    ai_persona: {
      tone: "professional",
      locale: "en-AU",
      banned_words: [],
      voice_description: pickLegacyVoice(s),
    },
    allowed_topics: pickLegacyTopics(s),
  };
}

/**
 * True if a forumConfig slice value is "empty" for auto-copy purposes.
 *
 * The rule (per CON-192 Cam add-on): if ANY forumConfig slice is non-empty,
 * the tenant has engaged with the new editor and we must NOT clobber.
 */
export function isForumConfigEmpty(forumConfig: unknown): boolean {
  if (!forumConfig || typeof forumConfig !== "object") return true;
  const fc = forumConfig as Record<string, unknown>;

  const persona = fc.ai_persona as Record<string, unknown> | undefined;
  if (persona) {
    const voice = readString(persona.voice_description);
    if (voice) return false;
    const banned = Array.isArray(persona.banned_words) ? persona.banned_words : [];
    if (banned.length > 0) return false;
    // tone/locale are always defaulted — not a signal of engagement.
  }

  const topics = fc.allowed_topics;
  if (Array.isArray(topics) && topics.length > 0) return false;

  const qq = fc.qualifying_questions as Record<string, unknown> | undefined;
  if (qq) {
    if (qq.preset) return false;
    const additional = Array.isArray(qq.additional) ? qq.additional : [];
    if (additional.length > 0) return false;
  }

  const followUp = fc.follow_up;
  if (followUp && typeof followUp === "object" && Object.keys(followUp).length > 0) {
    return false;
  }

  return true;
}

/**
 * Merge a legacy draft into an existing forumConfig, only filling slices
 * that the tenant hasn't engaged with. Used by the "Migrate now" button
 * on legacy editors — safe to call repeatedly.
 *
 * The persona slice is replaced wholesale (voice_description is the key
 * field). allowed_topics is unioned with anything already present.
 */
export function mergeLegacyIntoForumConfig(
  existing: unknown,
  legacy: ForumConfigDraft,
): Record<string, unknown> {
  const base =
    existing && typeof existing === "object"
      ? { ...(existing as Record<string, unknown>) }
      : {};

  // Persona: replace only if voice_description is empty.
  const existingPersona = (base.ai_persona ?? {}) as Record<string, unknown>;
  const existingVoice = readString(existingPersona.voice_description);
  if (!existingVoice && legacy.ai_persona.voice_description) {
    base.ai_persona = {
      ...existingPersona,
      tone: existingPersona.tone ?? legacy.ai_persona.tone,
      locale: existingPersona.locale ?? legacy.ai_persona.locale,
      voice_description: legacy.ai_persona.voice_description,
      banned_words: Array.isArray(existingPersona.banned_words)
        ? existingPersona.banned_words
        : legacy.ai_persona.banned_words,
    };
  }

  // allowed_topics: union (existing first), deduped case-insensitively.
  const existingTopics = Array.isArray(base.allowed_topics)
    ? (base.allowed_topics as unknown[]).filter(
        (t): t is string => typeof t === "string" && t.trim().length > 0,
      )
    : [];
  if (legacy.allowed_topics.length > 0) {
    const seen = new Set(existingTopics.map((t) => t.toLowerCase()));
    const merged = [...existingTopics];
    for (const t of legacy.allowed_topics) {
      const k = t.toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        merged.push(t);
      }
    }
    base.allowed_topics = merged;
  }

  return base;
}
