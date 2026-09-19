import { generateSlug } from "./seo";
import {
  enforceCtaConfig,
  wordCountGateStats,
  type BlogCtaConfig,
  type BlogPostJson,
  type WordCountGateViolation,
  type WritingRuleViolation,
} from "./writing-rules";

type Section = BlogPostJson["sections"][number];
type Block = Section["blocks"][number];

export type BlogRepairAi = {
  generatePost(params: {
    systemPrompt: string;
    userPrompt: string;
  }): Promise<string>;
};

export type BlogRepairBrief = {
  tenant: {
    id: string;
    name: string;
    ctaConfig: BlogCtaConfig;
    writingRules: { bannedTerms: string[]; enforceAustralianEnglish: boolean };
  };
  source: {
    conversationId: string;
  };
  decision: {
    primaryKeyword: string;
    intent: string;
  };
};

export type RepairOperation = {
  kind: "deterministic" | "model";
  code: WritingRuleViolation["code"];
  action: string;
  details?: Record<string, unknown>;
};

export type RepairResult = {
  post: BlogPostJson;
  operations: RepairOperation[];
};

const AU_SPELLING_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\borganize\b/gi, "organise"],
  [/\borganized\b/gi, "organised"],
  [/\borganizing\b/gi, "organising"],
  [/\borganization\b/gi, "organisation"],
  [/\boptimize\b/gi, "optimise"],
  [/\boptimized\b/gi, "optimised"],
  [/\boptimizing\b/gi, "optimising"],
  [/\boptimization\b/gi, "optimisation"],
  [/\bcolor\b/gi, "colour"],
  [/\bcolors\b/gi, "colours"],
  [/\bcenter\b/gi, "centre"],
  [/\bcenters\b/gi, "centres"],
  [/\bbehavior\b/gi, "behaviour"],
  [/\bfavorite\b/gi, "favourite"],
  [/\bfavorites\b/gi, "favourites"],
];

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsCaseInsensitive(value: string | undefined, needle: string): boolean {
  return (value ?? "").toLowerCase().includes(needle.toLowerCase());
}

function capitaliseSentence(value: string): string {
  const trimmed = value.trim();
  return trimmed ? `${trimmed[0].toUpperCase()}${trimmed.slice(1)}` : trimmed;
}

function sentenceForKeyword(keyword: string, tenantName: string): string {
  return `${capitaliseSentence(keyword)} is most useful when ${tenantName} explains the practical next steps, safety checks, and questions people should raise before they act.`;
}

function appendKeyword(value: string | undefined, keyword: string): string {
  const trimmed = (value ?? "").trim();
  if (containsCaseInsensitive(trimmed, keyword)) return trimmed;
  if (!trimmed) return capitaliseSentence(keyword);
  return `${trimmed}: ${keyword}`;
}

function metaDescriptionWithKeyword(value: string | undefined, keyword: string): string {
  const trimmed = (value ?? "").trim();
  if (containsCaseInsensitive(trimmed, keyword)) return trimmed;
  const suffix = ` Learn what ${keyword} means in practice, what to check first, and when to ask for specific guidance.`;
  const next = `${trimmed.replace(/\s+$/g, "")}${trimmed.endsWith(".") ? "" : "."}${suffix}`;
  return next.slice(0, 200).replace(/\s+\S*$/g, "").replace(/[,.]$/g, ".");
}

function mapStrings<T>(value: T, mapper: (input: string) => string): T {
  function visit(input: unknown): unknown {
    if (typeof input === "string") return mapper(input);
    if (Array.isArray(input)) return input.map(visit);
    if (!input || typeof input !== "object") return input;
    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>).map(([key, nested]) => [
        key,
        visit(nested),
      ])
    );
  }

  return visit(value) as T;
}

function normaliseAustralianEnglish(post: BlogPostJson): RepairResult {
  let replacements = 0;
  const repaired = mapStrings(post, (input) => {
    let output = input;
    for (const [pattern, replacement] of AU_SPELLING_REPLACEMENTS) {
      output = output.replace(pattern, () => {
        replacements++;
        return replacement;
      });
    }
    return output;
  });

  return {
    post: repaired,
    operations: [
      {
        kind: "deterministic",
        code: "australian_english",
        action: "normalise_au_spelling",
        details: { replacements },
      },
    ],
  };
}

function stripBannedTerms(post: BlogPostJson, bannedTerms: readonly string[]): RepairResult {
  let replacements = 0;
  const repaired = mapStrings(post, (input) => {
    let output = input;
    for (const term of bannedTerms) {
      const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(term)}([^a-z0-9]|$)`, "gi");
      output = output.replace(pattern, (_match, before: string, after: string) => {
        replacements++;
        return `${before}specific${after}`;
      });
    }
    return output.replace(/\s{2,}/g, " ").trim();
  });

  return {
    post: repaired,
    operations: [
      {
        kind: "deterministic",
        code: "banned_term",
        action: "replace_banned_terms",
        details: { replacements },
      },
    ],
  };
}

function repairPrimaryKeyword(post: BlogPostJson, brief: BlogRepairBrief): RepairResult {
  const keyword = brief.decision.primaryKeyword;
  const sections = post.sections.length > 0 ? [...post.sections] : [fallbackSection(keyword, brief)];
  const firstSection = sections[0] ?? fallbackSection(keyword, brief);
  sections[0] = {
    ...firstSection,
    heading: appendKeyword(firstSection.heading, keyword),
  };
  const introSentence = sentenceForKeyword(keyword, brief.tenant.name);

  return {
    post: {
      ...post,
      title: appendKeyword(post.title, keyword),
      intro: containsCaseInsensitive(post.intro, keyword)
        ? post.intro
        : `${introSentence} ${(post.intro ?? "").trim()}`.trim(),
      sections,
      seo: {
        ...(post.seo ?? {}),
        metaTitle: appendKeyword(post.seo?.metaTitle ?? post.title, keyword),
        metaDescription: metaDescriptionWithKeyword(post.seo?.metaDescription, keyword),
        keywords: Array.from(new Set([...(post.seo?.keywords ?? []), keyword])),
      },
    },
    operations: [
      {
        kind: "deterministic",
        code: "primary_keyword",
        action: "enforce_primary_keyword_placements",
        details: { primaryKeyword: keyword },
      },
    ],
  };
}

function fallbackSection(keyword: string, brief: BlogRepairBrief): Section {
  return {
    heading: capitaliseSentence(keyword),
    blocks: [
      {
        type: "p",
        text: sentenceForKeyword(keyword, brief.tenant.name),
      },
      {
        type: "p",
        text: `${brief.tenant.name} can frame ${keyword} around clear evidence, practical constraints, and specific customer questions so the article stays useful rather than generic.`,
      },
      {
        type: "p",
        text: `The safest approach is to explain ${keyword} in plain Australian English, avoid unsupported promises, and give readers a clear next step that matches the tenant CTA.`,
      },
    ],
  };
}

function repairSafeSchemaDefaults(post: BlogPostJson, brief: BlogRepairBrief): RepairResult {
  const sourceSections = Array.isArray(post.sections) ? post.sections : [];
  const sourceFaqs = Array.isArray(post.faqs) ? post.faqs : [];
  const sections = sourceSections.length > 0
    ? sourceSections
    : [fallbackSection(brief.decision.primaryKeyword, brief)];
  const toc = sections.slice(0, 3).map((section) => section.heading).filter(Boolean);
  while (toc.length < 3) toc.push(capitaliseSentence(brief.decision.primaryKeyword));

  const repaired: BlogPostJson = {
    ...post,
    slug: generateSlug(post.title || brief.decision.primaryKeyword),
    category: post.category || "Guide",
    title: post.title || capitaliseSentence(brief.decision.primaryKeyword),
    dek: post.dek || `A practical guide to ${brief.decision.primaryKeyword}.`,
    meta: {
      updated: post.meta?.updated || new Date().toISOString().slice(0, 10),
      readMinutes: post.meta?.readMinutes || 4,
      reviewer: post.meta?.reviewer,
    },
    seo: {
      ...(post.seo ?? {}),
      metaTitle: post.seo?.metaTitle || post.title || capitaliseSentence(brief.decision.primaryKeyword),
      metaDescription:
        post.seo?.metaDescription ||
        `Learn what ${brief.decision.primaryKeyword} means in practice, what to check first, and when to ask for specific guidance.`,
      keywords: Array.from(
        new Set([...(post.seo?.keywords ?? []), brief.decision.primaryKeyword])
      ),
    },
    hero: {
      url: post.hero?.url || "",
      alt: post.hero?.alt || post.title || brief.tenant.name,
    },
    toc: toc.slice(0, 3),
    intro: post.intro || sentenceForKeyword(brief.decision.primaryKeyword, brief.tenant.name),
    sections,
    faqs:
      sourceFaqs.length >= 3
        ? sourceFaqs
        : [
            ...sourceFaqs,
            {
              q: `What should I know about ${brief.decision.primaryKeyword}?`,
              a: `${brief.tenant.name} should explain the practical checks, likely next steps, and where a reader needs individual guidance.`,
            },
            {
              q: `When should I ask for help with ${brief.decision.primaryKeyword}?`,
              a: "Ask for help when the decision affects safety, cost, timing, or confidence in the next step.",
            },
            {
              q: "What is the best next step?",
              a: "Use the article guidance as a starting point, then contact the team for advice that fits the exact situation.",
            },
          ].slice(0, 3),
  };

  return {
    post: enforceCtaConfig(repaired, brief.tenant.ctaConfig),
    operations: [
      {
        kind: "deterministic",
        code: "schema",
        action: "apply_safe_schema_defaults",
      },
    ],
  };
}

function sectionRepairPrompt(params: {
  brief: BlogRepairBrief;
  post: BlogPostJson;
  section: Section;
  sectionIndex: number;
  violation: WordCountGateViolation;
}): { systemPrompt: string; userPrompt: string } {
  const sectionStats = params.violation.stats.sections.find(
    (section) => section.index === params.sectionIndex
  );
  const totalDeficit = Math.max(
    0,
    params.violation.stats.minTotalWordCount - params.violation.stats.totalWordCount
  );
  const targetSectionWordCount = Math.max(
    params.violation.stats.minSectionWordCount,
    (sectionStats?.wordCount ?? 0) + totalDeficit
  );

  return {
    systemPrompt:
      "You repair one section of a Convo blog article. Return only JSON for the single repaired section object with heading and blocks. Do not return the whole post.",
    userPrompt: JSON.stringify(
      {
        task: "Repair only this section so it satisfies the word-count contract.",
        primaryKeyword: params.brief.decision.primaryKeyword,
        tenantName: params.brief.tenant.name,
        violation: params.violation.message,
        requirements: {
          minParagraphBlocks: params.violation.stats.minParagraphsPerSection,
          minSectionParagraphWords: params.violation.stats.minSectionWordCount,
          targetSectionParagraphWords: targetSectionWordCount,
          currentTotalWords: params.violation.stats.totalWordCount,
          minTotalWords: params.violation.stats.minTotalWordCount,
          additionalWordsNeededAcrossArticle: totalDeficit,
          paragraphLength: "80-150 words",
          australianEnglish: true,
          bannedTerms: params.brief.tenant.writingRules.bannedTerms,
          preserveHeadingIntent: true,
        },
        sectionIndex: params.sectionIndex,
        section: params.section,
        neighbouringHeadings: params.post.sections.map((section) => section.heading),
      },
      null,
      2
    ),
  };
}

function parseSectionRepair(raw: string, fallbackHeading: string): Section {
  const parsed = JSON.parse(raw) as Partial<Section>;
  return {
    heading: typeof parsed.heading === "string" && parsed.heading.trim()
      ? parsed.heading.trim()
      : fallbackHeading,
    blocks: Array.isArray(parsed.blocks) ? (parsed.blocks as Block[]) : [],
  };
}

function targetSectionIndex(post: BlogPostJson, violation: WordCountGateViolation): number {
  const stats = violation.stats.sections;
  const paragraphFailure = stats.find(
    (section) => section.paragraphCount < violation.stats.minParagraphsPerSection
  );
  if (paragraphFailure) return paragraphFailure.index;

  const sectionFailure = stats.find(
    (section) => section.wordCount < violation.stats.minSectionWordCount
  );
  if (sectionFailure) return sectionFailure.index;

  const shortest = stats.reduce((current, section) =>
    section.wordCount < current.wordCount ? section : current
  );
  return shortest.index;
}

async function repairWordCount(
  post: BlogPostJson,
  brief: BlogRepairBrief,
  violation: WordCountGateViolation,
  ai: BlogRepairAi
): Promise<RepairResult> {
  const sectionIndex = targetSectionIndex(post, violation);
  const section = post.sections[sectionIndex] ?? fallbackSection(brief.decision.primaryKeyword, brief);
  const prompt = sectionRepairPrompt({ brief, post, section, sectionIndex, violation });
  const raw = await ai.generatePost(prompt);
  const repairedSection = parseSectionRepair(raw, section.heading);
  const sections = [...post.sections];
  sections[sectionIndex] = repairedSection;

  return {
    post: {
      ...post,
      sections,
      meta: {
        ...post.meta,
        readMinutes: Math.max(1, Math.ceil(wordCountGateStats({ ...post, sections }).totalWordCount / 220)),
      },
    },
    operations: [
      {
        kind: "model",
        code: "word_count",
        action: "repair_section_prose",
        details: { sectionIndex, heading: repairedSection.heading },
      },
    ],
  };
}

export async function repairBlogPost(
  post: BlogPostJson,
  brief: BlogRepairBrief,
  violation: WritingRuleViolation,
  ai: BlogRepairAi
): Promise<RepairResult> {
  if (violation.code === "primary_keyword") return repairPrimaryKeyword(post, brief);
  if (violation.code === "banned_term") {
    return stripBannedTerms(post, brief.tenant.writingRules.bannedTerms);
  }
  if (violation.code === "australian_english") return normaliseAustralianEnglish(post);
  if (violation.code === "schema") return repairSafeSchemaDefaults(post, brief);
  if (violation.code === "word_count") {
    return repairWordCount(post, brief, violation as WordCountGateViolation, ai);
  }

  return { post, operations: [] };
}
