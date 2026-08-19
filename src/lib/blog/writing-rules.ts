export type BlogPostJson = {
  slug: string;
  category: string;
  title: string;
  dek: string;
  meta: {
    updated: string;
    readMinutes: number;
    reviewer?: string;
  };
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
    canonicalUrl?: string;
    ogImage?: string;
    authoredAt?: string;
    modifiedAt?: string;
    authorName?: string;
    keywords?: string[];
  };
  hero: { url: string; alt: string };
  stats?: Array<{ value: string; label: string }>;
  toc: string[];
  intro: string;
  sections: Array<{
    heading: string;
    blocks: Array<
      | { type: "p"; text: string }
      | { type: "h3"; text: string }
      | { type: "ul"; items: string[] }
      | { type: "ol"; items: string[] }
      | { type: "keyTakeaway"; label: string; body: string }
      | { type: "readNext"; label: string; links: Array<{ label: string; url: string }> }
      | {
          type: "cta";
          heading: string;
          body: string;
          linkUrl: string;
          linkLabel: string;
        }
    >;
  }>;
  faqs: Array<{ q: string; a: string }>;
  related?: Array<{
    title: string;
    dek: string;
    url: string;
    thumbUrl?: string;
    category?: string;
  }>;
};

export type BlogCtaConfig = {
  heading: string;
  body: string;
  linkUrl: string;
  linkLabel: string;
};

export type WritingRuleViolation = {
  code:
    | "banned_term"
    | "australian_english"
    | "primary_keyword"
    | "word_count"
    | "schema";
  message: string;
  sentence?: string;
};

export type WordCountGateOptions = {
  minSectionWordCount?: number;
  minTotalWordCount?: number;
  minParagraphsPerSection?: number;
};

export type WordCountGateStats = {
  totalWordCount: number;
  introWordCount: number;
  sections: Array<{
    index: number;
    heading: string;
    paragraphCount: number;
    wordCount: number;
  }>;
  minSectionWordCount: number;
  minTotalWordCount: number;
  minParagraphsPerSection: number;
};

export type WordCountGateViolation = WritingRuleViolation & {
  code: "word_count";
  stats: WordCountGateStats;
};

export const WORD_COUNT_GATE_DEFAULTS = {
  minSectionWordCount: 100,
  minTotalWordCount: 800,
  minParagraphsPerSection: 3,
} as const;

export type EmDashStripResult<T> = {
  value: T;
  replacements: Array<{ before: string; after: string }>;
};

export const BANNED_TERMS = [
  "delve",
  "delved",
  "delving",
  "leverage",
  "leveraging",
  "leveraged",
  "unleash",
  "unleashing",
  "revolutionise",
  "revolutionize",
  "revolutionary",
  "game-changer",
  "game changing",
  "game-changing",
  "synergy",
  "synergies",
  "synergistic",
  "seamless",
  "seamlessly",
  "robust",
  "cutting-edge",
  "world-class",
  "best-in-class",
  "paradigm shift",
  "harness",
  "harnessing",
  "elevate",
  "elevating",
  // TODO: Replace naive contains checks with contextual checks once tenant
  // voice controls exist.
  "unlock",
  "journey",
  "tapestry",
  "realm",
  "vibrant",
  "bustling",
  "nestled",
] as const;

const US_SPELLINGS = [
  "organize",
  "optimize",
  "color",
  "center",
  "behavior",
  "favorite",
] as const;

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function allStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(allStrings);
  return Object.values(value).flatMap(allStrings);
}

function sentenceContaining(text: string, needle: string): string {
  const escaped = escapeRegExp(needle);
  const match = text.match(new RegExp(`[^.!?]*${escaped}[^.!?]*[.!?]?`, "i"));
  return (match?.[0] ?? text).trim();
}

function containsTerm(text: string, term: string): boolean {
  const escaped = escapeRegExp(term);
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(text);
}

function countWords(input: string): number {
  return input.trim().split(/\s+/).filter(Boolean).length;
}

export function tenantBannedTerms(settings: unknown): string[] {
  const record =
    settings && typeof settings === "object" && !Array.isArray(settings)
      ? (settings as Record<string, unknown>)
      : {};
  const blog =
    record.blog && typeof record.blog === "object" && !Array.isArray(record.blog)
      ? (record.blog as Record<string, unknown>)
      : {};
  const nestedBlog =
    record.forumConfig &&
    typeof record.forumConfig === "object" &&
    !Array.isArray(record.forumConfig) &&
    (record.forumConfig as Record<string, unknown>).blog &&
    typeof (record.forumConfig as Record<string, unknown>).blog === "object"
      ? ((record.forumConfig as Record<string, unknown>).blog as Record<string, unknown>)
      : {};

  const terms = [blog.bannedTerms, blog.banned_terms, nestedBlog.bannedTerms, nestedBlog.banned_terms]
    .flatMap((value) => (Array.isArray(value) ? value : []))
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);

  return Array.from(new Set([...BANNED_TERMS, ...terms.map((term) => term.trim())]));
}

export function findBannedTerm(
  post: BlogPostJson,
  bannedTerms: readonly string[]
): WritingRuleViolation | null {
  for (const text of allStrings(post)) {
    for (const term of bannedTerms) {
      if (containsTerm(text, term)) {
        return {
          code: "banned_term",
          message: `Banned term found: ${term}`,
          sentence: sentenceContaining(text, term),
        };
      }
    }
  }

  return null;
}

export function findAustralianEnglishViolation(
  post: BlogPostJson
): WritingRuleViolation | null {
  for (const text of allStrings(post)) {
    for (const spelling of US_SPELLINGS) {
      if (containsTerm(text, spelling)) {
        return {
          code: "australian_english",
          message: `US spelling found: ${spelling}`,
          sentence: sentenceContaining(text, spelling),
        };
      }
    }
  }

  return null;
}

export function stripEmDashes<T>(value: T): EmDashStripResult<T> {
  const replacements: Array<{ before: string; after: string }> = [];

  function visit(input: unknown): unknown {
    if (typeof input === "string") {
      const output = input
        .replace(/\s*[—–]\s*/g, ". ")
        .replace(/\s+--\s+/g, ". ")
        .replace(/\.\s+([a-z])/g, (_match, letter: string) => `. ${letter.toUpperCase()}`);

      if (output !== input) replacements.push({ before: input, after: output });
      return output;
    }

    if (Array.isArray(input)) return input.map(visit);
    if (!input || typeof input !== "object") return input;
    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>).map(([key, nested]) => [
        key,
        visit(nested),
      ])
    );
  }

  return { value: visit(value) as T, replacements };
}

export function enforceCtaConfig(post: BlogPostJson, cta: BlogCtaConfig): BlogPostJson {
  return {
    ...post,
    sections: post.sections.map((section) => ({
      ...section,
      blocks: section.blocks.map((block) =>
        block.type === "cta"
          ? {
              ...block,
              heading: cta.heading,
              body: cta.body,
              linkUrl: cta.linkUrl,
              linkLabel: cta.linkLabel,
            }
          : block
      ),
    })),
  };
}

export function validatePrimaryKeywordPlacement(
  post: BlogPostJson,
  primaryKeyword: string
): WritingRuleViolation | null {
  const keyword = primaryKeyword.trim().toLowerCase();
  if (!keyword) {
    return {
      code: "primary_keyword",
      message: "Primary keyword is required for create decisions.",
    };
  }

  const firstIntroWords = post.intro.trim().split(/\s+/).slice(0, 100).join(" ");
  const checks = [
    { label: "title", value: post.title },
    { label: "first 100 words of intro", value: firstIntroWords },
    {
      label: "at least one H2 section heading",
      value: post.sections.map((section) => section.heading).join(" "),
    },
    { label: "seo.metaDescription", value: post.seo?.metaDescription ?? "" },
  ];

  const failed = checks.find(
    (check) => !check.value.toLowerCase().includes(keyword)
  );

  if (!failed) return null;

  return {
    code: "primary_keyword",
    message: `Primary keyword "${primaryKeyword}" missing from ${failed.label}.`,
  };
}

export function wordCountGateStats(
  post: BlogPostJson,
  options: WordCountGateOptions = {}
): WordCountGateStats {
  const minSectionWordCount =
    options.minSectionWordCount ?? WORD_COUNT_GATE_DEFAULTS.minSectionWordCount;
  const minTotalWordCount =
    options.minTotalWordCount ?? WORD_COUNT_GATE_DEFAULTS.minTotalWordCount;
  const minParagraphsPerSection =
    options.minParagraphsPerSection ??
    WORD_COUNT_GATE_DEFAULTS.minParagraphsPerSection;

  const sections = post.sections.map((section, index) => {
    const paragraphBlocks = section.blocks.filter((block) => block.type === "p");
    const wordCount = paragraphBlocks.reduce(
      (total, block) => total + countWords(block.text),
      0
    );

    return {
      index,
      heading: section.heading,
      paragraphCount: paragraphBlocks.length,
      wordCount,
    };
  });

  const introWordCount = countWords(post.intro ?? "");

  return {
    totalWordCount:
      introWordCount + sections.reduce((total, section) => total + section.wordCount, 0),
    introWordCount,
    sections,
    minSectionWordCount,
    minTotalWordCount,
    minParagraphsPerSection,
  };
}

export function validateWordCountGates(
  post: BlogPostJson,
  options: WordCountGateOptions = {}
): WordCountGateViolation | null {
  const stats = wordCountGateStats(post, options);

  const paragraphFailure = stats.sections.find(
    (section) => section.paragraphCount < stats.minParagraphsPerSection
  );
  if (paragraphFailure) {
    return {
      code: "word_count",
      message: `Word-count quality gate failed: section ${
        paragraphFailure.index + 1
      } "${paragraphFailure.heading}" has ${paragraphFailure.paragraphCount} paragraph block(s), below the required ${stats.minParagraphsPerSection}.`,
      stats,
    };
  }

  const sectionFailure = stats.sections.find(
    (section) => section.wordCount < stats.minSectionWordCount
  );
  if (sectionFailure) {
    return {
      code: "word_count",
      message: `Word-count quality gate failed: section ${
        sectionFailure.index + 1
      } "${sectionFailure.heading}" has ${sectionFailure.wordCount} paragraph words, below the required ${stats.minSectionWordCount}.`,
      stats,
    };
  }

  if (stats.totalWordCount < stats.minTotalWordCount) {
    return {
      code: "word_count",
      message: `Word-count quality gate failed: article body has ${stats.totalWordCount} intro and paragraph words, below the required ${stats.minTotalWordCount}.`,
      stats,
    };
  }

  return null;
}

export function validatePostStructure(post: BlogPostJson): WritingRuleViolation | null {
  const failures = [
    post.stats && post.stats.length !== 4
      ? `post.stats must contain exactly 4 items when present`
      : null,
    post.toc.length !== 3 ? `post.toc must contain exactly 3 items` : null,
    post.sections.length < 4 || post.sections.length > 10
      ? `post.sections must contain between 4 and 10 items`
      : null,
    post.faqs.length < 3 ? `post.faqs must contain at least 3 items` : null,
    post.related && post.related.length !== 4
      ? `post.related must contain exactly 4 items when present`
      : null,
  ].filter((failure): failure is string => Boolean(failure));

  if (failures.length === 0) return null;

  return {
    code: "schema",
    message: `post.json failed schema validation: ${failures.join("; ")}`,
  };
}

export function slugIsValid(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}
