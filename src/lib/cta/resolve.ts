/**
 * CTA Resolver (CON-93 / C-04)
 *
 * Server-side CTA selection. The chatbot's reply never contains a CTA in
 * its prose; instead the chat API emits a structured `cta` SSE event after
 * the assistant turn is finished. This module decides what (if anything)
 * goes in that event.
 *
 * Sources of truth (in order):
 *   1. `settings.forumConfig.cta_rules` (K-01 schema) — tag-matched rule.
 *   2. Default rule from the same `cta_rules` (`default: true`).
 *   3. Legacy fallback: `settings.guardrails.audiences[*].ctaMessages` is
 *      INTENTIONALLY NOT promoted to a structured CTA here — it has no URL
 *      so it cannot satisfy AC #2 ("CTA copy AND URL come from config").
 *      When no rule matches and no default exists, the resolver returns
 *      `null` and the caller surfaces a soft follow-up prompt instead.
 *
 * Trust model: URLs are NEVER read from the model output. They come from
 * the validated `cta_rules` array only. This is how the "NEVER invent URLs"
 * requirement is satisfied without persona prompt edits.
 */

import {
  DEFAULT_FORUM_CONFIG,
} from "@/lib/forum-config/defaults";
import { parseForumConfigPerSlice } from "@/lib/forum-config/validate";
import type { ForumConfig, CtaRule } from "@/lib/forum-config/schema";
import { classifyPrimaryTag, type ClassifiableMessage } from "./classify";

export interface ResolvedCta {
  /** The CTA button label. Sourced from `cta_rules[].text`. */
  text: string;
  /** The CTA URL. Sourced from `cta_rules[].url`. Never from model output. */
  url: string;
  /** The tag that matched. `__default__` when the fallback rule fired. */
  tag: string;
}

export interface CtaResolveResult {
  /** The resolved CTA, or `null` when no rule matched and no default exists. */
  cta: ResolvedCta | null;
  /**
   * Soft follow-up prompt to render when `cta === null`. The widget renders
   * this as a plain italic prompt under the message (no button).
   */
  followUp: string | null;
  /**
   * Whether the response is "substantive" enough to warrant a CTA at all.
   * Short conversational fillers (greetings, acknowledgements) bypass CTA
   * emission entirely.
   */
  shouldEmit: boolean;
  /** The classified primary tag (or null), surfaced for logging. */
  primaryTag: string | null;
}

/**
 * Configuration shape under `tenants.settings.cta` (optional).
 * Extends `tenants.settings` jsonb — no new columns.
 */
interface CtaSettings {
  /**
   * Minimum response length (chars, trimmed) before a CTA is emitted.
   * Below this, the response is treated as conversational filler.
   * Default 80.
   */
  minResponseChars?: number;
  /**
   * Custom soft-follow-up text used when no CTA rule matches and no default
   * exists. Default: "Want to dig deeper? Ask a follow-up."
   */
  followUpPrompt?: string;
  /**
   * Hard disable. When `false`, the resolver always returns `shouldEmit: false`.
   * Default `true` (CTA flow is on by default).
   */
  enabled?: boolean;
}

const DEFAULT_FOLLOW_UP = "Want to dig deeper? Ask a follow-up.";
const DEFAULT_MIN_RESPONSE_CHARS = 80;

/**
 * Read and validate `forumConfig` from tenant settings, with a per-slice
 * fallback to `DEFAULT_FORUM_CONFIG` (CON-201). A tenant whose stored
 * config only carries `cta_rules` (no ai_persona, no seo_defaults) still
 * gets their CTAs resolved instead of being silently replaced by an
 * empty default cta_rules array.
 */
function loadForumConfig(
  settings: Record<string, unknown> | null
): ForumConfig {
  if (!settings) return DEFAULT_FORUM_CONFIG;
  return parseForumConfigPerSlice(settings.forumConfig);
}

function loadCtaSettings(
  settings: Record<string, unknown> | null
): CtaSettings {
  if (!settings) return {};
  const raw = settings.cta;
  if (!raw || typeof raw !== "object") return {};
  return raw as CtaSettings;
}

/**
 * Defence-in-depth: treat any rule whose URL points at the schema example
 * domains as a placeholder. We never want to ship `example.com` /
 * `example.com.au` URLs to a live visitor.
 */
function isPlaceholderRule(rule: CtaRule): boolean {
  const url = (rule.url ?? "").toLowerCase();
  if (!url) return true;
  try {
    const host = new URL(url).hostname;
    return host === "example.com" ||
      host === "example.com.au" ||
      host.endsWith(".example.com") ||
      host.endsWith(".example.com.au");
  } catch {
    // Unparseable URL — treat as placeholder so we don't render junk.
    return true;
  }
}

/**
 * Pick the default CTA rule from the rules array.
 * If multiple rules are marked default, the FIRST one wins (tenant-specified
 * order, deterministic).
 */
function findDefaultRule(rules: CtaRule[]): CtaRule | null {
  for (const rule of rules) {
    if (rule.default) return rule;
  }
  return null;
}

/**
 * Pick the rule matching a specific tag. Case-insensitive comparison so
 * tenant configs survive minor casing drift.
 */
function findRuleByTag(rules: CtaRule[], tag: string): CtaRule | null {
  const target = tag.toLowerCase();
  for (const rule of rules) {
    if (rule.tag.toLowerCase() === target) return rule;
  }
  return null;
}

/**
 * Decide whether a response is substantive enough to deserve a CTA.
 * Short filler turns (greetings, acknowledgements) skip the CTA so the
 * UI doesn't get cluttered.
 */
function isSubstantive(
  assistantResponse: string,
  minChars: number
): boolean {
  const trimmed = assistantResponse.trim();
  if (trimmed.length < minChars) return false;
  // A response that is a single short sentence under the threshold also skips.
  // (covered by length check above)
  return true;
}

export interface ResolveCtaInput {
  /** Tenant settings jsonb (the `tenants.settings` column). */
  settings: Record<string, unknown> | null;
  /** Full conversation including the latest user message. */
  messages: ClassifiableMessage[];
  /** The assistant's just-completed response text. */
  assistantResponse: string;
}

/**
 * Resolve a CTA for an assistant turn.
 *
 * @returns A result describing whether to emit a CTA, what to render, and
 *   (when null) a soft follow-up to surface instead.
 */
export function resolveCta(input: ResolveCtaInput): CtaResolveResult {
  const { settings, messages, assistantResponse } = input;

  const ctaSettings = loadCtaSettings(settings);
  if (ctaSettings.enabled === false) {
    return {
      cta: null,
      followUp: null,
      shouldEmit: false,
      primaryTag: null,
    };
  }

  const minChars = ctaSettings.minResponseChars ?? DEFAULT_MIN_RESPONSE_CHARS;
  if (!isSubstantive(assistantResponse, minChars)) {
    return {
      cta: null,
      followUp: null,
      shouldEmit: false,
      primaryTag: null,
    };
  }

  const forumConfig = loadForumConfig(settings);
  const rules = forumConfig.cta_rules ?? [];

  // Fast-path: no rules, or every rule URL is an `example.com`/`example.com.au`
  // placeholder. Skip CTA emission entirely — do not surface a button or a
  // soft follow-up prompt to the widget. (2026-06-05) The chatbot now weaves
  // contextual links into its reply prose, which is the preferred UX. This
  // guard is also defence-in-depth against future tenants pasting schema
  // example URLs into their dashboard config.
  if (rules.length === 0 || rules.every(isPlaceholderRule)) {
    return {
      cta: null,
      followUp: null,
      shouldEmit: false,
      primaryTag: null,
    };
  }

  // Candidate tags = every rule tag (the only space we can act on).
  const candidateTags = rules.map((r) => r.tag);
  const primaryTag = classifyPrimaryTag(messages, candidateTags);

  // 1. Match by primary tag.
  let matched: CtaRule | null = null;
  if (primaryTag) {
    matched = findRuleByTag(rules, primaryTag);
  }

  // 2. Fall back to the default rule.
  if (!matched) {
    matched = findDefaultRule(rules);
  }

  if (matched) {
    return {
      cta: {
        text: matched.text,
        url: matched.url,
        tag: primaryTag === matched.tag ? matched.tag : "__default__",
      },
      followUp: null,
      shouldEmit: true,
      primaryTag,
    };
  }

  // 3. No rule, no default → soft follow-up.
  return {
    cta: null,
    followUp: ctaSettings.followUpPrompt ?? DEFAULT_FOLLOW_UP,
    shouldEmit: true,
    primaryTag,
  };
}
