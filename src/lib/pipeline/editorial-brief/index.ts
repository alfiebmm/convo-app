import type {
  ArticleSeoFields,
  ArticleType,
  EditorialBrief,
  EditorialBriefDecision,
  EditorialBriefMessage,
  SearchIntent,
  TenantSeoStrategy,
} from "./types";

const PRIORITY_WEIGHT = { high: 3, medium: 2, low: 1 } as const;
const SEARCH_INTENTS = new Set<SearchIntent>([
  "informational",
  "commercial",
  "transactional",
  "navigational",
]);
export const EMPTY_TENANT_SEO_STRATEGY: Omit<TenantSeoStrategy, "tenantId"> = {
  targetKeywords: [],
  priorityServices: [],
  priorityLocations: [],
  targetAudiences: [],
  approvedInternalUrls: [],
  preferredCtas: [],
  avoidTopics: [],
  avoidClaims: [],
  avoidKeywords: [],
  revision: 1,
};

function clean(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function words(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

function textIncludesAny(haystack: string, needles: string[]) {
  const normalised = haystack.toLowerCase();
  return needles.some((needle) => normalised.includes(needle.toLowerCase()));
}

function overlapScore(a: string, b: string): number {
  const aWords = new Set(words(a));
  if (aWords.size === 0) return 0;
  return words(b).filter((word) => aWords.has(word)).length;
}

function normaliseIntent(value: string | null | undefined): SearchIntent {
  const raw = value?.toLowerCase() ?? "";
  if (SEARCH_INTENTS.has(raw as SearchIntent)) return raw as SearchIntent;
  if (/price|cost|quote|buy|book|hire|service|near|local/.test(raw)) {
    return "commercial";
  }
  if (/contact|call|book|order|signup|sign up/.test(raw)) return "transactional";
  if (/brand|login|location|opening/.test(raw)) return "navigational";
  return "informational";
}

function inferArticleType(intent: SearchIntent, text: string): ArticleType {
  const lower = text.toLowerCase();
  if (/compare|versus| vs /.test(lower)) return "comparison";
  if (/price|cost|quote|fee/.test(lower)) return "pricing";
  if (/\bfaq\b|question|questions/.test(lower)) return "faq";
  if (/case study|example result/.test(lower)) return "case-study";
  if (intent === "commercial") return "landing-support";
  return "guide";
}

function modulesFor(intent: SearchIntent, articleType: ArticleType, hasLinks: boolean, hasCta: boolean) {
  const modules = new Set<string>(["quick-answer"]);
  if (articleType === "pricing") modules.add("pricing");
  if (articleType === "comparison") modules.add("comparison");
  if (articleType === "faq") modules.add("faq");
  if (articleType === "guide") modules.add("checklist");
  if (intent === "commercial" || intent === "transactional") modules.add("cta");
  if (hasLinks) modules.add("internal-links");
  if (hasCta) modules.add("cta");
  return Array.from(modules);
}

export function buildEditorialBrief(params: {
  tenantId: string;
  conversationId: string;
  strategy: TenantSeoStrategy | null;
  messages: EditorialBriefMessage[];
  decision: EditorialBriefDecision;
}): EditorialBrief {
  const strategy = params.strategy ?? {
    ...EMPTY_TENANT_SEO_STRATEGY,
    tenantId: params.tenantId,
  };
  const transcript = params.messages.map((message) => message.content).join("\n");
  const decisionKeyword = clean(params.decision.primaryKeyword);
  const avoided = [...strategy.avoidKeywords, ...strategy.avoidTopics]
    .map((item) => item.trim())
    .filter(Boolean);

  const candidates = strategy.targetKeywords
    .map((target, index) => {
      const keyword = clean(target.keyword);
      if (!keyword || textIncludesAny(keyword, avoided)) return null;
      const exact = transcript.toLowerCase().includes(keyword.toLowerCase()) ? 6 : 0;
      const decisionOverlap = decisionKeyword ? overlapScore(keyword, decisionKeyword) * 2 : 0;
      const transcriptOverlap = overlapScore(keyword, transcript);
      const score =
        exact +
        decisionOverlap +
        transcriptOverlap +
        (PRIORITY_WEIGHT[target.priority] ?? 1);
      return { index, keyword, target, score };
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const selected = candidates[0] ?? null;
  const noStrongTarget = !selected || selected.score <= 3;
  const fallbackKeyword =
    decisionKeyword && !textIncludesAny(decisionKeyword, avoided) ? decisionKeyword : null;
  const selectedPrimaryKeyword = noStrongTarget ? fallbackKeyword : selected.keyword;
  const searchIntent = normaliseIntent(params.decision.intent);
  const articleType = inferArticleType(searchIntent, `${transcript}\n${selectedPrimaryKeyword ?? ""}`);
  const audience =
    strategy.targetAudiences.find((candidate) =>
      textIncludesAny(transcript, [candidate.persona, candidate.description ?? ""]),
    ) ?? strategy.targetAudiences[0] ?? null;
  const links = strategy.approvedInternalUrls
    .filter((link) =>
      selectedPrimaryKeyword
        ? textIncludesAny(
            [link.label, link.topic, link.url].filter(Boolean).join(" "),
            [selectedPrimaryKeyword],
          ) || textIncludesAny(transcript, [link.topic ?? "", link.label ?? ""])
        : false,
    )
    .slice(0, 3)
    .map((link) => ({
      url: link.url,
      label: link.label,
      reason: link.topic ? `Matches ${link.topic}` : "Approved internal URL",
    }));
  const cta =
    strategy.preferredCtas.find((candidate) =>
      [candidate.article_type, candidate.audience]
        .filter(Boolean)
        .some((value) => value === articleType || value === audience?.persona),
    ) ?? strategy.preferredCtas[0] ?? null;

  return {
    conversationId: params.conversationId,
    tenantId: params.tenantId,
    selectedPrimaryKeyword,
    selectionRationale: noStrongTarget
      ? "No tenant SEO target strongly matched the source conversation."
      : `Selected "${selected.keyword}" because it best matched the conversation and tenant priority.`,
    supportingKeywords: candidates
      .filter((candidate) => candidate.keyword !== selectedPrimaryKeyword)
      .slice(0, 5)
      .map((candidate) => candidate.keyword),
    supportingEntities: [
      ...strategy.priorityServices.map((service) => service.name),
      ...strategy.priorityLocations.map((location) => location.name),
    ].filter((entity) => textIncludesAny(transcript, [entity])),
    conversationEvidence: params.messages
      .filter((message) =>
        selectedPrimaryKeyword
          ? textIncludesAny(message.content, [selectedPrimaryKeyword])
          : message.role === "user",
      )
      .slice(0, 5)
      .map((message) => ({
        messageId: message.id,
        role: message.role,
        snippet: message.content.slice(0, 240),
      })),
    tenantFactsUsed: {
      services: strategy.priorityServices.filter((service) =>
        textIncludesAny(transcript, [service.name]),
      ),
      locations: strategy.priorityLocations.filter((location) =>
        textIncludesAny(transcript, [location.name]),
      ),
      audiences: audience ? [audience] : [],
    },
    missingDataFallbacks: [
      ...(strategy.targetKeywords.length === 0
        ? [{ field: "target_keywords", fallback_strategy: "Use conversation intent and mark for review." }]
        : []),
      ...(links.length === 0
        ? [{ field: "approved_internal_urls", fallback_strategy: "Avoid invented links." }]
        : []),
    ],
    requiredModules: modulesFor(searchIntent, articleType, links.length > 0, Boolean(cta)),
    internalLinkPlan: links,
    ctaPlan: cta
      ? { label: cta.label, url: cta.url, rationale: "Tenant-preferred CTA matched the brief." }
      : {},
    createUpdateSkip:
      params.decision.action === "update"
        ? "update"
        : params.decision.action.startsWith("skip")
          ? "skip"
          : "create",
    createUpdateSkipRationale:
      params.decision.reason ?? "Derived from the blog decision phase.",
    noStrongTarget,
    needsReview: noStrongTarget,
    searchIntent,
    targetAudience: audience?.persona ?? null,
    articleType,
  };
}

export function articleSeoFromBrief(brief: EditorialBrief): ArticleSeoFields {
  return {
    primaryKeyword: brief.selectedPrimaryKeyword,
    secondaryKeywords: brief.supportingKeywords,
    searchIntent: brief.searchIntent,
    targetAudience: brief.targetAudience,
    articleType: brief.articleType,
    internalLinkSuggestions: brief.internalLinkPlan.map((link) => ({
      url: link.url,
      label: link.label,
    })),
    ctaGoal: brief.ctaPlan.label ?? null,
  };
}

function plainText(input: unknown): string {
  if (typeof input === "string") return input;
  if (!input || typeof input !== "object") return "";
  if (Array.isArray(input)) return input.map(plainText).join(" ");
  return Object.values(input as Record<string, unknown>).map(plainText).join(" ");
}

function countKeyword(text: string, keyword: string): number {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (text.match(new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "gi")) ?? []).length;
}

export function validateEditorialBriefArticle(params: {
  brief: EditorialBrief;
  article: {
    title: string;
    intro?: string;
    sections?: Array<{ heading?: string; blocks?: unknown[] }>;
    content?: string;
  };
}): Array<{ code: string; message: string }> {
  const issues: Array<{ code: string; message: string }> = [];
  const keyword = params.brief.selectedPrimaryKeyword?.trim();
  if (!keyword) return issues;

  const title = params.article.title.toLowerCase();
  const intro = (params.article.intro ?? "").toLowerCase();
  const headings = (params.article.sections ?? [])
    .map((section) => section.heading ?? "")
    .join(" ")
    .toLowerCase();
  const fullText = plainText(params.article).toLowerCase();
  const lowerKeyword = keyword.toLowerCase();

  if (!title.includes(lowerKeyword)) {
    issues.push({ code: "primary_keyword_title", message: "Primary keyword is missing from the title." });
  }
  if (!headings.includes(lowerKeyword)) {
    issues.push({ code: "primary_keyword_heading", message: "Primary keyword is missing from a heading." });
  }
  if (!intro.slice(0, 800).includes(lowerKeyword)) {
    issues.push({ code: "primary_keyword_intro", message: "Primary keyword is missing from the intro." });
  }

  const wordCount = fullText.split(/\s+/).filter(Boolean).length;
  const density = wordCount > 0 ? countKeyword(fullText, lowerKeyword) / wordCount : 0;
  if (density > 0.03) {
    issues.push({ code: "primary_keyword_density", message: "Primary keyword density is too high." });
  }

  if (
    params.brief.requiredModules.includes("internal-links") &&
    params.brief.internalLinkPlan.length > 0 &&
    !params.brief.internalLinkPlan.some((link) => fullText.includes(link.url.toLowerCase()))
  ) {
    issues.push({ code: "internal_link_missing", message: "Planned internal link is missing." });
  }

  const plannedCta = clean(params.brief.ctaPlan.label);
  if (
    params.brief.requiredModules.includes("cta") &&
    plannedCta &&
    !fullText.includes(plannedCta.toLowerCase())
  ) {
    issues.push({ code: "cta_missing", message: "Planned CTA is missing." });
  }

  return issues;
}

export * from "./types";
