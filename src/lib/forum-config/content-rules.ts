import { DEFAULT_FORUM_CONFIG } from "./defaults";
import { contentRulesSchema, type ContentRules } from "./schema";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function forumConfigFromSettings(settings: unknown): Record<string, unknown> {
  if (!isRecord(settings)) return {};
  return isRecord(settings.forumConfig) ? settings.forumConfig : settings;
}

function normaliseTerm(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function mergeUniqueStrings(...lists: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const raw of list) {
      const term = normaliseTerm(raw);
      if (!term) continue;
      const key = term.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(term);
    }
  }

  return out;
}

export function readContentRules(settings: unknown): ContentRules {
  const forumConfig = forumConfigFromSettings(settings);
  const parsed = contentRulesSchema.safeParse(forumConfig.contentRules);
  return parsed.success ? parsed.data : DEFAULT_FORUM_CONFIG.contentRules;
}

export function contentRulesExclusionList(settings: unknown): string[] {
  const forumConfig = forumConfigFromSettings(settings);
  const contentRules = readContentRules(settings);

  return mergeUniqueStrings(
    contentRules.exclusionList,
    forumConfig.exclusion_list,
  );
}

export function contentRulesBannedWords(settings: unknown): string[] {
  const forumConfig = forumConfigFromSettings(settings);
  const contentRules = readContentRules(settings);
  const aiPersona = isRecord(forumConfig.ai_persona) ? forumConfig.ai_persona : {};

  return mergeUniqueStrings(
    contentRules.styleGuide.bannedWords,
    aiPersona.banned_words,
  );
}

export function matchesExcludedTopic(
  exclusionList: readonly string[],
  input: string,
): string | null {
  const haystack = input.trim().toLowerCase();
  if (!haystack) return null;

  for (const term of exclusionList) {
    const needle = term.trim().toLowerCase();
    if (needle && haystack.includes(needle)) return term;
  }

  return null;
}

export function contentRulesPromptAddendum(rules: ContentRules): string {
  const style = rules.styleGuide;
  const template = rules.blogTemplate;
  const length = style.lengthTargets;
  const lines = [
    "Tenant content rules:",
    `- Tone: ${style.tone}`,
    `- Reading level: ${style.readingLevel}`,
    `- Length target: ${length.min}-${length.max} words`,
  ];

  if (style.bannedWords.length > 0) {
    lines.push(`- Banned words: ${style.bannedWords.join(", ")}`);
  }
  if (template.h1Pattern.trim()) {
    lines.push(`- H1 pattern: ${template.h1Pattern}`);
  }
  if (template.h2Sections.length > 0) {
    lines.push(`- Preferred H2 sections: ${template.h2Sections.join("; ")}`);
  }
  lines.push(
    template.faqEnabled
      ? "- Include an FAQ section."
      : "- Do not include an FAQ section unless the source conversation requires it.",
  );
  if (template.ctaPlaceholders.length > 0) {
    lines.push(`- CTA placeholders: ${template.ctaPlaceholders.join(", ")}`);
  }
  if (rules.personas.length > 0) {
    lines.push(
      `- Audience personas: ${rules.personas
        .map((persona) => `${persona.name}: ${persona.description}`.trim())
        .join("; ")}`,
    );
  }
  if (rules.exclusionList.length > 0) {
    lines.push(
      `- Excluded topics: ${rules.exclusionList.join(", ")}. Do not create blog content on these topics.`,
    );
  }

  return lines.join("\n");
}
