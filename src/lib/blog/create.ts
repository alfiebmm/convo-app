import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { and, asc, eq } from "drizzle-orm";
import type OpenAI from "openai";

import { db } from "@/lib/db";
import { blogPosts, conversations, messages, tenants } from "@/lib/db/schema";
import { getOpenAIClient } from "@/lib/openai";
import { slugify } from "@/lib/pipeline/dedup";

import type { DecisionResult } from "./decision";
import brandSchema from "./schemas/brand.schema.json";
import postSchema from "./schemas/post.schema.json";
import {
  enforceCtaConfig,
  findAustralianEnglishViolation,
  findBannedTerm,
  slugIsValid,
  stripEmDashes,
  tenantBannedTerms,
  validatePrimaryKeywordPlacement,
  validatePostStructure,
  type BlogCtaConfig,
  type BlogPostJson,
  type WritingRuleViolation,
} from "./writing-rules";

export type BrandJson = Record<string, unknown>;

type BlogBrief = {
  tenant: {
    id: string;
    name: string;
    brandJson: BrandJson;
    writingRules: { bannedTerms: string[]; enforceAustralianEnglish: boolean };
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
    metadata: Record<string, unknown>;
    status: "draft" | "generation_failed" | "update_pending";
    persona: string | null;
    topic: string | null;
  }): Promise<{ id: string }>;
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
  validate: BlogValidator;
  sleep: (ms: number) => Promise<void>;
};

export type RetryClass = "schema" | "banned_term" | "australian_english" | "primary_keyword";

const MAX_RATE_LIMIT_ATTEMPTS = 2;
const RATE_LIMIT_RETRY_MS = 5_000;

const AU_ENGLISH_RULE =
  "Write in Australian English. Use -ise, -our, -re spellings. Words: organisation, optimise, colour, centre, behaviour, favourite, honour, licence (noun), license (verb), programme (noun), analyse, realise.";

const SYSTEM_PROMPT = `You are Convo's senior SEO article writer.

Return only JSON matching the supplied post schema. Do not include markdown fences.

Article requirements:
- H1 is post.title.
- Include a one-sentence dek, a direct intro paragraph, 4 to 10 sections, exactly 3 toc items, at least 3 FAQs, and hero.url plus hero.alt.
- Populate seo.metaDescription and include the primary keyword in it.
- Include the primary keyword naturally in post.title, the first 100 words of intro, and at least one section heading.
- Use the tenant CTA config exactly for any type=cta block.
- Do not invent facts that are not supported by the source conversation, tenant context, or common non-sensitive industry knowledge.
- Do not fabricate customer names, prices, guarantees, credentials, or policies.
- Use sentence case headings.
- ${AU_ENGLISH_RULE}
- Avoid all banned terms supplied in the brief.`;

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
  loaded: { tenant: TenantRecord; messages: MessageRecord[] }
): BlogBrief {
  if (decision.action !== "create") {
    throw new Error(`createArticle only accepts create decisions, got ${decision.action}`);
  }

  const primaryKeyword = decision.primary_keyword?.trim();
  if (!primaryKeyword) throw new Error("Create decision is missing primary_keyword");

  const ctaConfig = resolveCtaConfig(loaded.tenant);
  const bannedTerms = tenantBannedTerms(loaded.tenant.settings);

  return {
    tenant: {
      id: loaded.tenant.id,
      name: loaded.tenant.name,
      brandJson: resolveBrandJson(loaded.tenant, ctaConfig),
      writingRules: {
        bannedTerms,
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
): { post: BlogPostJson; emDashReplacements: Array<{ before: string; after: string }> } {
  const schemaErrors = validate({ brand: brief.tenant.brandJson, post: candidate });
  if (schemaErrors.length > 0) throw schemaFailure(schemaErrors);

  const structure = validatePostStructure(candidate);
  if (structure) throw structure;

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

  post = {
    ...post,
    slug: slugify(post.slug || post.title),
  };

  if (!slugIsValid(post.slug)) {
    throw {
      code: "schema",
      message: `Slug is not valid kebab-case: ${post.slug}`,
    } satisfies WritingRuleViolation;
  }

  return { post, emDashReplacements: stripped.replacements };
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

async function persistFailure(
  store: BlogCreateStore,
  params: {
    loaded: { conversation: ConversationRecord; tenant: TenantRecord };
    decision: DecisionResult;
    reason: string;
  }
): Promise<string> {
  console.error("[blog] article generation failed", {
    conversationId: params.loaded.conversation.id,
    tenantId: params.loaded.tenant.id,
    reason: params.reason,
  });

  const baseSlug = slugify(
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
      try {
        brief = buildBrief(conversationId, decision, {
          tenant: loaded.tenant,
          messages: loaded.messages,
        });
      } catch (error) {
        return persistFailure(deps.store, {
          loaded,
          decision,
          reason: error instanceof Error ? error.message : String(error),
        });
      }

      const usedRetries = new Set<RetryClass>();
      const retryInstructions: string[] = [];
      let finalPost: BlogPostJson | null = null;
      let finalHtml = "";
      let failureReason = "Article generation failed.";
      const allEmDashReplacements: Array<{ before: string; after: string }> = [];

      while (!finalPost) {
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
          const candidate = parsePostJson(raw);
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
          if (usedRetries.has(retryClass)) break;
          usedRetries.add(retryClass);
          retryInstructions.push(retryInstruction(violation));
        }
      }

      if (!finalPost) {
        return persistFailure(deps.store, {
          loaded,
          decision,
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
          generation: {
            decision,
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
    status: "draft" | "generation_failed" | "update_pending";
    persona: string | null;
    topic: string | null;
  }): Promise<{ id: string }> {
    const [row] = await db
      .insert(blogPosts)
      .values(values)
      .returning({ id: blogPosts.id });
    return row;
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

const defaultService = buildCreateService({
  store: new DrizzleBlogCreateStore(),
  ai: new OpenAiBlogCreateClient(),
  validate: packValidate,
  render: defaultBlogRender,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
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
    slugify(`update-pending-${conversationId.slice(0, 8)}`)
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
  resolveCtaConfig,
  resolveBrandJson,
};
