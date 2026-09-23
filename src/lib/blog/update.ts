import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { blogPosts } from "@/lib/db/schema";
import {
  articleSeoFromBrief,
  buildEditorialBrief,
  validateEditorialBriefArticle,
  type EditorialBrief,
  type TenantSeoStrategy,
} from "@/lib/pipeline/editorial-brief";
import type { ClassifiedConversation } from "@/lib/pipeline/classify-conversation";

import {
  defaultBlogRender,
  defaultBlogSemanticRender,
  buildBlogPostMetadata,
  classifiedMetadata,
  DrizzleBlogCreateStore,
  generateWithRateLimitRetry,
  isRecord,
  logQualityGateViolation,
  logRepairPass,
  logSeoValidation,
  OpenAiBlogCreateClient,
  packValidate,
  parsePostJson,
  resolveBrandJson,
  resolveCtaConfig,
  stripRenderedEmDashes,
  transcript,
  uniqueSlug,
  uniqueGeneratedSlug,
  validateCandidate,
  wordCount,
  type BlogCreateAi,
  type BlogCreateStore,
  type BlogRenderer,
  type BlogValidator,
  type BrandJson,
  type ConversationRecord,
  type MessageRecord,
  type TenantRecord,
} from "./create";
import type { DecisionResult } from "./decision";
import { repairBlogPost, type RepairOperation } from "./repair";
import postSchema from "./schemas/post.schema.json";
import { validateSeoMetadata } from "./seo";
import {
  tenantBannedTerms,
  type BlogCtaConfig,
  type BlogPostJson,
  type WritingRuleViolation,
  type WordCountGateViolation,
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
  renderSemantic: BlogRenderer;
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
  editorial: EditorialBrief;
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

const MAX_REPAIR_PASSES = 12;

const SYSTEM_PROMPT = `You are Convo's senior SEO article editor.

Return only JSON matching the supplied post schema. Do not include markdown fences.

Article update requirements:
- Revise the previous version rather than writing an unrelated article.
- Preserve accurate, high-value passages from the previous version.
- Fold in the new conversation's useful insights, examples, FAQs, objections, and detail.
- Refresh stale or weak sections, intro, FAQs, and stats when the source supports it.
- Keep the same search intent and primary keyword unless the brief explicitly says otherwise.
- Preserve the tenant CTA config exactly for any type=cta block.
- Follow the supplied editorial brief. It defines required modules, planned internal links, CTA goal, target audience, supporting keywords, and tenant facts to use.
- If editorial.requiredModules includes "internal-links", include at least one planned internal link exactly as supplied in editorial.internalLinkPlan.
- If editorial.requiredModules includes "cta", include a CTA block using the tenant CTA config and make the CTA purpose match editorial.ctaPlan.
- Write post.seo.metaTitle as a 50-60 character search title.
- Write post.seo.metaDescription as a 140-160 character search description.
- Use a lowercase, hyphenated post.slug with stop words removed, 70 characters or fewer.
- Do not invent facts that are not supported by the previous version, source conversation, tenant context, or common non-sensitive industry knowledge.
- Do not fabricate customer names, prices, guarantees, credentials, or policies.
- Use sentence case headings.
- Write in Australian English. Use -ise, -our, -re spellings. Words: organisation, optimise, colour, centre, behaviour, favourite, honour, licence (noun), license (verb), programme (noun), analyse, realise.
- Avoid all banned terms supplied in the brief.`;

function buildBrief(
  conversationId: string,
  decision: DecisionResult,
  loaded: {
    tenant: TenantRecord;
    messages: MessageRecord[];
    target: TargetBlogPost;
    seoStrategy?: TenantSeoStrategy | null;
    classification?: ClassifiedConversation | null;
  }
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
    editorial: buildEditorialBrief({
      tenantId: loaded.tenant.id,
      conversationId,
      strategy: loaded.seoStrategy ?? null,
      messages: loaded.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      decision: {
        action: decision.action,
        primaryKeyword: decision.primary_keyword,
        intent: decision.intent,
        reason: decision.reason,
        targetBlogPostId: decision.target_blog_post_id,
      },
      classification: loaded.classification ?? null,
    }),
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
    editorialBriefId?: string;
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
  if (params.editorialBriefId && store.linkEditorialBriefToBlogPost) {
    await store.linkEditorialBriefToBlogPost(params.editorialBriefId, row.id);
  }
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
      let editorialBriefId: string | undefined;
      let hasConfiguredSeoTargets = false;
      let classification: ClassifiedConversation | null = null;
      try {
        const seoStrategy = deps.store.loadTenantSeoStrategy
          ? await deps.store.loadTenantSeoStrategy(loaded.tenant.id)
          : null;
        classification = deps.ai.classifyConversation
          ? await deps.ai.classifyConversation({
              conversationMessages: loaded.messages.map((message) => ({
                role: message.role,
                content: message.content,
              })),
              tenantSeoStrategy: seoStrategy,
            })
          : null;
        hasConfiguredSeoTargets = Boolean(seoStrategy?.targetKeywords.length);
        brief = buildBrief(conversationId, decision, {
          tenant: loaded.tenant,
          messages: loaded.messages,
          target,
          seoStrategy,
          classification,
        });
        if (deps.store.insertEditorialBrief) {
          editorialBriefId = (await deps.store.insertEditorialBrief(brief.editorial)).id;
          brief.editorial.id = editorialBriefId;
        }
      } catch (error) {
        return persistFailure(deps.store, {
          loaded,
          decision,
          targetBlogPostId,
          reason: error instanceof Error ? error.message : String(error),
        });
      }

      let finalPost: BlogPostJson | null = null;
      let finalHtml = "";
      let finalSemanticHtml = "";
      let finalWordCount: number | null = null;
      let failureReason = "Article update generation failed.";
      const allEmDashReplacements: Array<{ before: string; after: string }> = [];
      const repairOperations: RepairOperation[] = [];

      const raw = await generateWithRateLimitRetry(
        deps.ai,
        {
          systemPrompt: SYSTEM_PROMPT,
          userPrompt: buildUserPrompt(brief, []),
        },
        deps.sleep
      ).catch((error) => {
        failureReason =
          error instanceof Error ? error.message : `OpenAI failed: ${String(error)}`;
        return null;
      });

      if (!raw) {
        return persistFailure(deps.store, {
          loaded,
          decision,
          targetBlogPostId: target.id,
          reason: failureReason,
          editorialBriefId,
        });
      }

      let candidate: BlogPostJson;
      try {
        candidate = normaliseRevision(parsePostJson(raw), target, deps.now());
      } catch (error) {
        return persistFailure(deps.store, {
          loaded,
          decision,
          targetBlogPostId: target.id,
          reason: error instanceof Error ? error.message : `Invalid JSON: ${String(error)}`,
          editorialBriefId,
        });
      }

      for (let repairPass = 0; !finalPost && repairPass <= MAX_REPAIR_PASSES; repairPass++) {
        try {
          const validated = validateCandidate(candidate, brief, deps.validate);
          const editorialIssues = validateEditorialBriefArticle({
            brief: brief.editorial,
            article: validated.post,
          });
          if (editorialIssues.length > 0 && !brief.editorial.noStrongTarget) {
            throw {
              code: "primary_keyword",
              message: editorialIssues.map((issue) => issue.message).join(" "),
            } satisfies WritingRuleViolation;
          }
          const slug = await uniqueGeneratedSlug(
            deps.store,
            brief.tenant.id,
            validated.post.title
          );
          finalPost = { ...validated.post, slug };
          finalWordCount = validated.wordCount;
          await logSeoValidation(deps.store, {
            loaded,
            decision,
            post: finalPost,
            result: validateSeoMetadata(finalPost),
            targetBlogPostId: target.id,
          });
          finalHtml = stripRenderedEmDashes(
            deps.render({ brand: brief.tenant.brandJson, post: finalPost })
          );
          finalSemanticHtml = stripRenderedEmDashes(
            deps.renderSemantic({ brand: brief.tenant.brandJson, post: finalPost })
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
          if (violation.code === "word_count") {
            await logQualityGateViolation(deps.store, {
              loaded,
              decision,
              violation: violation as WordCountGateViolation,
              targetBlogPostId: target.id,
            });
          }
          if (repairPass >= MAX_REPAIR_PASSES) {
            console.error("[blog] article update repair loop exhausted", {
              conversationId,
              targetBlogPostId: target.id,
              maxRepairPasses: MAX_REPAIR_PASSES,
              violation: violation.message,
              repairOperations,
            });
            break;
          }

          const repair = await repairBlogPost(candidate, brief, violation, deps.ai).catch(
            (repairError) => {
              failureReason =
                repairError instanceof Error
                  ? repairError.message
                  : `Article update repair failed: ${String(repairError)}`;
              return null;
            }
          );
          if (!repair) break;
          candidate = normaliseRevision(repair.post, target, deps.now());
          repairOperations.push(...repair.operations);
          await logRepairPass(deps.store, {
            loaded,
            decision,
            violation,
            repairPass: repairPass + 1,
            operations: repair.operations,
            targetBlogPostId: target.id,
          });
          console.info("[blog] article update contract repair applied", {
            conversationId,
            targetBlogPostId: target.id,
            repairPass: repairPass + 1,
            violationCode: violation.code,
            violationMessage: violation.message,
            operations: repair.operations,
          });
        }
      }

      if (!finalPost) {
        return persistFailure(deps.store, {
          loaded,
          decision,
          targetBlogPostId: target.id,
          reason: failureReason,
          editorialBriefId,
        });
      }
      if (finalWordCount === null) {
        throw new Error("Validated article update is missing word count");
      }

      const row = await deps.store.insertBlogPost({
        tenantId: loaded.tenant.id,
        threadId: conversationId,
        title: finalPost.title,
        slug: finalPost.slug,
        content: finalHtml,
        contentSemantic: finalSemanticHtml,
        metadata: buildBlogPostMetadata(finalPost, finalWordCount, {
          ...classifiedMetadata(brief.editorial, classification),
          update_of: target.id,
          generation: {
            decision,
            editorialBrief: brief.editorial,
            updateOf: target.id,
            emDashReplacements: allEmDashReplacements,
            repairOperations,
          },
        }),
        status:
          brief.editorial.noStrongTarget && hasConfiguredSeoTargets
            ? "in_review"
            : "draft",
        persona: decision.primary_keyword,
        topic: decision.intent,
      });
      if (editorialBriefId && deps.store.linkEditorialBriefToBlogPost) {
        await deps.store.linkEditorialBriefToBlogPost(editorialBriefId, row.id);
      }
      if (deps.store.upsertBlogPostSeo) {
        await deps.store.upsertBlogPostSeo(row.id, articleSeoFromBrief(brief.editorial));
      }
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
  renderSemantic: defaultBlogSemanticRender,
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
