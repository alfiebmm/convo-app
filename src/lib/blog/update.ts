import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { blogPosts } from "@/lib/db/schema";

import {
  defaultBlogRender,
  DrizzleBlogCreateStore,
  generateWithRateLimitRetry,
  isRecord,
  OpenAiBlogCreateClient,
  packValidate,
  parsePostJson,
  resolveBrandJson,
  resolveCtaConfig,
  retryInstruction,
  stripRenderedEmDashes,
  transcript,
  uniqueSlug,
  validateCandidate,
  wordCount,
  type BlogCreateAi,
  type BlogCreateStore,
  type BlogRenderer,
  type BlogValidator,
  type BrandJson,
  type ConversationRecord,
  type MessageRecord,
  type RetryClass,
  type TenantRecord,
} from "./create";
import type { DecisionResult } from "./decision";
import postSchema from "./schemas/post.schema.json";
import {
  tenantBannedTerms,
  type BlogCtaConfig,
  type BlogPostJson,
  type WritingRuleViolation,
} from "./writing-rules";

type TargetBlogPost = {
  id: string;
  tenantId: string;
  title: string;
  slug: string;
  content: string;
  metadata: Record<string, unknown>;
  status: string;
  lastModified: Date;
};

type BlogUpdateStore = BlogCreateStore & {
  loadTargetBlogPost(blogPostId: string): Promise<TargetBlogPost | null>;
};

type BlogUpdateDeps = {
  store: BlogUpdateStore;
  ai: BlogCreateAi;
  render: BlogRenderer;
  validate: BlogValidator;
  sleep: (ms: number) => Promise<void>;
  now: () => Date;
};

type BlogUpdateBrief = {
  tenant: {
    id: string;
    name: string;
    brandJson: BrandJson;
    writingRules: { bannedTerms: string[]; enforceAustralianEnglish: boolean };
    ctaConfig: BlogCtaConfig;
  };
  source: { conversationId: string; messages: MessageRecord[]; wordCount: number };
  decision: { primaryKeyword: string; intent: string; targetBlogPostId: string };
  previousVersion: {
    id: string;
    title: string;
    slug: string;
    status: string;
    lastModified: string;
    postJson: Record<string, unknown>;
    renderedHtml: string;
  };
  knowledge: { entries: Array<{ q: string; a: string }> };
};

const MAX_RETRIES_PER_CLASS = 3;
const MAX_GENERATION_ATTEMPTS = 6;

const SYSTEM_PROMPT = `You are Convo's senior SEO article editor.

Return only JSON matching the supplied post schema. Do not include markdown fences.

Article update requirements:
- Revise the previous version rather than writing an unrelated article.
- Preserve accurate, high-value passages from the previous version.
- Fold in the new conversation's useful insights, examples, FAQs, objections, and detail.
- Refresh stale or weak sections, intro, FAQs, and stats when the source supports it.
- Keep the same search intent and primary keyword unless the brief explicitly says otherwise.
- Preserve the tenant CTA config exactly for any type=cta block.
- Do not invent facts that are not supported by the previous version, source conversation, tenant context, or common non-sensitive industry knowledge.
- Do not fabricate customer names, prices, guarantees, credentials, or policies.
- Use sentence case headings.
- Write in Australian English. Use -ise, -our, -re spellings. Words: organisation, optimise, colour, centre, behaviour, favourite, honour, licence (noun), license (verb), programme (noun), analyse, realise.
- Avoid all banned terms supplied in the brief.`;

function buildBrief(
  conversationId: string,
  decision: DecisionResult,
  loaded: { tenant: TenantRecord; messages: MessageRecord[]; target: TargetBlogPost }
): BlogUpdateBrief {
  if (decision.action !== "update") {
    throw new Error(`updateArticle only accepts update decisions, got ${decision.action}`);
  }
  if (!decision.target_blog_post_id) {
    throw new Error("Update decision is missing target_blog_post_id");
  }
  if (decision.target_blog_post_id !== loaded.target.id) {
    throw new Error("Loaded target blog post does not match update decision");
  }
  if (loaded.target.tenantId !== loaded.tenant.id) {
    throw new Error("Target blog post belongs to a different tenant");
  }

  const primaryKeyword = decision.primary_keyword?.trim();
  if (!primaryKeyword) throw new Error("Update decision is missing primary_keyword");

  const ctaConfig = resolveCtaConfig(loaded.tenant);
  return {
    tenant: {
      id: loaded.tenant.id,
      name: loaded.tenant.name,
      brandJson: resolveBrandJson(loaded.tenant, ctaConfig),
      writingRules: {
        bannedTerms: tenantBannedTerms(loaded.tenant.settings),
        enforceAustralianEnglish: true,
      },
      ctaConfig,
    },
    source: {
      conversationId,
      messages: loaded.messages,
      wordCount: wordCount(transcript(loaded.messages)),
    },
    decision: {
      primaryKeyword,
      intent: decision.intent?.trim() || "educational",
      targetBlogPostId: decision.target_blog_post_id,
    },
    previousVersion: {
      id: loaded.target.id,
      title: loaded.target.title,
      slug: loaded.target.slug,
      status: loaded.target.status,
      lastModified: loaded.target.lastModified.toISOString(),
      postJson: loaded.target.metadata,
      renderedHtml: loaded.target.content,
    },
    knowledge: { entries: [] },
  };
}

function buildUserPrompt(brief: BlogUpdateBrief, retryInstructions: string[]): string {
  return JSON.stringify(
    {
      brief,
      retryInstructions,
      outputContract: {
        schema: postSchema,
        currentMonth: new Date().toLocaleString("en-AU", {
          month: "long",
          year: "numeric",
          timeZone: "Australia/Sydney",
        }),
      },
    },
    null,
    2
  );
}

function normaliseRevision(
  candidate: BlogPostJson,
  target: TargetBlogPost,
  now: Date
): BlogPostJson {
  const previous = isRecord(target.metadata)
    ? (target.metadata as unknown as BlogPostJson)
    : null;
  const canonicalUrl = previous?.seo?.canonicalUrl ?? candidate.seo?.canonicalUrl;

  return {
    ...candidate,
    seo: { ...candidate.seo, canonicalUrl, modifiedAt: now.toISOString() },
  };
}

async function persistFailure(
  store: BlogUpdateStore,
  params: {
    loaded: { conversation: ConversationRecord; tenant: TenantRecord };
    decision: DecisionResult;
    targetBlogPostId: string | null;
    reason: string;
  }
): Promise<string> {
  console.error("[blog] article update generation failed", {
    conversationId: params.loaded.conversation.id,
    tenantId: params.loaded.tenant.id,
    targetBlogPostId: params.targetBlogPostId,
    reason: params.reason,
  });

  const slug = await uniqueSlug(
    store,
    params.loaded.tenant.id,
    `update-generation-failed-${params.loaded.conversation.id.slice(0, 8)}`
  );
  const titleKeyword =
    params.decision.primary_keyword?.trim() || "Blog article update generation";
  const row = await store.insertBlogPost({
    tenantId: params.loaded.tenant.id,
    threadId: params.loaded.conversation.id,
    title: `${titleKeyword} generation failed`,
    slug,
    content: "",
    metadata: {
      update_of: params.targetBlogPostId,
      generation_failure: {
        reason: params.reason,
        decision: params.decision,
        failedAt: new Date().toISOString(),
      },
    },
    status: "generation_failed",
    persona: params.decision.primary_keyword,
    topic: params.decision.intent,
  });
  return row.id;
}

function buildUpdateService(deps: BlogUpdateDeps) {
  return {
    async updateArticle(conversationId: string, decision: DecisionResult) {
      const loaded = await deps.store.loadConversation(conversationId);
      if (!loaded) throw new Error(`Conversation not found: ${conversationId}`);

      const targetBlogPostId = decision.target_blog_post_id ?? null;
      const target = targetBlogPostId
        ? await deps.store.loadTargetBlogPost(targetBlogPostId)
        : null;
      if (!target) {
        return persistFailure(deps.store, {
          loaded,
          decision,
          targetBlogPostId,
          reason: targetBlogPostId
            ? `Target blog post not found: ${targetBlogPostId}`
            : "Update decision is missing target_blog_post_id",
        });
      }

      let brief: BlogUpdateBrief;
      try {
        brief = buildBrief(conversationId, decision, {
          tenant: loaded.tenant,
          messages: loaded.messages,
          target,
        });
      } catch (error) {
        return persistFailure(deps.store, {
          loaded,
          decision,
          targetBlogPostId,
          reason: error instanceof Error ? error.message : String(error),
        });
      }

      const retryCounts = new Map<RetryClass, number>();
      const retryInstructions: string[] = [];
      let finalPost: BlogPostJson | null = null;
      let finalHtml = "";
      let failureReason = "Article update generation failed.";
      const allEmDashReplacements: Array<{ before: string; after: string }> = [];

      for (
        let generationAttempt = 1;
        !finalPost && generationAttempt <= MAX_GENERATION_ATTEMPTS;
        generationAttempt++
      ) {
        const raw = await generateWithRateLimitRetry(
          deps.ai,
          {
            systemPrompt: SYSTEM_PROMPT,
            userPrompt: buildUserPrompt(brief, retryInstructions),
          },
          deps.sleep
        ).catch((error) => {
          failureReason =
            error instanceof Error ? error.message : `OpenAI failed: ${String(error)}`;
          return null;
        });
        if (!raw) break;

        try {
          const candidate = normaliseRevision(parsePostJson(raw), target, deps.now());
          const validated = validateCandidate(candidate, brief, deps.validate);
          const slug = await uniqueSlug(
            deps.store,
            brief.tenant.id,
            validated.post.slug
          );
          finalPost = { ...validated.post, slug };
          finalHtml = stripRenderedEmDashes(
            deps.render({ brand: brief.tenant.brandJson, post: finalPost })
          );
          allEmDashReplacements.push(...validated.emDashReplacements);
        } catch (error) {
          const violation =
            isRecord(error) && typeof error.code === "string"
              ? (error as WritingRuleViolation)
              : ({
                  code: "schema",
                  message:
                    error instanceof Error ? error.message : `Invalid JSON: ${String(error)}`,
                } satisfies WritingRuleViolation);

          failureReason = violation.message;
          const retryClass = violation.code;
          const retryCount = (retryCounts.get(retryClass) ?? 0) + 1;
          retryCounts.set(retryClass, retryCount);
          console.info("[blog] article update generation retry", {
            conversationId,
            retryClass,
            retryCount,
            maxRetriesPerClass: MAX_RETRIES_PER_CLASS,
            generationAttempt,
            maxGenerationAttempts: MAX_GENERATION_ATTEMPTS,
            violation: violation.message,
          });
          if (
            retryCount > MAX_RETRIES_PER_CLASS ||
            generationAttempt >= MAX_GENERATION_ATTEMPTS
          ) {
            break;
          }
          retryInstructions.push(retryInstruction(violation));
        }
      }

      if (!finalPost) {
        return persistFailure(deps.store, {
          loaded,
          decision,
          targetBlogPostId: target.id,
          reason: failureReason,
        });
      }

      const row = await deps.store.insertBlogPost({
        tenantId: loaded.tenant.id,
        threadId: conversationId,
        title: finalPost.title,
        slug: finalPost.slug,
        content: finalHtml,
        metadata: {
          ...finalPost,
          update_of: target.id,
          generation: {
            decision,
            updateOf: target.id,
            emDashReplacements: allEmDashReplacements,
          },
        },
        status: "draft",
        persona: decision.primary_keyword,
        topic: decision.intent,
      });
      return row.id;
    },
  };
}

class DrizzleBlogUpdateStore
  extends DrizzleBlogCreateStore
  implements BlogUpdateStore
{
  async loadTargetBlogPost(blogPostId: string): Promise<TargetBlogPost | null> {
    const [target] = await db
      .select({
        id: blogPosts.id,
        tenantId: blogPosts.tenantId,
        title: blogPosts.title,
        slug: blogPosts.slug,
        content: blogPosts.content,
        metadata: blogPosts.metadata,
        status: blogPosts.status,
        lastModified: blogPosts.lastModified,
      })
      .from(blogPosts)
      .where(eq(blogPosts.id, blogPostId))
      .limit(1);

    if (!target) return null;
    return { ...target, metadata: isRecord(target.metadata) ? target.metadata : {} };
  }
}

const defaultService = buildUpdateService({
  store: new DrizzleBlogUpdateStore(),
  ai: new OpenAiBlogCreateClient(),
  validate: packValidate,
  render: defaultBlogRender,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => new Date(),
});

export async function updateArticle(
  conversationId: string,
  decision: DecisionResult
): Promise<string> {
  return defaultService.updateArticle(conversationId, decision);
}

export const __testing = {
  buildUpdateService,
  buildBrief,
  normaliseRevision,
};
