import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { and, asc, eq } from "drizzle-orm";
import type OpenAI from "openai";

import { db } from "@/lib/db";
import {
  blogDecisionLogs,
  blogEditorialBriefs,
  blogPostSeo,
  blogPosts,
  conversations,
  messages,
  tenantSeoStrategy,
  tenants,
} from "@/lib/db/schema";
import {
  contentRulesPromptBlock,
  resolveContentRules,
} from "@/lib/forum-config/content-rules";
import { getOpenAIClient } from "@/lib/openai";
import {
  articleSeoFromBrief,
  buildEditorialBrief,
  validateEditorialBriefArticle,
  type ArticleSeoFields,
  type EditorialBrief,
  type TenantSeoStrategy,
} from "@/lib/pipeline/editorial-brief";

import type { DecisionResult } from "./decision";
import {
  heroPlaceholderUrlForBrand,
  heroUrlMatchesBrandLogo,
  isHttpsUrl,
} from "./hero-placeholder";
import {
  applyAiHeroToMetadata,
  generateAndStoreHeroImage,
  loadTenantHeroImageConfig,
  persistGeneratedHero,
  type HeroImageResult,
} from "./hero-image";
import brandSchema from "./schemas/brand.schema.json";
import postSchema from "./schemas/post.schema.json";
import { repairBlogPost, type RepairOperation } from "./repair";
import { generateSlug, validateSeoMetadata, type SeoValidationResult } from "./seo";
import {
  enforceCtaConfig,
  findAustralianEnglishViolation,
  findBannedTerm,
  slugIsValid,
  stripEmDashes,
  tenantBannedTerms,
  validatePrimaryKeywordPlacement,
  validatePostStructure,
  wordCountGateStats,
  validateWordCountGates,
  type BlogCtaConfig,
  type BlogPostJson,
  type WritingRuleViolation,
  type WordCountGateViolation,
} from "./writing-rules";

export type BrandJson = Record<string, unknown>;

type BlogBrief = {
  tenant: {
    id: string;
    name: string;
    brandJson: BrandJson;
    heroPlaceholderUrl?: string | null;
    writingRules: { bannedTerms: string[]; enforceAustralianEnglish: boolean };
    contentRulesPrompt?: string;
    ctaConfig: BlogCtaConfig;
  };
  source: {
    conversationId: string;
    messages: Array<{ role: string; content: string; createdAt: Date }>;
    wordCount: number;
  };
  decision: {
    primaryKeyword: string;
    intent: string;
    targetBlogPostId?: string;
  };
  editorial: EditorialBrief;
  knowledge: {
    entries: Array<{ q: string; a: string }>;
  };
};

export type ConversationRecord = {
  id: string;
  tenantId: string;
};

export type TenantRecord = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  settings: unknown;
};

export type MessageRecord = {
  role: string;
  content: string;
  createdAt: Date;
};

type ValidationError = {
  instancePath?: string;
  message?: string;
  params?: unknown;
};

export type ValidationResult = Array<{ file: string; errors: ValidationError[] }>;

export type BlogCreateStore = {
  loadConversation(
    conversationId: string
  ): Promise<{
    conversation: ConversationRecord;
    tenant: TenantRecord;
    messages: MessageRecord[];
  } | null>;
  slugExists(tenantId: string, slug: string): Promise<boolean>;
  insertBlogPost(values: {
    tenantId: string;
    threadId: string;
    title: string;
    slug: string;
    content: string;
    contentSemantic?: string | null;
    metadata: Record<string, unknown>;
    status: "draft" | "in_review" | "generation_failed" | "update_pending";
    persona: string | null;
    topic: string | null;
  }): Promise<{ id: string }>;
  insertSeoValidationLog?(input: {
    tenantId: string;
    conversationId: string;
    action: "create" | "update";
    reason: string;
    primaryKeyword: string | null;
    intent: string | null;
    targetBlogPostId?: string;
    metadata: Record<string, unknown>;
  }): Promise<{ id: string }>;
  loadTenantSeoStrategy?(tenantId: string): Promise<TenantSeoStrategy | null>;
  insertEditorialBrief?(brief: EditorialBrief): Promise<{ id: string }>;
  linkEditorialBriefToBlogPost?(briefId: string, blogPostId: string): Promise<void>;
  upsertBlogPostSeo?(blogPostId: string, fields: ArticleSeoFields): Promise<void>;
};

export type BlogCreateAi = {
  generatePost(params: {
    systemPrompt: string;
    userPrompt: string;
  }): Promise<string>;
};

export type BlogRenderer = (params: { brand: BrandJson; post: BlogPostJson }) => string;
export type BlogValidator = (params: { brand: BrandJson; post: BlogPostJson }) => ValidationResult;

type BlogCreateDeps = {
  store: BlogCreateStore;
  ai: BlogCreateAi;
  render: BlogRenderer;
  renderSemantic: BlogRenderer;
  validate: BlogValidator;
  sleep: (ms: number) => Promise<void>;
  heroImages?: {
    generate(params: {
      tenantId: string;
      postId: string;
      post: BlogPostJson;
      metadata: Record<string, unknown>;
    }): Promise<HeroImageResult | null>;
    persist(params: {
      tenantId: string;
      postId: string;
      metadata: Record<string, unknown>;
      content: string;
      contentSemantic: string;
    }): Promise<void>;
  };
};

export type RetryClass =
  | "schema"
  | "banned_term"
  | "australian_english"
  | "primary_keyword"
  | "word_count";

const MAX_RATE_LIMIT_ATTEMPTS = 2;
const RATE_LIMIT_RETRY_MS = 5_000;
const MAX_REPAIR_PASSES = 12;

const AU_ENGLISH_RULE =
  "Write in Australian English. Use -ise, -our, -re spellings. Words: organisation, optimise, colour, centre, behaviour, favourite, honour, licence (noun), license (verb), programme (noun), analyse, realise.";

function formatBannedTerms(terms: string[]): string {
  return `[${terms.join(", ")}]`;
}

function buildSystemPrompt(brief: BlogBrief): string {
  const primaryKeyword = brief.decision.primaryKeyword;
  const bannedTerms = formatBannedTerms(brief.tenant.writingRules.bannedTerms);
  const contentRulesPrompt = brief.tenant.contentRulesPrompt ?? "";

  return `You are Convo's senior SEO article writer.

Return only JSON matching the supplied post schema. Do not include markdown fences.

Article requirements:
- H1 is post.title.
- Include a one-sentence dek, a direct intro paragraph, exactly 3 toc items, at least 3 FAQs, and hero.url plus hero.alt. Prefer omitting hero.url so the system can supply a gradient placeholder over using a wrong image.
- \`hero.url\` MUST be a topical article image URL. NEVER use the tenant logo URL as the hero image. If no suitable image is available, omit \`hero.url\` entirely and the system will supply a gradient placeholder.
- Your \`post.sections\` array MUST contain between 4 and 10 items (inclusive). Fewer than 4 or more than 10 will be REJECTED. Aim for 5-7 sections for best structure.
- Every item in \`post.sections\` MUST be an object with a non-empty \`heading\` string and a \`blocks\` array. Every \`section.blocks\` array MUST contain valid block objects matching the schema.
- Each section MUST contain at least 3 paragraph blocks (block.type = "p").
- Each paragraph block should be 80-150 words of concrete, specific prose. Short blocks (under 40 words) or vague filler ("this is important", "consider your options") will be REJECTED.
- HARD REQUIREMENT: total article body MUST land between 800 and 1,500 words across all sections plus the intro paragraph. This is a generation contract, not a post-hoc filter — plan your section lengths up front so the total lands in range. Aim for the middle (around 1,100-1,300 words) for balanced depth and reader retention. Below 800 words the article will be flagged for review; above 1,500 words it will be REJECTED unless the topic genuinely warrants it.
- Support long-form content with concrete examples, data points, and specific-to-industry detail. If the source conversation lacks depth, expand using common non-sensitive industry knowledge (per the "no invented facts" rule elsewhere, knowledge OK, fabricated specifics NOT OK).
- The primary keyword "${primaryKeyword}" MUST appear in ALL of these places or the output will be REJECTED:
  - \`post.title\` (as-is or in natural phrasing)
  - At least ONE H2 section heading
  - The first 100 words of \`post.intro\`
  - \`post.seo.metaTitle\`
  - \`post.seo.metaDescription\`
  Check each placement before returning.
- Write \`post.seo.metaTitle\` as a 50-60 character search title.
- Write \`post.seo.metaDescription\` as a 140-160 character search description.
- Use a lowercase, hyphenated \`post.slug\` with stop words removed, 70 characters or fewer.
- BANNED TERMS: ${bannedTerms}. Using ANY of these terms, even once, will REJECT the entire output. Do not use any word or phrase from this list, not even as part of a compound word.
- Use the tenant CTA config exactly for any type=cta block.
- Follow the supplied editorial brief. It defines required modules, planned internal links, CTA goal, target audience, supporting keywords, and tenant facts to use.
- If editorial.requiredModules includes "internal-links", include at least one planned internal link exactly as supplied in editorial.internalLinkPlan.
- If editorial.requiredModules includes "cta", include a CTA block using the tenant CTA config and make the CTA purpose match editorial.ctaPlan.
- Do not invent facts that are not supported by the source conversation, tenant context, or common non-sensitive industry knowledge.
- Do not fabricate customer names, prices, guarantees, credentials, or policies.
- Use sentence case headings.
- ${AU_ENGLISH_RULE}

${contentRulesPrompt}`;
}

export function wordCount(input: string): number {
  return input.trim().split(/\s+/).filter(Boolean).length;
}

export function transcript(messagesForConversation: MessageRecord[]): string {
  return messagesForConversation
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n\n")
    .trim();
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function settingPath(settings: unknown, pathParts: string[]): unknown {
  let current: unknown = settings;
  for (const part of pathParts) {
    if (!isRecord(current)) return undefined;
    current = current[part];
  }
  return current;
}

function siteBaseUrl(tenant: TenantRecord): string {
  if (tenant.domain) {
    return tenant.domain.startsWith("http")
      ? tenant.domain.replace(/\/+$/, "")
      : `https://${tenant.domain.replace(/\/+$/, "")}`;
  }

  return `https://${tenant.slug}.convoapp.com.au`;
}

function heroPlaceholderUrl(brand: BrandJson): string {
  return heroPlaceholderUrlForBrand(brand);
}

function normalisePostHero<
  T extends Partial<BlogPostJson> & { hero?: Partial<BlogPostJson["hero"]> },
>(
  post: T,
  brief: BlogBrief
): T & { hero: BlogPostJson["hero"] } {
  const hero: Record<string, unknown> = isRecord(post.hero) ? post.hero : {};
  const heroUrl = readString(hero.url);
  const matchedBrandLogoUrl = heroUrlMatchesBrandLogo({
    heroUrl,
    brand: brief.tenant.brandJson,
  });
  if (isHttpsUrl(heroUrl) && !matchedBrandLogoUrl) {
    return {
      ...post,
      hero: {
        url: heroUrl,
        alt: readString(hero.alt) ?? post.title ?? brief.tenant.name,
      },
    };
  }

  const configuredHeroUrl = brief.tenant.heroPlaceholderUrl ?? null;
  const placeholderUrl = isHttpsUrl(configuredHeroUrl)
    ? configuredHeroUrl
    : heroPlaceholderUrl(brief.tenant.brandJson);

  console.warn("[blog] article hero fell back to placeholder", {
    tenantId: brief.tenant.id,
    conversationId: brief.source.conversationId,
    placeholderUrl,
    reason: matchedBrandLogoUrl
      ? "matched_brand_logo_url"
      : heroUrl
        ? "invalid_or_non_https_url"
        : "missing_url",
  });

  return {
    ...post,
    hero: {
      ...hero,
      url: placeholderUrl,
      alt: readString(hero.alt) ?? post.title ?? brief.tenant.name,
    },
  };
}

function buildDefaultBrand(tenant: TenantRecord, cta: BlogCtaConfig): BrandJson {
  const baseUrl = siteBaseUrl(tenant);

  console.warn("[blog] tenant missing settings.brandJson; using fallback brand", {
    tenantId: tenant.id,
  });

  return {
    id: tenant.slug,
    name: tenant.name,
    colors: {
      primary: "#FF6B2C",
      primaryHover: "#E85A1E",
      secondary: "#18181B",
      footerBg: "#18181B",
      surfaceTint: "#FFF3EC",
      surfaceTint2: "#F4F4F5",
      text: "#27272A",
      textMuted: "#52525B",
      textSubtle: "#71717A",
      textStrong: "#18181B",
      bg: "#FFFFFF",
      bgMuted: "#F4F4F5",
      border: "#D4D4D8",
      borderSoft: "#E4E4E7",
    },
    fonts: {
      body: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      headings: "Outfit, Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    },
    logo: {
      url: `${baseUrl}/favicon.ico`,
      alt: tenant.name,
      height: 30,
    },
    site: {
      baseUrl,
      hubUrl: `${baseUrl}/blog`,
      hubLabel: "Blog",
      orderUrl: cta.linkUrl,
      orderLabel: cta.linkLabel,
    },
    cta,
    footer: {
      wordmark: tenant.name,
      tagline: `Helpful articles from ${tenant.name}.`,
      columns: [
        {
          heading: "Explore",
          links: [
            { label: "Home", url: baseUrl },
            { label: "Blog", url: `${baseUrl}/blog` },
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} ${tenant.name}.`,
      legalLinks: [],
    },
  };
}

export function resolveCtaConfig(tenant: TenantRecord): BlogCtaConfig {
  const settingsCta =
    settingPath(tenant.settings, ["blog", "cta"]) ??
    settingPath(tenant.settings, ["forumConfig", "blog", "cta"]);
  const baseUrl = siteBaseUrl(tenant);
  const record = isRecord(settingsCta) ? settingsCta : {};

  return {
    heading: readString(record.heading) ?? `Talk to ${tenant.name}`,
    body:
      readString(record.body) ??
      `Get answers from ${tenant.name} when you need specific guidance.`,
    linkUrl: readString(record.linkUrl) ?? readString(record.link_url) ?? baseUrl,
    linkLabel:
      readString(record.linkLabel) ?? readString(record.link_label) ?? "Get in touch",
  };
}

export function resolveBrandJson(tenant: TenantRecord, cta: BlogCtaConfig): BrandJson {
  const candidate =
    settingPath(tenant.settings, ["brandJson"]) ??
    settingPath(tenant.settings, ["brand_json"]) ??
    settingPath(tenant.settings, ["blog", "brandJson"]) ??
    settingPath(tenant.settings, ["forumConfig", "blog", "brandJson"]);

  if (isRecord(candidate)) {
    return {
      ...candidate,
      cta,
    };
  }

  return buildDefaultBrand(tenant, cta);
}

function buildBrief(
  conversationId: string,
  decision: DecisionResult,
  loaded: {
    tenant: TenantRecord;
    messages: MessageRecord[];
    seoStrategy?: TenantSeoStrategy | null;
  }
): BlogBrief {
  if (decision.action !== "create") {
    throw new Error(`createArticle only accepts create decisions, got ${decision.action}`);
  }

  const primaryKeyword = decision.primary_keyword?.trim();
  if (!primaryKeyword) throw new Error("Create decision is missing primary_keyword");

  const ctaConfig = resolveCtaConfig(loaded.tenant);
  const contentRules = resolveContentRules(loaded.tenant.settings);
  const bannedTerms = Array.from(
    new Set([
      ...tenantBannedTerms(loaded.tenant.settings),
      ...contentRules.styleGuide.bannedWords,
    ]),
  );

  return {
    tenant: {
      id: loaded.tenant.id,
      name: loaded.tenant.name,
      brandJson: resolveBrandJson(loaded.tenant, ctaConfig),
      heroPlaceholderUrl: readString(
        settingPath(loaded.tenant.settings, ["brandJson", "heroPlaceholder", "url"])
      ),
      writingRules: {
        bannedTerms,
        enforceAustralianEnglish: true,
      },
      contentRulesPrompt: contentRulesPromptBlock(loaded.tenant.settings),
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
    }),
    knowledge: {
      entries: [],
    },
  };
}

function buildUserPrompt(brief: BlogBrief, retryInstructions: string[]): string {
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

export function parsePostJson(raw: string): BlogPostJson {
  return JSON.parse(raw) as BlogPostJson;
}

function schemaFailure(errors: ValidationResult): WritingRuleViolation {
  return {
    code: "schema",
    message:
      "post.json failed schema validation: " +
      errors
        .flatMap((entry) =>
          entry.errors.map(
            (error) =>
              `${entry.file}${error.instancePath ?? ""} ${error.message ?? "is invalid"}`
          )
        )
        .join("; "),
  };
}

export async function generateWithRateLimitRetry(
  ai: BlogCreateAi,
  params: { systemPrompt: string; userPrompt: string },
  sleep: (ms: number) => Promise<void>
): Promise<string> {
  for (let attempt = 1; attempt <= MAX_RATE_LIMIT_ATTEMPTS; attempt++) {
    try {
      return await ai.generatePost(params);
    } catch (error) {
      const status = (error as { status?: number })?.status;
      if (status !== 429 || attempt === MAX_RATE_LIMIT_ATTEMPTS) throw error;
      await sleep(RATE_LIMIT_RETRY_MS);
    }
  }

  throw new Error("OpenAI rate-limit retry exhausted");
}

export function retryInstruction(violation: WritingRuleViolation): string {
  const sentence = violation.sentence
    ? ` Offending sentence: "${violation.sentence}"`
    : "";
  return `${violation.message}.${sentence} Rewrite the full post.json so this issue is fixed while preserving the article structure and source accuracy.`;
}

export function validateCandidate(
  candidate: BlogPostJson,
  brief: BlogBrief,
  validate: BlogValidator
): {
  post: BlogPostJson;
  emDashReplacements: Array<{ before: string; after: string }>;
  wordCount: number;
} {
  const schemaErrors = validate({ brand: brief.tenant.brandJson, post: candidate });
  if (schemaErrors.length > 0) throw schemaFailure(schemaErrors);

  const structure = validatePostStructure(candidate);
  if (structure) throw structure;

  const wordCount = validateWordCountGates(candidate);
  if (wordCount) throw wordCount;
  const stats = wordCountGateStats(candidate);

  const stripped = stripEmDashes(candidate);
  for (const replacement of stripped.replacements) {
    console.info("[blog] stripped em dash from generated article", {
      conversationId: brief.source.conversationId,
      before: replacement.before,
      after: replacement.after,
    });
  }

  let post = enforceCtaConfig(stripped.value, brief.tenant.ctaConfig);

  const banned = findBannedTerm(post, brief.tenant.writingRules.bannedTerms);
  if (banned) throw banned;

  const auEnglish = findAustralianEnglishViolation(post);
  if (auEnglish) throw auEnglish;

  const keyword = validatePrimaryKeywordPlacement(
    post,
    brief.decision.primaryKeyword
  );
  if (keyword) throw keyword;

  const editorialIssues = validateEditorialBriefArticle({
    brief: brief.editorial,
    article: post,
  });
  if (editorialIssues.length > 0 && !brief.editorial.noStrongTarget) {
    throw {
      code: "primary_keyword",
      message: editorialIssues.map((issue) => issue.message).join(" "),
    } satisfies WritingRuleViolation;
  }

  post = {
    ...post,
    slug: generateSlug(post.title),
  };

  if (!slugIsValid(post.slug)) {
    throw {
      code: "schema",
      message: `Slug is not valid kebab-case: ${post.slug}`,
    } satisfies WritingRuleViolation;
  }

  return {
    post,
    emDashReplacements: stripped.replacements,
    wordCount: stats.totalWordCount,
  };
}

export function buildBlogPostMetadata(
  post: BlogPostJson,
  wordCount: number,
  extra: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...post,
    ...extra,
    word_count: wordCount,
    wordCount,
    stats: {
      wordCount,
      cards: post.stats ?? null,
    },
  };
}

export function stripRenderedEmDashes(html: string): string {
  return html.replace(/\s*[—–]\s*/g, ". ").replace(/\.\s+([a-z])/g, (_match, letter: string) => `. ${letter.toUpperCase()}`);
}

export async function uniqueSlug(
  store: BlogCreateStore,
  tenantId: string,
  slug: string
): Promise<string> {
  let candidate = slug;
  let suffix = 2;
  while (await store.slugExists(tenantId, candidate)) {
    candidate = `${slug}-${suffix}`;
    suffix++;
  }
  return candidate;
}

export async function uniqueGeneratedSlug(
  store: BlogCreateStore,
  tenantId: string,
  title: string
): Promise<string> {
  const existing = new Set<string>();
  let candidate = generateSlug(title, existing);

  while (await store.slugExists(tenantId, candidate)) {
    existing.add(candidate);
    candidate = generateSlug(title, existing);
  }

  return candidate;
}

export async function logSeoValidation(
  store: BlogCreateStore,
  params: {
    loaded: { conversation: ConversationRecord; tenant: TenantRecord };
    decision: DecisionResult;
    post: BlogPostJson;
    result: SeoValidationResult;
    targetBlogPostId?: string;
  }
): Promise<void> {
  if (!store.insertSeoValidationLog) return;

  try {
    await store.insertSeoValidationLog({
      tenantId: params.loaded.tenant.id,
      conversationId: params.loaded.conversation.id,
      action: params.decision.action === "update" ? "update" : "create",
      reason: params.result.ok
        ? "SEO metadata validation passed"
        : "SEO metadata validation found issues",
      primaryKeyword: params.decision.primary_keyword,
      intent: params.decision.intent,
      targetBlogPostId: params.targetBlogPostId,
      metadata: {
        phase: "seo_validation",
        ok: params.result.ok,
        issues: params.result.issues,
        slug: params.post.slug,
        metaTitleLength: params.post.seo?.metaTitle?.trim().length ?? 0,
        metaDescriptionLength:
          params.post.seo?.metaDescription?.trim().length ?? 0,
      },
    });
  } catch (error) {
    console.warn("[blog] seo validation logging failed", {
      conversationId: params.loaded.conversation.id,
      tenantId: params.loaded.tenant.id,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function logQualityGateViolation(
  store: BlogCreateStore,
  params: {
    loaded: { conversation: ConversationRecord; tenant: TenantRecord };
    decision: DecisionResult;
    violation: WordCountGateViolation;
    targetBlogPostId?: string;
  }
): Promise<void> {
  if (!store.insertSeoValidationLog) return;

  try {
    await store.insertSeoValidationLog({
      tenantId: params.loaded.tenant.id,
      conversationId: params.loaded.conversation.id,
      action: params.decision.action === "update" ? "update" : "create",
      reason: params.violation.message,
      primaryKeyword: params.decision.primary_keyword,
      intent: params.decision.intent,
      targetBlogPostId: params.targetBlogPostId,
      metadata: {
        phase: "quality_gate_word_count",
        code: params.violation.code,
        stats: params.violation.stats,
      },
    });
  } catch (error) {
    console.warn("[blog] word-count quality gate logging failed", {
      conversationId: params.loaded.conversation.id,
      tenantId: params.loaded.tenant.id,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function logRepairPass(
  store: BlogCreateStore,
  params: {
    loaded: { conversation: ConversationRecord; tenant: TenantRecord };
    decision: DecisionResult;
    violation: WritingRuleViolation;
    repairPass: number;
    operations: RepairOperation[];
    targetBlogPostId?: string;
  }
): Promise<void> {
  if (!store.insertSeoValidationLog) return;

  try {
    await store.insertSeoValidationLog({
      tenantId: params.loaded.tenant.id,
      conversationId: params.loaded.conversation.id,
      action: params.decision.action === "update" ? "update" : "create",
      reason: `Article contract repaired: ${params.violation.message}`,
      primaryKeyword: params.decision.primary_keyword,
      intent: params.decision.intent,
      targetBlogPostId: params.targetBlogPostId,
      metadata: {
        phase: "repair_loop",
        repairPass: params.repairPass,
        originalViolation: {
          code: params.violation.code,
          message: params.violation.message,
          sentence: params.violation.sentence,
        },
        operations: params.operations,
      },
    });
  } catch (error) {
    console.warn("[blog] repair-pass logging failed", {
      conversationId: params.loaded.conversation.id,
      tenantId: params.loaded.tenant.id,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

async function persistFailure(
  store: BlogCreateStore,
  params: {
    loaded: { conversation: ConversationRecord; tenant: TenantRecord };
    decision: DecisionResult;
    reason: string;
    editorialBriefId?: string;
  }
): Promise<string> {
  console.error("[blog] article generation failed", {
    conversationId: params.loaded.conversation.id,
    tenantId: params.loaded.tenant.id,
    reason: params.reason,
  });

  const baseSlug = generateSlug(
    `generation-failed-${params.loaded.conversation.id.slice(0, 8)}`
  );
  const slug = await uniqueSlug(store, params.loaded.tenant.id, baseSlug);
  const [titleKeyword] = [
    params.decision.primary_keyword?.trim() || "Blog article generation",
  ];

  const row = await store.insertBlogPost({
    tenantId: params.loaded.tenant.id,
    threadId: params.loaded.conversation.id,
    title: `${titleKeyword} generation failed`,
    slug,
    content: "",
    metadata: {
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

function buildCreateService(deps: BlogCreateDeps) {
  return {
    async createArticle(
      conversationId: string,
      decision: DecisionResult
    ): Promise<string> {
      const loaded = await deps.store.loadConversation(conversationId);
      if (!loaded) throw new Error(`Conversation not found: ${conversationId}`);

      let brief: BlogBrief;
      let editorialBriefId: string | undefined;
      let hasConfiguredSeoTargets = false;
      try {
        const seoStrategy = deps.store.loadTenantSeoStrategy
          ? await deps.store.loadTenantSeoStrategy(loaded.tenant.id)
          : null;
        hasConfiguredSeoTargets = Boolean(seoStrategy?.targetKeywords.length);
        brief = buildBrief(conversationId, decision, {
          tenant: loaded.tenant,
          messages: loaded.messages,
          seoStrategy,
        });
        if (deps.store.insertEditorialBrief) {
          editorialBriefId = (await deps.store.insertEditorialBrief(brief.editorial)).id;
          brief.editorial.id = editorialBriefId;
        }
      } catch (error) {
        return persistFailure(deps.store, {
          loaded,
          decision,
          reason: error instanceof Error ? error.message : String(error),
        });
      }

      let finalPost: BlogPostJson | null = null;
      let finalHtml = "";
      let finalSemanticHtml = "";
      let finalWordCount: number | null = null;
      let failureReason = "Article generation failed.";
      const allEmDashReplacements: Array<{ before: string; after: string }> = [];
      const repairOperations: RepairOperation[] = [];

      const raw = await generateWithRateLimitRetry(
        deps.ai,
        {
          systemPrompt: buildSystemPrompt(brief),
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
          reason: failureReason,
          editorialBriefId,
        });
      }

      let candidate: BlogPostJson;
      try {
        candidate = normalisePostHero(parsePostJson(raw), brief);
      } catch (error) {
        return persistFailure(deps.store, {
          loaded,
          decision,
          reason: error instanceof Error ? error.message : `Invalid JSON: ${String(error)}`,
          editorialBriefId,
        });
      }

      for (let repairPass = 0; !finalPost && repairPass <= MAX_REPAIR_PASSES; repairPass++) {
        try {
          const validated = validateCandidate(candidate, brief, deps.validate);
          const slug = await uniqueGeneratedSlug(
            deps.store,
            brief.tenant.id,
            validated.post.title
          );
          finalPost = { ...validated.post, slug };
          finalWordCount = validated.wordCount;
          const seoValidation = validateSeoMetadata(finalPost);
          await logSeoValidation(deps.store, {
            loaded,
            decision,
            post: finalPost,
            result: seoValidation,
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
            });
          }
          if (repairPass >= MAX_REPAIR_PASSES) {
            console.error("[blog] article repair loop exhausted", {
              conversationId,
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
                  : `Article repair failed: ${String(repairError)}`;
              return null;
            }
          );
          if (!repair) break;
          candidate = normalisePostHero(repair.post, brief);
          repairOperations.push(...repair.operations);
          await logRepairPass(deps.store, {
            loaded,
            decision,
            violation,
            repairPass: repairPass + 1,
            operations: repair.operations,
          });
          console.info("[blog] article contract repair applied", {
            conversationId,
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
          reason: failureReason,
          editorialBriefId,
        });
      }
      if (finalWordCount === null) {
        throw new Error("Validated article is missing word count");
      }

      const metadata = buildBlogPostMetadata(finalPost, finalWordCount, {
        generation: {
          decision,
          editorialBrief: brief.editorial,
          emDashReplacements: allEmDashReplacements,
          repairOperations,
        },
      });
      const row = await deps.store.insertBlogPost({
        tenantId: loaded.tenant.id,
        threadId: conversationId,
        title: finalPost.title,
        slug: finalPost.slug,
        content: finalHtml,
        contentSemantic: finalSemanticHtml,
          metadata,
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

      if (deps.heroImages) {
        const heroResult = await deps.heroImages.generate({
          tenantId: loaded.tenant.id,
          postId: row.id,
          post: finalPost,
          metadata,
        });

        if (heroResult?.ok) {
          const metadataWithHero = applyAiHeroToMetadata({
            metadata,
            url: heroResult.url,
            path: heroResult.path,
            prompt: heroResult.prompt,
            generationNumber: heroResult.generationNumber,
          });
          const postWithHero = {
            ...finalPost,
            hero: {
              ...finalPost.hero,
              url: heroResult.url,
            },
            seo: {
              ...finalPost.seo,
              ogImage: heroResult.url,
            },
          };
          await deps.heroImages.persist({
            tenantId: loaded.tenant.id,
            postId: row.id,
            metadata: metadataWithHero,
            content: stripRenderedEmDashes(
              deps.render({ brand: brief.tenant.brandJson, post: postWithHero })
            ),
            contentSemantic: stripRenderedEmDashes(
              deps.renderSemantic({ brand: brief.tenant.brandJson, post: postWithHero })
            ),
          });
        }
      }

      return row.id;
    },
  };
}

export class OpenAiBlogCreateClient implements BlogCreateAi {
  constructor(private openai?: OpenAI) {}

  private client(): OpenAI {
    this.openai ??= getOpenAIClient();
    return this.openai;
  }

  async generatePost(params: {
    systemPrompt: string;
    userPrompt: string;
  }): Promise<string> {
    // JSON-mode + Zod validation on the response (parsePostJson in the caller)
    // is the same pattern used by `decision.ts`. OpenAI strict structured-output
    // mode enforces a restrictive JSON-Schema subset (no oneOf, no minItems,
    // limited constraint keywords, every property required, etc.) which is
    // impractical for this schema. Instead we ask for JSON, embed the schema
    // in the system prompt for guidance, and enforce the schema strictly on the
    // client side. See CON-278.
    const response = await this.client().chat.completions.create({
      model: "gpt-4o",
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: params.systemPrompt },
        { role: "user", content: params.userPrompt },
      ],
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) throw new Error("OpenAI article generation returned no content");
    return raw;
  }
}

export class DrizzleBlogCreateStore implements BlogCreateStore {
  async loadConversation(conversationId: string) {
    const [conversation] = await db
      .select({ id: conversations.id, tenantId: conversations.tenantId })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (!conversation) return null;

    const [tenant] = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        domain: tenants.domain,
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
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt));

    return { conversation, tenant, messages: conversationMessages };
  }

  async slugExists(tenantId: string, slug: string): Promise<boolean> {
    const [row] = await db
      .select({ id: blogPosts.id })
      .from(blogPosts)
      .where(and(eq(blogPosts.tenantId, tenantId), eq(blogPosts.slug, slug)))
      .limit(1);
    return Boolean(row);
  }

  async insertBlogPost(values: {
    tenantId: string;
    threadId: string;
    title: string;
    slug: string;
    content: string;
    metadata: Record<string, unknown>;
    status: "draft" | "in_review" | "generation_failed" | "update_pending";
    persona: string | null;
    topic: string | null;
  }): Promise<{ id: string }> {
    const [row] = await db
      .insert(blogPosts)
      .values(values)
      .returning({ id: blogPosts.id });
    return row;
  }

  async insertSeoValidationLog(input: {
    tenantId: string;
    conversationId: string;
    action: "create" | "update";
    reason: string;
    primaryKeyword: string | null;
    intent: string | null;
    targetBlogPostId?: string;
    metadata: Record<string, unknown>;
  }): Promise<{ id: string }> {
    const [row] = await db
      .insert(blogDecisionLogs)
      .values({
        tenantId: input.tenantId,
        conversationId: input.conversationId,
        action: input.action,
        reason: input.reason,
        similarPosts: [],
        primaryKeyword: input.primaryKeyword,
        intent: input.intent,
        targetBlogPostId: input.targetBlogPostId,
        metadata: input.metadata,
      })
      .returning({ id: blogDecisionLogs.id });
    return row;
  }

  async loadTenantSeoStrategy(tenantId: string): Promise<TenantSeoStrategy | null> {
    const [row] = await db
      .select()
      .from(tenantSeoStrategy)
      .where(eq(tenantSeoStrategy.tenantId, tenantId))
      .limit(1);
    if (!row) return null;
    return {
      id: row.id,
      tenantId: row.tenantId,
      targetKeywords: row.targetKeywords,
      priorityServices: row.priorityServices,
      priorityLocations: row.priorityLocations,
      targetAudiences: row.targetAudiences,
      approvedInternalUrls: row.approvedInternalUrls,
      preferredCtas: row.preferredCtas,
      avoidTopics: row.avoidTopics,
      avoidClaims: row.avoidClaims,
      avoidKeywords: row.avoidKeywords,
      revision: row.revision,
    };
  }

  async insertEditorialBrief(brief: EditorialBrief): Promise<{ id: string }> {
    const [row] = await db
      .insert(blogEditorialBriefs)
      .values({
        blogPostId: brief.blogPostId ?? null,
        conversationId: brief.conversationId,
        tenantId: brief.tenantId,
        selectedPrimaryKeyword: brief.selectedPrimaryKeyword,
        selectionRationale: brief.selectionRationale,
        supportingKeywords: brief.supportingKeywords,
        supportingEntities: brief.supportingEntities,
        conversationEvidence: brief.conversationEvidence,
        tenantFactsUsed: brief.tenantFactsUsed,
        missingDataFallbacks: brief.missingDataFallbacks,
        requiredModules: brief.requiredModules,
        internalLinkPlan: brief.internalLinkPlan,
        ctaPlan: brief.ctaPlan,
        createUpdateSkip: brief.createUpdateSkip,
        createUpdateSkipRationale: brief.createUpdateSkipRationale,
        noStrongTarget: brief.noStrongTarget,
        needsReview: brief.needsReview,
      })
      .returning({ id: blogEditorialBriefs.id });
    return row;
  }

  async linkEditorialBriefToBlogPost(briefId: string, blogPostId: string): Promise<void> {
    await db
      .update(blogEditorialBriefs)
      .set({ blogPostId, updatedAt: new Date() })
      .where(eq(blogEditorialBriefs.id, briefId));
  }

  async upsertBlogPostSeo(blogPostId: string, fields: ArticleSeoFields): Promise<void> {
    await db
      .insert(blogPostSeo)
      .values({
        blogPostId,
        primaryKeyword: fields.primaryKeyword,
        secondaryKeywords: fields.secondaryKeywords,
        searchIntent: fields.searchIntent,
        targetAudience: fields.targetAudience,
        articleType: fields.articleType,
        internalLinkSuggestions: fields.internalLinkSuggestions,
        ctaGoal: fields.ctaGoal,
      })
      .onConflictDoUpdate({
        target: blogPostSeo.blogPostId,
        set: {
          primaryKeyword: fields.primaryKeyword,
          secondaryKeywords: fields.secondaryKeywords,
          searchIntent: fields.searchIntent,
          targetAudience: fields.targetAudience,
          articleType: fields.articleType,
          internalLinkSuggestions: fields.internalLinkSuggestions,
          ctaGoal: fields.ctaGoal,
          updatedAt: new Date(),
        },
      });
  }
}

const require = createRequire(import.meta.url);
const templatePackDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "template-pack"
);
const { render: packRender } = require("./template-pack/renderer.js") as {
  render: (params: {
    brand: BrandJson;
    post: BlogPostJson;
    stylesPath: string;
    templatePath: string;
  }) => string;
};
const { renderSemantic: packRenderSemantic } = require("./template-pack/renderer.js") as {
  renderSemantic: (params: {
    brand: BrandJson;
    post: BlogPostJson;
  }) => string;
};
const { validate: rawPackValidate } = require("./template-pack/validate.js") as {
  validate: (
    params: { brand: BrandJson; post: BlogPostJson; schemas?: unknown }
  ) => ValidationResult;
};
// Inject the JSON schemas so validate.js doesn't fs.readFileSync at runtime
// (Next.js does not bundle files loaded via dynamic fs paths — see CON-279
// ENOENT on Vercel). Static imports above are bundle-safe.
//
// Note: brand JSON is our own data (built by `buildDefaultBrand` or read
// from tenant `settings.brandJson`); the OpenAI model does NOT generate it.
// Strict AJV validation on the brand was originally added because
// `validate.js` validates both, but it fails on legacy tenant brand data
// that predates the CON-276 required-field sweep. Skip brand validation
// here — the schema still guides the renderer and is enforced end-to-end
// via the schema-test suite. See CON-280.
export const packValidate: BlogValidator = ({ brand: _brand, post }) => {
  const results = rawPackValidate({
    brand: {} as BrandJson,
    post,
    schemas: { brand: brandSchema, post: postSchema },
  });
  return results.filter((r) => r.file !== "brand");
};

export const defaultBlogRender: BlogRenderer = ({ brand, post }) =>
  packRender({
    brand,
    post,
    stylesPath: path.join(templatePackDir, "_tokenised.css"),
    templatePath: path.join(templatePackDir, "template.html"),
  });

export const defaultBlogSemanticRender: BlogRenderer = ({ brand, post }) =>
  packRenderSemantic({ brand, post });

const defaultService = buildCreateService({
  store: new DrizzleBlogCreateStore(),
  ai: new OpenAiBlogCreateClient(),
  validate: packValidate,
  render: defaultBlogRender,
  renderSemantic: defaultBlogSemanticRender,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  heroImages: {
    async generate({ tenantId, postId, post, metadata }) {
      const tenant = await loadTenantHeroImageConfig(tenantId);
      if (!tenant) return null;
      return generateAndStoreHeroImage({ tenant, postId, post, metadata });
    },
    async persist({ tenantId, postId, metadata, content, contentSemantic }) {
      await persistGeneratedHero({
        tenantId,
        postId,
        metadata,
        content,
        contentSemantic,
      });
    },
  },
});

export async function createArticle(
  conversationId: string,
  decision: DecisionResult
): Promise<string> {
  return defaultService.createArticle(conversationId, decision);
}

export async function markUpdatePending(
  conversationId: string,
  decision: DecisionResult
): Promise<string> {
  const store = new DrizzleBlogCreateStore();
  const loaded = await store.loadConversation(conversationId);
  if (!loaded) throw new Error(`Conversation not found: ${conversationId}`);
  const slug = await uniqueSlug(
    store,
    loaded.tenant.id,
    generateSlug(`update-pending-${conversationId.slice(0, 8)}`)
  );
  const row = await store.insertBlogPost({
    tenantId: loaded.tenant.id,
    threadId: conversationId,
    title: decision.primary_keyword
      ? `${decision.primary_keyword} update pending`
      : "Blog update pending",
    slug,
    content: "",
    metadata: {
      update_pending: {
        decision,
        targetBlogPostId: decision.target_blog_post_id,
        notedAt: new Date().toISOString(),
      },
    },
    status: "update_pending",
    persona: decision.primary_keyword,
    topic: decision.intent,
  });
  return row.id;
}

export const __testing = {
  buildCreateService,
  buildBrief,
  buildSystemPrompt,
  heroPlaceholderUrl,
  logRepairPass,
  logSeoValidation,
  normalisePostHero,
  resolveCtaConfig,
  resolveBrandJson,
  uniqueGeneratedSlug,
  validateCandidate,
};
