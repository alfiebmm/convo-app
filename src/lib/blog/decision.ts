import { and, eq, sql } from "drizzle-orm";
import type OpenAI from "openai";

import { db } from "@/lib/db";
import {
  blogDecisionLogs,
  blogPosts,
  conversations,
  messages,
  tenants,
} from "@/lib/db/schema";
import { parseForumConfigPerSlice } from "@/lib/forum-config/validate";
import { getOpenAIClient } from "@/lib/openai";

export type DecisionAction = "create" | "update" | "skip";
export type SimilarityBand = "high" | "medium" | "low";

export interface SimilarPost {
  blog_post_id: string;
  score: number;
  title?: string;
  slug?: string;
  last_modified?: Date | null;
  word_count?: number;
  band?: SimilarityBand;
}

export interface DecisionResult {
  action: DecisionAction;
  reason: string;
  similar_posts: SimilarPost[];
  primary_keyword: string | null;
  intent: string | null;
  target_blog_post_id?: string;
  log_id?: string;
}

interface ConversationRecord {
  id: string;
  tenantId: string;
}

interface TenantRecord {
  id: string;
  settings: unknown;
}

interface MessageRecord {
  role: string;
  content: string;
}

interface KeywordIntent {
  primary_keyword: string | null;
  intent: string | null;
}

interface SimilarPostCandidate extends SimilarPost {
  content: string;
}

interface DecisionLogInput {
  tenantId: string;
  conversationId: string;
  action: DecisionAction;
  reason: string;
  similarPosts: SimilarPost[];
  primaryKeyword: string | null;
  intent: string | null;
  targetBlogPostId?: string;
  metadata: Record<string, unknown>;
}

interface DecisionStore {
  loadConversation(
    conversationId: string
  ): Promise<{ conversation: ConversationRecord; tenant: TenantRecord; messages: MessageRecord[] } | null>;
  findSimilarPosts(
    tenantId: string,
    embedding: number[],
    limit: number
  ): Promise<SimilarPostCandidate[]>;
  insertDecisionLog(input: DecisionLogInput): Promise<{ id: string }>;
}

interface DecisionAi {
  extractKeywordIntent(messages: MessageRecord[]): Promise<KeywordIntent>;
  embed(input: string): Promise<number[]>;
}

export interface DecisionConfig {
  minWordCount: number;
  staleAfterDays: number;
  similarPostLimit: number;
  now: Date;
}

interface DecisionDeps {
  store: DecisionStore;
  ai: DecisionAi;
  getConfig?: (tenantSettings: unknown) => Partial<DecisionConfig>;
}

const HIGH_SIMILARITY = 0.85;
const MEDIUM_SIMILARITY = 0.65;
const DEFAULT_MIN_WORD_COUNT = 80;
const DEFAULT_STALE_AFTER_DAYS = 90;
const DEFAULT_SIMILAR_POST_LIMIT = 5;

const EXTRACTION_PROMPT = `You are an SEO content strategist. Extract the primary SEO keyword and visitor intent from the conversation.

Return valid JSON only with:
- primary_keyword: concise search phrase, 2-8 words, or null when there is no meaningful content idea
- intent: one short intent label such as "educational", "commercial", "support", "faq", or null when unclear`;

function wordCount(input: string): number {
  return input.trim().split(/\s+/).filter(Boolean).length;
}

function transcript(messages: MessageRecord[]): string {
  return messages
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n\n")
    .trim();
}

function similarityBand(score: number): SimilarityBand {
  if (score >= HIGH_SIMILARITY) return "high";
  if (score >= MEDIUM_SIMILARITY) return "medium";
  return "low";
}

function toPgVector(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

function daysSince(date: Date | null | undefined, now: Date): number {
  if (!date) return Number.POSITIVE_INFINITY;
  return (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
}

function normalise(input: string): string {
  return input.trim().toLowerCase();
}

function matchesExclusion(
  exclusionList: readonly string[],
  extracted: KeywordIntent,
  sourceTranscript: string
): string | null {
  const haystack = normalise(
    [extracted.primary_keyword, extracted.intent, sourceTranscript]
      .filter(Boolean)
      .join(" ")
  );

  for (const term of exclusionList) {
    const needle = normalise(term);
    if (needle && haystack.includes(needle)) return term;
  }

  return null;
}

function parseDecisionConfig(settings: unknown): Partial<DecisionConfig> {
  const record =
    settings && typeof settings === "object"
      ? (settings as Record<string, unknown>)
      : {};
  const source =
    (record.blogDecision as Record<string, unknown> | undefined) ??
    (record.blog_decision as Record<string, unknown> | undefined) ??
    {};

  return {
    minWordCount:
      typeof source.minWordCount === "number"
        ? source.minWordCount
        : typeof source.min_word_count === "number"
          ? source.min_word_count
          : undefined,
    staleAfterDays:
      typeof source.staleAfterDays === "number"
        ? source.staleAfterDays
        : typeof source.stale_after_days === "number"
          ? source.stale_after_days
          : undefined,
    similarPostLimit:
      typeof source.similarPostLimit === "number"
        ? source.similarPostLimit
        : typeof source.similar_post_limit === "number"
          ? source.similar_post_limit
          : undefined,
  };
}

function tenantExclusionList(settings: unknown): string[] {
  const parsed = parseForumConfigPerSlice(settings);
  return parsed.exclusion_list;
}

function publicSimilarPosts(posts: SimilarPostCandidate[]): SimilarPost[] {
  return posts.map(({ content: _content, ...post }) => post);
}

function decideFromSimilarity(
  similarPosts: SimilarPostCandidate[],
  config: DecisionConfig
): Pick<DecisionResult, "action" | "reason" | "target_blog_post_id"> {
  const top = similarPosts[0];
  if (!top || top.score < MEDIUM_SIMILARITY) {
    return {
      action: "create",
      reason: "No existing blog post crossed the medium similarity threshold.",
    };
  }

  if (top.score >= HIGH_SIMILARITY) {
    return {
      action: "update",
      target_blog_post_id: top.blog_post_id,
      reason: `Most similar post is in the high similarity band (${top.score.toFixed(3)}).`,
    };
  }

  const stale = daysSince(top.last_modified, config.now) > config.staleAfterDays;
  const thinExisting = (top.word_count ?? wordCount(top.content)) < config.minWordCount;

  if (stale) {
    return {
      action: "update",
      target_blog_post_id: top.blog_post_id,
      reason: `Most similar post is medium similarity (${top.score.toFixed(3)}) and stale.`,
    };
  }

  if (thinExisting) {
    return {
      action: "update",
      target_blog_post_id: top.blog_post_id,
      reason: `Most similar post is medium similarity (${top.score.toFixed(3)}) and below the word-count threshold.`,
    };
  }

  return {
    action: "create",
    reason: `Closest existing post is only medium similarity (${top.score.toFixed(3)}) and is fresh enough.`,
  };
}

function buildDecisionService(deps: DecisionDeps) {
  return {
    async decide(conversationId: string): Promise<DecisionResult> {
      const loaded = await deps.store.loadConversation(conversationId);
      if (!loaded) throw new Error(`Conversation not found: ${conversationId}`);

      const sourceTranscript = transcript(loaded.messages);
      const sourceWordCount = wordCount(sourceTranscript);
      const config: DecisionConfig = {
        minWordCount: DEFAULT_MIN_WORD_COUNT,
        staleAfterDays: DEFAULT_STALE_AFTER_DAYS,
        similarPostLimit: DEFAULT_SIMILAR_POST_LIMIT,
        now: new Date(),
        ...parseDecisionConfig(loaded.tenant.settings),
        ...deps.getConfig?.(loaded.tenant.settings),
      };

      const extracted = await deps.ai.extractKeywordIntent(loaded.messages);
      const primaryKeyword = extracted.primary_keyword?.trim() || null;
      const intent = extracted.intent?.trim() || null;

      if (!primaryKeyword || !intent) {
        return persistAndReturn(deps.store, loaded, {
          action: "skip",
          reason: "OpenAI extraction returned insufficient keyword or intent signal.",
          similar_posts: [],
          primary_keyword: primaryKeyword,
          intent,
        });
      }

      if (sourceWordCount < config.minWordCount) {
        return persistAndReturn(deps.store, loaded, {
          action: "skip",
          reason: `Conversation word count ${sourceWordCount} is below minimum ${config.minWordCount}.`,
          similar_posts: [],
          primary_keyword: primaryKeyword,
          intent,
        });
      }

      const excludedTerm = matchesExclusion(
        tenantExclusionList(loaded.tenant.settings),
        { primary_keyword: primaryKeyword, intent },
        sourceTranscript
      );
      if (excludedTerm) {
        return persistAndReturn(deps.store, loaded, {
          action: "skip",
          reason: `Primary topic matched tenant exclusion list term "${excludedTerm}".`,
          similar_posts: [],
          primary_keyword: primaryKeyword,
          intent,
        });
      }

      const embedding = await deps.ai.embed(
        `${primaryKeyword}\nIntent: ${intent}\n\n${sourceTranscript}`
      );
      const similarCandidates = await deps.store.findSimilarPosts(
        loaded.conversation.tenantId,
        embedding,
        config.similarPostLimit
      );
      const similar_posts = publicSimilarPosts(
        similarCandidates.map((post) => ({
          ...post,
          score: Number(post.score.toFixed(6)),
          band: similarityBand(post.score),
          word_count: post.word_count ?? wordCount(post.content),
        }))
      );

      const decision = decideFromSimilarity(
        similarCandidates.map((post) => ({
          ...post,
          word_count: post.word_count ?? wordCount(post.content),
        })),
        config
      );

      return persistAndReturn(deps.store, loaded, {
        ...decision,
        similar_posts,
        primary_keyword: primaryKeyword,
        intent,
      });
    },
  };
}

async function persistAndReturn(
  store: DecisionStore,
  loaded: { conversation: ConversationRecord; tenant: TenantRecord },
  decision: Omit<DecisionResult, "log_id">
): Promise<DecisionResult> {
  const log = await store.insertDecisionLog({
    tenantId: loaded.conversation.tenantId,
    conversationId: loaded.conversation.id,
    action: decision.action,
    reason: decision.reason,
    similarPosts: decision.similar_posts,
    primaryKeyword: decision.primary_keyword,
    intent: decision.intent,
    targetBlogPostId: decision.target_blog_post_id,
    metadata: {
      thresholds: {
        high_similarity: HIGH_SIMILARITY,
        medium_similarity: MEDIUM_SIMILARITY,
      },
    },
  });

  return { ...decision, log_id: log.id };
}

class OpenAiDecisionClient implements DecisionAi {
  constructor(private openai?: OpenAI) {}

  private client(): OpenAI {
    this.openai ??= getOpenAIClient();
    return this.openai;
  }

  async extractKeywordIntent(messagesForConversation: MessageRecord[]): Promise<KeywordIntent> {
    const response = await this.client().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: EXTRACTION_PROMPT },
        { role: "user", content: transcript(messagesForConversation) },
      ],
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) throw new Error("OpenAI keyword extraction returned no content");
    const parsed = JSON.parse(raw) as Partial<KeywordIntent>;

    return {
      primary_keyword:
        typeof parsed.primary_keyword === "string" ? parsed.primary_keyword : null,
      intent: typeof parsed.intent === "string" ? parsed.intent : null,
    };
  }

  async embed(input: string): Promise<number[]> {
    const response = await this.client().embeddings.create({
      model: "text-embedding-3-small",
      input,
      encoding_format: "float",
    });
    return response.data[0].embedding;
  }
}

class DrizzleDecisionStore implements DecisionStore {
  async loadConversation(conversationId: string) {
    const [conversation] = await db
      .select({
        id: conversations.id,
        tenantId: conversations.tenantId,
      })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (!conversation) return null;

    const [tenant] = await db
      .select({
        id: tenants.id,
        settings: tenants.settings,
      })
      .from(tenants)
      .where(eq(tenants.id, conversation.tenantId))
      .limit(1);

    if (!tenant) throw new Error(`Tenant not found for conversation ${conversationId}`);

    const conversationMessages = await db
      .select({
        role: messages.role,
        content: messages.content,
      })
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);

    return { conversation, tenant, messages: conversationMessages };
  }

  async findSimilarPosts(
    tenantId: string,
    embedding: number[],
    limit: number
  ): Promise<SimilarPostCandidate[]> {
    const embeddingVector = toPgVector(embedding);
    const rows = await db
      .select({
        blog_post_id: blogPosts.id,
        title: blogPosts.title,
        slug: blogPosts.slug,
        content: blogPosts.content,
        last_modified: blogPosts.lastModified,
        score: sql<number>`(1 - (${blogPosts.embedding} <=> ${embeddingVector}::vector))`,
      })
      .from(blogPosts)
      .where(and(eq(blogPosts.tenantId, tenantId), sql`${blogPosts.embedding} IS NOT NULL`))
      .orderBy(sql`${blogPosts.embedding} <=> ${embeddingVector}::vector`)
      .limit(limit);

    return rows.map((row) => ({
      ...row,
      score: Number(row.score),
      word_count: wordCount(row.content),
    }));
  }

  async insertDecisionLog(input: DecisionLogInput): Promise<{ id: string }> {
    const [row] = await db
      .insert(blogDecisionLogs)
      .values({
        tenantId: input.tenantId,
        conversationId: input.conversationId,
        action: input.action,
        reason: input.reason,
        similarPosts: input.similarPosts.map(({ blog_post_id, score }) => ({
          blog_post_id,
          score,
        })),
        primaryKeyword: input.primaryKeyword,
        intent: input.intent,
        targetBlogPostId: input.targetBlogPostId,
        metadata: input.metadata,
      })
      .returning({ id: blogDecisionLogs.id });

    return row;
  }
}

const defaultService = buildDecisionService({
  store: new DrizzleDecisionStore(),
  ai: new OpenAiDecisionClient(),
});

export async function decide(conversationId: string): Promise<DecisionResult> {
  return defaultService.decide(conversationId);
}

export const __testing = {
  buildDecisionService,
  wordCount,
  similarityBand,
  matchesExclusion,
};
