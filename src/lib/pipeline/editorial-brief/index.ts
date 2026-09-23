import type {
  ArticleSeoFields,
  EditorialBrief,
  EditorialBriefDecision,
  EditorialBriefMessage,
  RequiredModules,
  SearchIntent,
  TenantSeoStrategy,
  TopicType,
} from "./types";
import type { ClassifiedConversation } from "../classify-conversation";

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

function inferArticleType(intent: SearchIntent, text: string): string {
  const lower = text.toLowerCase();
  if (/compare|versus| vs /.test(lower)) return "comparison";
  if (/price|cost|quote|fee/.test(lower)) return "pricing";
  if (/\bfaq\b|question|questions/.test(lower)) return "faq";
  if (/case study|example result/.test(lower)) return "case-study";
  if (intent === "commercial") return "landing-support";
  return "guide";
}

const MODULES_BY_ARTICLE_TYPE: Record<string, string[]> = {
  guide: ["quick-answer", "checklist"],
  comparison: ["quick-answer", "comparison"],
  pricing: ["quick-answer", "pricing"],
  explainer: ["quick-answer", "checklist"],
  listicle: ["quick-answer", "checklist"],
  "case-study": ["quick-answer"],
  faq: ["quick-answer", "faq"],
  "landing-support": ["quick-answer", "cta"],
};

const RATES_TOPIC_TRIGGERS = [
  "rates",
  "rate",
  "cost",
  "costs",
  "pricing",
  "price",
  "quote",
  "quotes",
  "fee",
  "fees",
  "$/hr",
  "per hour",
  "hourly",
  "day rate",
  "per acre",
  "per hectare",
  "price list",
  "how much",
];

const RATES_TOPIC_PATTERNS = RATES_TOPIC_TRIGGERS.map((trigger) => {
  if (trigger === "$/hr") return /\$\/hr/i;
  const escaped = trigger.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");
});

const GENERAL_REQUIRED_MODULES: RequiredModules = {
  quickAnswer: false,
  rateTableOrFallback: false,
  quoteDrivers: false,
  checklist: false,
  cta: false,
  faq: false,
  internalLinks: false,
};

const RATES_REQUIRED_MODULES: RequiredModules = {
  quickAnswer: true,
  rateTableOrFallback: true,
  quoteDrivers: true,
  checklist: true,
  cta: true,
  faq: true,
  internalLinks: true,
};

function detectTopicTypeFromQueries(values: string[]): TopicType {
  const queryText = values
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
  if (!queryText) return "general";
  return RATES_TOPIC_PATTERNS.some((pattern) => pattern.test(queryText))
    ? "rates"
    : "general";
}

export function detectTopicType(params: {
  primaryKeyword?: string | null;
  secondaryKeywords?: string[];
  articleType?: string | null;
  searchIntent?: SearchIntent | null;
}): TopicType {
  const primarySignals = [
    params.primaryKeyword ?? "",
    ...(params.secondaryKeywords ?? []),
  ];
  const queryTopic = detectTopicTypeFromQueries(primarySignals);
  if (queryTopic !== "general") return queryTopic;

  const articleType = params.articleType?.trim().toLowerCase() ?? "";
  if (articleType === "pricing") return "rates";
  if (params.searchIntent === "commercial" && detectTopicTypeFromQueries([articleType]) === "rates") {
    return "rates";
  }
  return "general";
}

export function requiredModulesForTopicType(
  topicType: TopicType,
  params: { hasLinks: boolean; hasCta: boolean }
): RequiredModules {
  if (topicType === "rates") {
    return {
      ...RATES_REQUIRED_MODULES,
      internalLinks: true,
      cta: true,
    };
  }

  return {
    ...GENERAL_REQUIRED_MODULES,
    internalLinks: params.hasLinks,
    cta: params.hasCta,
  };
}

function requiredModuleNames(contract: RequiredModules): string[] {
  const modules: string[] = [];
  if (contract.quickAnswer) modules.push("quick-answer");
  if (contract.rateTableOrFallback) modules.push("rate-table-or-fallback");
  if (contract.quoteDrivers) modules.push("quote-drivers");
  if (contract.checklist) modules.push("checklist");
  if (contract.cta) modules.push("cta");
  if (contract.faq) modules.push("faq");
  if (contract.internalLinks) modules.push("internal-links");
  return modules;
}

export function modulesForArticleType(params: {
  searchIntent: SearchIntent;
  articleType: string;
  hasLinks: boolean;
  hasCta: boolean;
}) {
  const normalisedType = params.articleType.trim().toLowerCase();
  const modules = new Set<string>(MODULES_BY_ARTICLE_TYPE[normalisedType] ?? MODULES_BY_ARTICLE_TYPE.guide);
  if (params.searchIntent === "commercial" || params.searchIntent === "transactional") modules.add("cta");
  if (params.hasLinks) modules.add("internal-links");
  if (params.hasCta) modules.add("cta");
  return Array.from(modules);
}

function modulesFor(intent: SearchIntent, articleType: string, hasLinks: boolean, hasCta: boolean) {
  return modulesForArticleType({
    searchIntent: intent,
    articleType,
    hasLinks,
    hasCta,
  });
}

function evidenceFromClassification(classification: ClassifiedConversation) {
  return classification.sourceEvidence.map((item) => ({
    role: item.role,
    snippet: item.excerpt,
  }));
}

function hasClassification(params: {
  classification?: ClassifiedConversation | null;
}): params is { classification: ClassifiedConversation } {
  return Boolean(params.classification);
}

function classifiedSelectionRationale(classification: ClassifiedConversation): string {
  return classification.needsReview
    ? `Classifier selected "${classification.primaryKeyword}" with review required.`
    : `Classifier selected "${classification.primaryKeyword}" from the source conversation.`;
}

function reviewFallbacks(classification: ClassifiedConversation) {
  return classification.reviewReasons.map((reason) => ({
    field: "classification",
    fallback_strategy: reason,
  }));
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function moduleSelection(intent: SearchIntent, articleType: string, hasLinks: boolean, hasCta: boolean) {
  const modules = new Set<string>(["quick-answer"]);
  for (const moduleName of modulesFor(intent, articleType, hasLinks, hasCta)) modules.add(moduleName);
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
  classification?: ClassifiedConversation | null;
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
  const noStrongTarget = hasClassification(params) ? false : !selected || selected.score <= 3;
  const fallbackKeyword =
    decisionKeyword && !textIncludesAny(decisionKeyword, avoided) ? decisionKeyword : null;
  const selectedPrimaryKeyword = hasClassification(params)
    ? params.classification.primaryKeyword
    : noStrongTarget
      ? fallbackKeyword
      : selected.keyword;
  const searchIntent = hasClassification(params)
    ? params.classification.searchIntent
    : normaliseIntent(params.decision.intent);
  const articleType = hasClassification(params)
    ? params.classification.articleType
    : inferArticleType(searchIntent, `${transcript}\n${selectedPrimaryKeyword ?? ""}`);
  const audience =
    hasClassification(params)
      ? strategy.targetAudiences.find((candidate) => candidate.persona === params.classification.audience) ??
        (params.classification.audience
          ? { persona: params.classification.audience, description: undefined }
          : null)
      :
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
  const topicType = detectTopicType({
    primaryKeyword: selectedPrimaryKeyword,
    secondaryKeywords: hasClassification(params)
      ? params.classification.secondaryKeywords
      : candidates
          .filter((candidate) => candidate.keyword !== selectedPrimaryKeyword)
          .slice(0, 5)
          .map((candidate) => candidate.keyword),
    articleType,
    searchIntent,
  });
  const requiredModuleContract = requiredModulesForTopicType(topicType, {
    hasLinks: links.length > 0,
    hasCta: Boolean(cta),
  });
  const selectedModules =
    topicType === "rates"
      ? requiredModuleNames(requiredModuleContract)
      : moduleSelection(searchIntent, articleType, links.length > 0, Boolean(cta));

  return {
    conversationId: params.conversationId,
    tenantId: params.tenantId,
    selectedPrimaryKeyword,
    selectionRationale: hasClassification(params)
      ? classifiedSelectionRationale(params.classification)
      : noStrongTarget
      ? "No tenant SEO target strongly matched the source conversation."
      : `Selected "${selected.keyword}" because it best matched the conversation and tenant priority.`,
    supportingKeywords: hasClassification(params)
      ? uniqueStrings(params.classification.secondaryKeywords)
      : candidates
          .filter((candidate) => candidate.keyword !== selectedPrimaryKeyword)
          .slice(0, 5)
          .map((candidate) => candidate.keyword),
    supportingEntities: [
      ...strategy.priorityServices.map((service) => service.name),
      ...strategy.priorityLocations.map((location) => location.name),
    ].filter((entity) => textIncludesAny(transcript, [entity])),
    conversationEvidence: hasClassification(params)
      ? evidenceFromClassification(params.classification)
      : params.messages
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
      ...(hasClassification(params) ? reviewFallbacks(params.classification) : []),
    ],
    requiredModules: selectedModules,
    requiredModuleContract,
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
    needsReview: noStrongTarget || (hasClassification(params) && params.classification.needsReview),
    searchIntent,
    topicType,
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
  const rawContent = (params.article.content ?? "").toLowerCase();
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

  if (params.brief.topicType === "rates" && rawContent.includes("<")) {
    if (!/<aside[^>]*class=["'][^"']*quick-answer/i.test(rawContent)) {
      issues.push({ code: "quick_answer_missing", message: "Rates article is missing a quick-answer callout." });
    }
    if (!/<table[\s>]/i.test(rawContent) && !/data-fallback=["']no-rate-data["']/i.test(rawContent)) {
      issues.push({ code: "rate_table_missing", message: "Rates article is missing a rate table or no-rate-data fallback." });
    }
    if (!/<ul[^>]*class=["'][^"']*checklist/i.test(rawContent)) {
      issues.push({ code: "checklist_missing", message: "Rates article is missing a checklist block." });
    }
  }

  return issues;
}

export * from "./types";
