/**
 * Response-Engine Helpers (CON-90)
 *
 * Bridges `tenant.settings` to the chat route:
 *   - reads `settings.forumConfig` (validated against the K-01 schema,
 *     falling back to defaults on missing/invalid)
 *   - reads `settings.responseEngine` feature flags (default ON)
 *   - builds the 3-part structure prompt block + locale instruction
 *     that gets appended to the system prompt
 *   - computes the `max_tokens` value to pass to OpenAI
 *
 * Keeping all of this in one module makes the chat route diff small
 * and the unit-test surface obvious.
 */

import { DEFAULT_FORUM_CONFIG } from "@/lib/forum-config/defaults";
import { parseForumConfigPerSlice } from "@/lib/forum-config/validate";
import type { ForumConfig } from "@/lib/forum-config/schema";

// ─── Feature flags ───────────────────────────────────────────

export interface ResponseEngineFlags {
  /** Append the 3-part structure rule to the system prompt. Default ON. */
  threePartStructure: boolean;
  /** Run the banned-word / exclusion-list filter on output. Default ON. */
  bannedWordFilter: boolean;
  /** Enforce `max_output_tokens` on the OpenAI call. Default ON. */
  enforceTokenCap: boolean;
  /** Inject locale instruction from `ai_persona.locale`. Default ON. */
  applyLocale: boolean;
}

const DEFAULT_FLAGS: ResponseEngineFlags = {
  threePartStructure: true,
  bannedWordFilter: true,
  enforceTokenCap: true,
  applyLocale: true,
};

function readFlags(settings: Record<string, unknown>): ResponseEngineFlags {
  const raw = settings.responseEngine as Record<string, unknown> | undefined;
  if (!raw || typeof raw !== "object") return { ...DEFAULT_FLAGS };
  return {
    threePartStructure:
      raw.threePartStructure === false ? false : DEFAULT_FLAGS.threePartStructure,
    bannedWordFilter:
      raw.bannedWordFilter === false ? false : DEFAULT_FLAGS.bannedWordFilter,
    enforceTokenCap:
      raw.enforceTokenCap === false ? false : DEFAULT_FLAGS.enforceTokenCap,
    applyLocale:
      raw.applyLocale === false ? false : DEFAULT_FLAGS.applyLocale,
  };
}

// ─── Forum config resolution ─────────────────────────────────

/**
 * Resolve the effective `ForumConfig` for a tenant. Validates
 * `settings.forumConfig` slice-by-slice (CON-201) and falls back to the
 * corresponding slice of `DEFAULT_FORUM_CONFIG` for any slice that is
 * missing or malformed. A tenant who has only populated
 * `ai_persona.voice_description` still gets that voice surfaced, instead
 * of being silently replaced by the default persona.
 */
export function resolveForumConfig(
  settings: Record<string, unknown> | null | undefined,
): ForumConfig {
  if (!settings || typeof settings !== "object") return DEFAULT_FORUM_CONFIG;
  const raw = (settings as Record<string, unknown>).forumConfig;
  if (!raw) return DEFAULT_FORUM_CONFIG;
  return parseForumConfigPerSlice(raw);
}

// ─── Locale ──────────────────────────────────────────────────

/**
 * Map a BCP-47 locale code into a short human-readable instruction
 * appended to the system prompt. Unknown locales fall through to
 * Australian English (the schema default).
 */
function localeInstruction(locale: string): string {
  const l = locale.toLowerCase();
  if (l.startsWith("en-au")) {
    return "Use Australian English spelling (e.g. \"optimise\", \"organisation\", \"behaviour\") and an Australian conversational register.";
  }
  if (l.startsWith("en-gb")) {
    return "Use British English spelling and register.";
  }
  if (l.startsWith("en-us")) {
    return "Use US English spelling and register.";
  }
  if (l.startsWith("en")) {
    return "Reply in English.";
  }
  return `Reply in locale ${locale}.`;
}

// ─── System prompt addendum ──────────────────────────────────

const THREE_PART_BLOCK = `# Response Structure (HARD RULE)

Every substantive answer MUST follow this 3-part structure, in order:

1. **Direct answer.** One or two short sentences that answer the question outright.
2. **Key considerations.** Two or three short sentences (or up to three short bullets) covering the nuance, caveats, or context the user needs.
3. **Practical next step.** One short sentence with a concrete next action the user can take — a question to ask, a link to follow, a button to click, a person to contact.

Do NOT label the parts ("Direct answer:" etc.). Let the structure flow naturally as plain prose so it reads like a single coherent reply.

EXCEPTIONS — for conversational turns where the 3-part structure would be absurd, fall back to a single short sentence:
- Greetings and pleasantries ("hi", "thanks", "ok")
- Pure clarifying questions back to the user
- Acknowledgements ("noted", "got it")

When you're inside an exception, keep it to one sentence. Don't pad.`;

export interface PromptAddendumInput {
  forumConfig: ForumConfig;
  flags: ResponseEngineFlags;
}

/**
 * Build the response-engine prompt addendum that gets appended to the
 * tenant's base system prompt. Returns an empty string when every flag
 * in this block is disabled.
 */
export function buildResponseEngineAddendum(input: PromptAddendumInput): string {
  const { forumConfig, flags } = input;
  const parts: string[] = [];

  if (flags.threePartStructure) {
    parts.push(THREE_PART_BLOCK);
  }

  if (flags.applyLocale) {
    parts.push(`# Locale\n${localeInstruction(forumConfig.ai_persona.locale)}`);
  }

  return parts.join("\n\n");
}

// ─── Token cap ───────────────────────────────────────────────

/**
 * Compute the `max_tokens` value to pass to OpenAI for this tenant.
 * Returns `undefined` when enforcement is disabled — the caller should
 * then omit the field, letting OpenAI use its own default.
 */
export function resolveMaxTokens(
  forumConfig: ForumConfig,
  flags: ResponseEngineFlags,
): number | undefined {
  if (!flags.enforceTokenCap) return undefined;
  return forumConfig.limits.max_output_tokens;
}

// ─── One-shot accessor for the chat route ────────────────────

export interface ResolvedResponseEngine {
  forumConfig: ForumConfig;
  flags: ResponseEngineFlags;
  promptAddendum: string;
  bannedTerms: string[];
  maxTokens: number | undefined;
}

/**
 * Single entry point used by the chat route. Resolves config + flags
 * and pre-computes everything the route needs in one call.
 */
export function resolveResponseEngine(
  settings: Record<string, unknown> | null | undefined,
): ResolvedResponseEngine {
  const flags = readFlags(settings ?? {});
  const forumConfig = resolveForumConfig(settings);
  const promptAddendum = buildResponseEngineAddendum({ forumConfig, flags });

  const bannedTerms = flags.bannedWordFilter
    ? mergeBannedTerms(forumConfig)
    : [];

  return {
    forumConfig,
    flags,
    promptAddendum,
    bannedTerms,
    maxTokens: resolveMaxTokens(forumConfig, flags),
  };
}

function mergeBannedTerms(forumConfig: ForumConfig): string[] {
  const merged = new Set<string>();
  for (const t of forumConfig.ai_persona.banned_words) {
    if (t && t.trim()) merged.add(t.trim());
  }
  for (const t of forumConfig.exclusion_list) {
    if (t && t.trim()) merged.add(t.trim());
  }
  return Array.from(merged);
}
