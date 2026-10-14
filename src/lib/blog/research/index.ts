import type { SearchIntent } from "@/lib/pipeline/editorial-brief";

export type ResearchProviderId = "manual" | "dataforseo";

export type KeywordOpportunity = {
  keyword: string;
  intent?: SearchIntent | null;
  volume?: number | null;
  difficulty?: number | null;
  cpc?: number | null;
  source: ResearchProviderId | "tenant_strategy" | "conversation";
};

export type SerpCompetitor = {
  title: string;
  url?: string | null;
  domain?: string | null;
  position?: number | null;
  headings?: string[];
  summary?: string | null;
};

export type ResearchArtifact = {
  provider: ResearchProviderId;
  queriedAt: string;
  primaryKeyword: string | null;
  searchIntent: SearchIntent | null;
  keywordOpportunities: KeywordOpportunity[];
  serpCompetitors: SerpCompetitor[];
  relatedQuestions: string[];
  entities: string[];
  contentGaps: string[];
  notes: string[];
  raw?: unknown;
};

export type BlogResearchInput = {
  tenantId: string;
  conversationId: string;
  primaryKeyword?: string | null;
  secondaryKeywords?: string[];
  searchIntent?: SearchIntent | null;
  topic?: string | null;
  audience?: string | null;
};

export type BlogResearchProvider = {
  id: ResearchProviderId;
  research(input: BlogResearchInput): Promise<ResearchArtifact>;
};

export class BlogResearchProviderError extends Error {
  readonly provider: ResearchProviderId;
  readonly causeCode: string;

  constructor(params: {
    provider: ResearchProviderId;
    causeCode: string;
    message: string;
  }) {
    super(params.message);
    this.name = "BlogResearchProviderError";
    this.provider = params.provider;
    this.causeCode = params.causeCode;
  }
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function nowIso(now: Date | string | undefined) {
  if (!now) return new Date().toISOString();
  return typeof now === "string" ? new Date(now).toISOString() : now.toISOString();
}

function inferRelatedQuestions(input: BlogResearchInput) {
  const topic = input.primaryKeyword ?? input.topic;
  if (!topic) return [];
  return [
    `What should people know about ${topic}?`,
    `How does ${topic} work?`,
    `When should ${input.audience ?? "customers"} act on ${topic}?`,
  ];
}

function inferContentGaps(input: BlogResearchInput) {
  const gaps = [
    "Use the source conversation as original demand evidence.",
    "Add tenant-specific proof points before publishing.",
  ];
  if (!input.primaryKeyword) {
    gaps.push("Confirm the primary keyword before drafting.");
  }
  if (!input.secondaryKeywords || input.secondaryKeywords.length === 0) {
    gaps.push("Add supporting queries from live keyword research when available.");
  }
  return gaps;
}

export function buildManualResearchArtifact(
  input: BlogResearchInput,
  options: {
    now?: Date | string;
    competitors?: SerpCompetitor[];
    relatedQuestions?: string[];
    entities?: string[];
    contentGaps?: string[];
    notes?: string[];
  } = {},
): ResearchArtifact {
  const primaryKeyword = input.primaryKeyword?.trim() || input.topic?.trim() || null;
  const keywordOpportunities = uniqueStrings([
    primaryKeyword,
    ...(input.secondaryKeywords ?? []),
  ]).map((keyword, index) => ({
    keyword,
    intent: index === 0 ? input.searchIntent ?? null : null,
    volume: null,
    difficulty: null,
    cpc: null,
    source: index === 0 ? "conversation" : "tenant_strategy",
  }));

  return {
    provider: "manual",
    queriedAt: nowIso(options.now),
    primaryKeyword,
    searchIntent: input.searchIntent ?? null,
    keywordOpportunities,
    serpCompetitors: options.competitors ?? [],
    relatedQuestions:
      options.relatedQuestions ?? inferRelatedQuestions({ ...input, primaryKeyword }),
    entities: uniqueStrings(options.entities ?? [input.topic, input.audience]),
    contentGaps: options.contentGaps ?? inferContentGaps(input),
    notes:
      options.notes ??
      [
        "Manual research fallback. Replace with DataForSEO artifact before production-scale generation.",
      ],
  };
}

export function createManualResearchProvider(options?: {
  now?: Date | string;
  artifactsByConversationId?: Record<string, ResearchArtifact>;
  defaultCompetitors?: SerpCompetitor[];
}): BlogResearchProvider {
  return {
    id: "manual",
    async research(input) {
      const existing = options?.artifactsByConversationId?.[input.conversationId];
      if (existing) return existing;
      return buildManualResearchArtifact(input, {
        now: options?.now,
        competitors: options?.defaultCompetitors,
      });
    },
  };
}

export async function runBlogResearch(params: {
  input: BlogResearchInput;
  provider?: BlogResearchProvider | null;
}): Promise<ResearchArtifact> {
  const provider = params.provider ?? createManualResearchProvider();
  return provider.research(params.input);
}

