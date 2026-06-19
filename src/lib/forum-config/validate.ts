import {
  forumConfigSchema,
  aiPersonaSchema,
  ctaRulesSchema,
  qualifyingQuestionsSchema,
  leadCaptureSchema,
  allowedTopicsSchema,
  exclusionListSchema,
  seoDefaultsSchema,
  connectorsSchema,
  limitsSchema,
  followUpSchema,
} from "./schema";
import type {
  ForumConfig,
  AiPersona,
  CtaRule,
  SeoDefaults,
  Connectors,
  Limits,
  LeadCapture,
  FollowUp,
} from "./schema";
import { DEFAULT_FORUM_CONFIG } from "./defaults";
import { ZodError } from "zod";

/**
 * Validation Helper (K-01)
 *
 * Validates forum.config.json data against the schema.
 * Use this function before every write to the Tenant record.
 *
 * @param input - The config object to validate (unknown type for safety)
 * @returns A result object with either validated data or error messages
 *
 * @example
 * ```typescript
 * const result = validateForumConfig(userInput);
 * if (result.ok) {
 *   // Use result.data (typed as ForumConfig)
 *   await updateTenantConfig(result.data);
 * } else {
 *   // Handle validation errors
 *   return { errors: result.errors };
 * }
 * ```
 */
export function validateForumConfig(
  input: unknown
):
  | { ok: true; data: ForumConfig }
  | { ok: false; errors: string[] } {
  try {
    const data = forumConfigSchema.parse(input);
    return { ok: true, data };
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = error.issues.map((e) => {
        const path = e.path.join(".");
        return `${path}: ${e.message}`;
      });
      return { ok: false, errors };
    }
    // Unexpected error type
    return {
      ok: false,
      errors: ["Unexpected validation error: " + String(error)],
    };
  }
}

/**
 * Safe parse with default fallback.
 *
 * Attempts to parse the input, but if validation fails, returns the default config
 * instead of throwing. Useful for reading existing configs that may be malformed.
 *
 * @param input - The config object to parse
 * @param fallback - The fallback config to return on validation failure
 * @returns The validated config or the fallback
 *
 * @remarks CON-201: Prefer {@link parseForumConfigPerSlice} for live consumers.
 *   This whole-config fallback is retained for compatibility, but per-slice
 *   parsing is now the recommended path because the strict root parse used
 *   to silently nuke an entire tenant config (qualifying_questions, CTAs,
 *   voice_description) the moment ANY slice failed validation.
 */
export function parseForumConfigSafe(
  input: unknown,
  fallback: ForumConfig
): ForumConfig {
  const result = forumConfigSchema.safeParse(input);
  return result.success ? result.data : fallback;
}

// ============================================================
// Per-slice parsing (CON-201)
// ============================================================
//
// Live consumers (qualifying-question resolver, response engine,
// CTA resolver, follow-up routing) need only the slice they care
// about. A whole-config strict parse is the wrong abstraction:
// one bad/missing slice should not wipe an otherwise valid config.
//
// `parseForumConfigPerSlice` runs each slice's schema independently
// and falls back to that slice's default on failure. The shape of
// the returned object matches `ForumConfig`, so existing call sites
// can swap in without ceremony.
//
// This is Option A from the CON-201 ticket. Option C (relaxing the
// root schema with `.prefault({})` on every slice) is also shipped
// in `./schema.ts` so the strict root parse stops being a footgun.
// Both ship together: the root schema is now honest about what's
// required, and per-slice parsing protects runtime if anyone ever
// tightens a slice in the future.

type SliceKey = Exclude<keyof ForumConfig, "schema_version">;

/**
 * Parse a single slice with the given schema, returning the parsed value
 * on success and `fallback` on failure. Centralised so logging / metrics
 * can be added in one place later if we want to alert on partial-parse
 * failures.
 *
 * `present = false` means the slice was absent from the source object; we
 * fall back to `fallback` so an absent slice surfaces Convo's rich seeded
 * default (`DEFAULT_FORUM_CONFIG[slice]`) rather than the bare Zod
 * field-level defaults. This preserves the existing contract for tenants
 * who simply haven't written that slice yet.
 */
function parseSlice<T>(
  schema: { safeParse: (input: unknown) => { success: boolean; data?: T } },
  input: unknown,
  fallback: T,
  present: boolean,
): T {
  if (!present) return fallback;
  const result = schema.safeParse(input);
  if (result.success && result.data !== undefined) return result.data;
  return fallback;
}

/**
 * Parse `forumConfig` slice-by-slice and assemble a complete
 * {@link ForumConfig}. Each slice is independently validated; on failure
 * that slice falls back to the corresponding slice of
 * {@link DEFAULT_FORUM_CONFIG} while the others are kept.
 *
 * Behavioural matrix:
 *   - `input === null | undefined | non-object` → returns
 *     `DEFAULT_FORUM_CONFIG` (no slices to parse).
 *   - `input = {}` → every slice falls back to its default (same effective
 *     behaviour as today's whole-config fallback).
 *   - `input = { qualifying_questions: {...} }` → qualifying_questions
 *     parsed; every other slice = default. **This is the AgPages live
 *     production scenario.**
 *   - `input = { ai_persona: { tone: "expert", voice_description: "blah" } }`
 *     → ai_persona parsed (field-level defaults fill the rest); every
 *     other slice = default.
 *   - Fully populated → identical to a successful root parse.
 */
export function parseForumConfigPerSlice(input: unknown): ForumConfig {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return DEFAULT_FORUM_CONFIG;
  }
  const raw = input as Record<string, unknown>;

  // schema_version is metadata; default to 1 when missing/invalid.
  const schemaVersionParsed = Number(raw.schema_version);
  const schema_version =
    Number.isInteger(schemaVersionParsed) && schemaVersionParsed > 0
      ? schemaVersionParsed
      : DEFAULT_FORUM_CONFIG.schema_version;

  const has = (k: string) => Object.prototype.hasOwnProperty.call(raw, k);

  const ai_persona = parseSlice<AiPersona>(
    aiPersonaSchema,
    raw.ai_persona,
    DEFAULT_FORUM_CONFIG.ai_persona,
    has("ai_persona"),
  );

  const cta_rules = parseSlice<CtaRule[]>(
    ctaRulesSchema,
    raw.cta_rules,
    DEFAULT_FORUM_CONFIG.cta_rules,
    has("cta_rules"),
  );

  const qualifying_questions = parseSlice<ForumConfig["qualifying_questions"]>(
    qualifyingQuestionsSchema,
    raw.qualifying_questions,
    DEFAULT_FORUM_CONFIG.qualifying_questions,
    has("qualifying_questions"),
  );

  const lead_capture = parseSlice<LeadCapture>(
    leadCaptureSchema,
    raw.lead_capture,
    DEFAULT_FORUM_CONFIG.lead_capture,
    has("lead_capture"),
  );

  const allowed_topics = parseSlice<string[]>(
    allowedTopicsSchema,
    raw.allowed_topics,
    DEFAULT_FORUM_CONFIG.allowed_topics,
    has("allowed_topics"),
  );

  const exclusion_list = parseSlice<string[]>(
    exclusionListSchema,
    raw.exclusion_list,
    DEFAULT_FORUM_CONFIG.exclusion_list,
    has("exclusion_list"),
  );

  const seo_defaults = parseSlice<SeoDefaults>(
    seoDefaultsSchema,
    raw.seo_defaults,
    DEFAULT_FORUM_CONFIG.seo_defaults,
    has("seo_defaults"),
  );

  const connectors = parseSlice<Connectors>(
    connectorsSchema,
    raw.connectors,
    DEFAULT_FORUM_CONFIG.connectors,
    has("connectors"),
  );

  const limits = parseSlice<Limits>(
    limitsSchema,
    raw.limits,
    DEFAULT_FORUM_CONFIG.limits,
    has("limits"),
  );

  const follow_up = parseSlice<FollowUp>(
    followUpSchema,
    raw.follow_up,
    DEFAULT_FORUM_CONFIG.follow_up,
    has("follow_up"),
  );

  return {
    schema_version,
    ai_persona,
    cta_rules,
    qualifying_questions,
    lead_capture,
    allowed_topics,
    exclusion_list,
    seo_defaults,
    connectors,
    limits,
    follow_up,
  };
}

/**
 * Convenience: parse only the slice a caller cares about, falling back to
 * the supplied default on failure. Used by consumers that don't need the
 * full assembled config (most of the runtime callers).
 *
 * `slice` is the key on `ForumConfig`. The compiler enforces that
 * `fallback` matches the slice's type.
 */
export function parseSliceSafe<K extends SliceKey>(
  slice: K,
  input: unknown,
  fallback: ForumConfig[K],
): ForumConfig[K] {
  switch (slice) {
    // For parseSliceSafe the caller has already chosen to parse this slice,
    // so treat input as "present". If they want absent-slice semantics they
    // can short-circuit before calling.
    case "ai_persona":
      return parseSlice(
        aiPersonaSchema,
        input,
        fallback as AiPersona,
        true,
      ) as ForumConfig[K];
    case "cta_rules":
      return parseSlice(
        ctaRulesSchema,
        input,
        fallback as CtaRule[],
        true,
      ) as ForumConfig[K];
    case "qualifying_questions":
      return parseSlice(
        qualifyingQuestionsSchema,
        input,
        fallback as ForumConfig["qualifying_questions"],
        true,
      ) as ForumConfig[K];
    case "lead_capture":
      return parseSlice(
        leadCaptureSchema,
        input,
        fallback as LeadCapture,
        true,
      ) as ForumConfig[K];
    case "allowed_topics":
      return parseSlice(
        allowedTopicsSchema,
        input,
        fallback as string[],
        true,
      ) as ForumConfig[K];
    case "exclusion_list":
      return parseSlice(
        exclusionListSchema,
        input,
        fallback as string[],
        true,
      ) as ForumConfig[K];
    case "seo_defaults":
      return parseSlice(
        seoDefaultsSchema,
        input,
        fallback as SeoDefaults,
        true,
      ) as ForumConfig[K];
    case "connectors":
      return parseSlice(
        connectorsSchema,
        input,
        fallback as Connectors,
        true,
      ) as ForumConfig[K];
    case "limits":
      return parseSlice(
        limitsSchema,
        input,
        fallback as Limits,
        true,
      ) as ForumConfig[K];
    case "follow_up":
      return parseSlice(
        followUpSchema,
        input,
        fallback as FollowUp,
        true,
      ) as ForumConfig[K];
    default: {
      // Exhaustiveness check — if a new slice is added to ForumConfig the
      // compiler will flag this branch.
      const _exhaustive: never = slice;
      void _exhaustive;
      return fallback;
    }
  }
}
