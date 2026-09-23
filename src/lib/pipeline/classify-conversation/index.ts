import OpenAI from "openai";

import type { SearchIntent, TenantSeoStrategy } from "../editorial-brief";

export interface ClassifiedConversation {
  topic: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  searchIntent: SearchIntent;
  articleType: string;
  audience: string;
  confidence: number;
  sourceEvidence: Array<{ role: string; excerpt: string; turnIndex: number }>;
  needsReview: boolean;
  reviewReasons: string[];
}

export type ConversationMessage = { role: string; content: string };

type ClassifierDeps = {
  createCompletion?: (messages: Array<{ role: "system" | "user"; content: string }>) => Promise<string>;
};

const SEARCH_INTENTS = new Set<SearchIntent>([
  "informational",
  "commercial",
  "transactional",
  "navigational",
]);

const ARTICLE_TYPE_RECOMMENDATIONS = [
  "guide",
  "comparison",
  "pricing",
  "explainer",
  "listicle",
  "case-study",
  "faq",
  "landing-support",
];

const CLASSIFICATION_PROMPT = `You are an SEO metadata classifier for website conversations.

Return valid JSON only. Separate the subject matter, keyword target, search intent, content format, audience, and source evidence.

Fields:
- topic: the subject matter in plain language, not a search query
- primaryKeyword: the specific SEO query to target
- secondaryKeywords: supporting keywords or questions
- searchIntent: one of informational, commercial, transactional, navigational
- articleType: a concise free-text content format. Recommended values include guide, comparison, pricing, explainer, listicle, case-study, faq, landing-support, but use a better tenant-appropriate value when needed
- audience: a persona noun or role noun, not a keyword phrase or question
- confidence: number from 0 to 1
- sourceEvidence: brief supporting excerpts with role and turnIndex

Use only tenant strategy details supplied by the user message. Do not invent services, audiences, claims, locations, or links.`;

function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  return new OpenAI({ apiKey });
}

function cleanString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function clampConfidence(value: unknown): number {
  const number = typeof value === "number" && Number.isFinite(value) ? value : 0.5;
  return Math.max(0, Math.min(1, number));
}

function normaliseSearchIntent(value: unknown): SearchIntent {
  const raw = cleanString(value)?.toLowerCase();
  if (raw && SEARCH_INTENTS.has(raw as SearchIntent)) return raw as SearchIntent;
  return "informational";
}

function normaliseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(cleanString)
    .filter((item): item is string => Boolean(item))
    .slice(0, 8);
}

function normaliseText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looseEquals(a: string, b: string): boolean {
  return normaliseText(a) === normaliseText(b);
}

function looseIncludes(a: string, b: string): boolean {
  const left = normaliseText(a);
  const right = normaliseText(b);
  return Boolean(left && right && (left.includes(right) || right.includes(left)));
}

function wordCount(value: string): number {
  return normaliseText(value).split(/\s+/).filter(Boolean).length;
}

function hasPersonaSignal(value: string): boolean {
  return /\b(owner|manager|leader|director|operator|team|planner|parent|family|client|customer|patient|student|professional|specialist|advisor|founder|resident|member|partner|user|administrator|coordinator|practitioner|household|organisation|business|person|people)\b/i.test(
    value,
  );
}

export function validateAudience(params: {
  audience: string;
  primaryKeyword: string;
  tenantSeoStrategy?: TenantSeoStrategy | null;
}): { audience: string; needsReview: boolean; reviewReasons: string[] } {
  const reviewReasons: string[] = [];
  const cleanedAudience = cleanString(params.audience) ?? "unknown";
  const primaryKeyword = cleanString(params.primaryKeyword) ?? "";
  const targetAudiences = params.tenantSeoStrategy?.targetAudiences ?? [];
  const matched = targetAudiences.find((candidate) => {
    const persona = cleanString(candidate.persona);
    if (!persona) return false;
    return looseEquals(cleanedAudience, persona) || looseIncludes(cleanedAudience, persona);
  });

  let audience = matched?.persona ?? cleanedAudience;

  if (targetAudiences.length > 0 && !matched) {
    audience = "unknown";
    reviewReasons.push("Audience did not match a configured tenant persona.");
  }

  const lowerAudience = normaliseText(cleanedAudience);
  const lowerKeyword = normaliseText(primaryKeyword);
  const queryLike =
    /\b(how|what|cost|rates|price|near me)\b/i.test(cleanedAudience) ||
    cleanedAudience.trim().endsWith("?");
  const phraseLike =
    Boolean(lowerAudience && lowerKeyword && lowerAudience === lowerKeyword) ||
    (wordCount(cleanedAudience) >= 4 && looseIncludes(cleanedAudience, primaryKeyword));

  if (phraseLike || queryLike || !hasPersonaSignal(cleanedAudience)) {
    audience = targetAudiences[0]?.persona ?? "unknown";
    reviewReasons.push("Audience looked like a keyword phrase rather than a persona.");
  }

  return {
    audience,
    needsReview: reviewReasons.length > 0,
    reviewReasons,
  };
}

function fallbackEvidence(messages: ConversationMessage[]) {
  return messages.slice(0, 3).map((message, index) => ({
    role: message.role,
    excerpt: message.content.slice(0, 220),
    turnIndex: index,
  }));
}

function normaliseEvidence(value: unknown, messages: ConversationMessage[]) {
  if (!Array.isArray(value)) return fallbackEvidence(messages);
  const evidence = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const role = cleanString(record.role);
      const excerpt = cleanString(record.excerpt ?? record.snippet);
      const turnIndex = typeof record.turnIndex === "number" ? record.turnIndex : null;
      if (!role || !excerpt || turnIndex === null) return null;
      return { role, excerpt: excerpt.slice(0, 240), turnIndex };
    })
    .filter((item): item is { role: string; excerpt: string; turnIndex: number } => Boolean(item))
    .slice(0, 5);
  return evidence.length > 0 ? evidence : fallbackEvidence(messages);
}

function neutralClassification(
  messages: ConversationMessage[],
  reviewReasons: string[],
): ClassifiedConversation {
  const topic = messages.find((message) => message.role === "user")?.content.slice(0, 80) || "Conversation topic";
  return {
    topic,
    primaryKeyword: topic,
    secondaryKeywords: [],
    searchIntent: "informational",
    articleType: "guide",
    audience: "unknown",
    confidence: 0.5,
    sourceEvidence: fallbackEvidence(messages),
    needsReview: true,
    reviewReasons,
  };
}

function strategyForPrompt(strategy: TenantSeoStrategy | null | undefined) {
  if (!strategy) return null;
  return {
    targetKeywords: strategy.targetKeywords,
    priorityServices: strategy.priorityServices,
    priorityLocations: strategy.priorityLocations,
    targetAudiences: strategy.targetAudiences,
    avoidTopics: strategy.avoidTopics,
    avoidClaims: strategy.avoidClaims,
    avoidKeywords: strategy.avoidKeywords,
  };
}

export async function classifyConversation(params: {
  conversationMessages: ConversationMessage[];
  tenantSeoStrategy?: TenantSeoStrategy | null;
  deps?: ClassifierDeps;
}): Promise<ClassifiedConversation> {
  const transcript = params.conversationMessages
    .map((message, index) => `[${index}] ${message.role.toUpperCase()}: ${message.content}`)
    .join("\n\n");
  const userPayload = JSON.stringify(
    {
      articleTypeRecommendations: ARTICLE_TYPE_RECOMMENDATIONS,
      tenantSeoStrategy: strategyForPrompt(params.tenantSeoStrategy),
      transcript,
    },
    null,
    2,
  );

  const createCompletion =
    params.deps?.createCompletion ??
    (async (messages: Array<{ role: "system" | "user"; content: string }>) => {
      const response = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.3,
        messages,
        response_format: { type: "json_object" },
      });
      const raw = response.choices[0]?.message?.content;
      if (!raw) throw new Error("No response from conversation classification");
      return raw;
    });

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(
      await createCompletion([
        { role: "system", content: CLASSIFICATION_PROMPT },
        { role: "user", content: userPayload },
      ]),
    ) as Record<string, unknown>;
  } catch {
    return neutralClassification(params.conversationMessages, [
      "Classifier returned malformed JSON.",
    ]);
  }

  const topic = cleanString(parsed.topic);
  const primaryKeyword = cleanString(parsed.primaryKeyword);
  const articleType = cleanString(parsed.articleType);
  const reviewReasons = normaliseStringArray(parsed.reviewReasons);

  if (!topic) reviewReasons.push("Classifier did not return a topic.");
  if (!primaryKeyword) reviewReasons.push("Classifier did not return a primary keyword.");
  if (!articleType) reviewReasons.push("Classifier did not return an article type.");

  const candidate = {
    topic: topic ?? primaryKeyword ?? "Conversation topic",
    primaryKeyword: primaryKeyword ?? topic ?? "Conversation topic",
    secondaryKeywords: normaliseStringArray(parsed.secondaryKeywords),
    searchIntent: normaliseSearchIntent(parsed.searchIntent),
    articleType: articleType ?? "guide",
    audience: cleanString(parsed.audience) ?? "unknown",
    confidence: clampConfidence(parsed.confidence),
    sourceEvidence: normaliseEvidence(parsed.sourceEvidence, params.conversationMessages),
    needsReview: Boolean(parsed.needsReview),
    reviewReasons,
  };

  const audienceValidation = validateAudience({
    audience: candidate.audience,
    primaryKeyword: candidate.primaryKeyword,
    tenantSeoStrategy: params.tenantSeoStrategy,
  });

  return {
    ...candidate,
    audience: audienceValidation.audience,
    needsReview:
      candidate.needsReview ||
      reviewReasons.length > 0 ||
      audienceValidation.needsReview,
    reviewReasons: [...reviewReasons, ...audienceValidation.reviewReasons],
  };
}
