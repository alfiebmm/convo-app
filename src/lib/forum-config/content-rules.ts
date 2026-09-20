import { DEFAULT_FORUM_CONFIG } from "./defaults";
import { parseForumConfigPerSlice } from "./validate";
import type { ContentRules } from "./schema";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function forumConfigFromSettings(settings: unknown): unknown {
  if (!isRecord(settings)) return {};
  return isRecord(settings.forumConfig) ? settings.forumConfig : settings;
}

function normalise(input: string): string {
  return input.trim().toLowerCase();
}

export function resolveContentRules(settings: unknown): ContentRules {
  return parseForumConfigPerSlice(forumConfigFromSettings(settings)).contentRules;
}

export function resolveContentRuleExclusions(settings: unknown): string[] {
  const raw = forumConfigFromSettings(settings);
  const forumConfig = parseForumConfigPerSlice(raw);
  const rawContentRules = isRecord(raw)
    ? (raw.contentRules as unknown)
    : undefined;
  const rawExclusions = isRecord(rawContentRules)
    ? rawContentRules.exclusionList
    : undefined;
  const hasExplicitContentRuleExclusions =
    Array.isArray(rawExclusions) && rawExclusions.length > 0;

  return hasExplicitContentRuleExclusions
    ? forumConfig.contentRules.exclusionList
    : forumConfig.exclusion_list;
}

export function findExcludedTopic(
  settings: unknown,
  ...inputs: Array<string | null | undefined>
): string | null {
  const haystack = normalise(inputs.filter(Boolean).join(" "));
  if (!haystack) return null;

  for (const term of resolveContentRuleExclusions(settings)) {
    const needle = normalise(term);
    if (needle && haystack.includes(needle)) return term;
  }
  return null;
}

export function contentRulesPromptBlock(settings: unknown): string {
  const rules = resolveContentRules(settings);
  const defaults = DEFAULT_FORUM_CONFIG.contentRules;
  const styleGuide = rules.styleGuide ?? defaults.styleGuide;
  const blogTemplate = rules.blogTemplate ?? defaults.blogTemplate;
  const personas = rules.personas ?? [];
  const exclusions = resolveContentRuleExclusions(settings);

  const lines = [
    "# Tenant Content Rules",
    `- Tone: ${styleGuide.tone || defaults.styleGuide.tone}`,
    `- Reading level: ${
      styleGuide.readingLevel || defaults.styleGuide.readingLevel
    }`,
    `- Target length: ${styleGuide.lengthTargets.min}-${styleGuide.lengthTargets.max} words`,
  ];

  if (styleGuide.bannedWords.length > 0) {
    lines.push(`- Tenant banned words: ${styleGuide.bannedWords.join(", ")}`);
  }
  if (blogTemplate.h1Pattern) {
    lines.push(`- H1 pattern: ${blogTemplate.h1Pattern}`);
  }
  if (blogTemplate.h2Sections.length > 0) {
    lines.push(`- Preferred H2 sections: ${blogTemplate.h2Sections.join("; ")}`);
  }
  lines.push(
    `- FAQ section: ${blogTemplate.faqEnabled ? "include when useful" : "do not include"}`,
  );
  if (blogTemplate.ctaPlaceholders.length > 0) {
    lines.push(`- CTA placeholders: ${blogTemplate.ctaPlaceholders.join(", ")}`);
  }
  if (personas.length > 0) {
    lines.push(
      `- Personas: ${personas
        .map((persona) =>
          [persona.name, persona.audience, persona.description]
            .filter(Boolean)
            .join(" — "),
        )
        .join("; ")}`,
    );
  }
  if (exclusions.length > 0) {
    lines.push(
      `- Excluded topics: ${exclusions.join(", ")}. Do not create blog content about these topics.`,
    );
  }

  return lines.join("\n");
}
