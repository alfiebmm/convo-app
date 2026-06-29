/**
 * Article generation from a topic + source conversation using GPT-4o.
 */
import OpenAI from "openai";
import { db } from "../db";
import { content } from "../db/schema";
import {
  validateOutputLinks,
  type LinkHostFinding,
} from "../guardrails/link-host";
import type { ExtractedTopic } from "./extract-topics";
import { slugify } from "./dedup";

export interface GeneratedArticle {
  id: string;
  title: string;
  slug: string;
  metaDescription: string;
  body: string;
  seoScore: number;
  type: string;
  status: string;
}

export class ArticleLinkPolicyError extends Error {
  readonly code = "ARTICLE_LINK_POLICY_VIOLATION";
  readonly findings: LinkHostFinding[];
  readonly tenantDomain: string;
  readonly attempts: number;

  constructor(params: {
    tenantDomain: string;
    attempts: number;
    findings: LinkHostFinding[];
  }) {
    super(
      `Article generation produced non-tenant links after ${params.attempts} attempts`
    );
    this.name = "ArticleLinkPolicyError";
    this.tenantDomain = params.tenantDomain;
    this.attempts = params.attempts;
    this.findings = params.findings;
  }
}

interface ArticleGenerationDeps {
  createCompletion?: (
    messages: Array<{ role: "system" | "user"; content: string }>
  ) => Promise<string>;
  insertContent?: (values: {
    tenantId: string;
    topicId: string;
    conversationId: string;
    status: "review";
    type: string;
    title: string;
    slug: string;
    metaDescription: string;
    body: string;
    seoScore: number;
  }) => Promise<GeneratedArticle>;
}

const MAX_ARTICLE_GENERATION_ATTEMPTS = 2;

function buildArticleRetryReminder(tenantDomain: string): string {
  return (
    `Your previous response contained a link to a non-tenant domain. ` +
    `Only link to https://${tenantDomain}.`
  );
}

// TODO(Blake-sign-off): prepend linking hard-rule block to ARTICLE_PROMPT.
const ARTICLE_PROMPT = `You are an expert SEO content writer. Generate a high-quality, informative article based on the topic and conversation below.

Requirements:
1. **title**: Compelling, keyword-rich title (50-70 chars ideal)
2. **metaDescription**: SEO meta description (150-160 chars, includes primary keyword)
3. **slug**: URL-friendly slug
4. **body**: Full article in markdown with:
   - Clear H2 and H3 structure
   - Natural keyword usage (not stuffed)
   - Actionable, valuable content
   - 500-1500 words depending on topic depth
   - Conversational but authoritative tone
5. **seoScore**: Self-assessed SEO quality score (0-1)

Respond with valid JSON only, no markdown fences. Keys: title, metaDescription, slug, body, seoScore`;

function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  return new OpenAI({ apiKey });
}

export async function generateArticle(
  tenantId: string,
  tenantDomain: string,
  topicId: string,
  conversationId: string,
  topic: ExtractedTopic,
  conversationMessages: { role: string; content: string }[],
  deps: ArticleGenerationDeps = {}
): Promise<GeneratedArticle> {
  const transcript = conversationMessages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");

  const context = `TOPIC: ${topic.primaryTopic}
SUBTOPICS: ${topic.subtopics.join(", ")}
USER INTENT: ${topic.userIntent}
ARTICLE TYPE: ${topic.suggestedArticleType}
TARGET AUDIENCE: ${topic.audience ?? "general"}
CONTENT CATEGORY: ${topic.contentCategory ?? "faq"}
SEO KEYWORDS: ${topic.seoKeywords.join(", ")}

SOURCE CONVERSATION:
${transcript}`;

  const createCompletion = deps.createCompletion ?? (async (messages) => {
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.7,
      messages,
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) throw new Error("No response from article generation");
    return raw;
  });

  let parsed: {
    title: string;
    metaDescription: string;
    slug: string;
    body: string;
    seoScore: number;
  } | null = null;
  let lastFindings: LinkHostFinding[] = [];

  for (let attempt = 1; attempt <= MAX_ARTICLE_GENERATION_ATTEMPTS; attempt++) {
    const raw = await createCompletion([
      { role: "system", content: ARTICLE_PROMPT },
      {
        role: "user",
        content:
          attempt === 1
            ? context
            : `${context}\n\n${buildArticleRetryReminder(tenantDomain)}`,
      },
    ]);

    const candidate = JSON.parse(raw) as {
      title: string;
      metaDescription: string;
      slug: string;
      body: string;
      seoScore: number;
    };

    const validation = validateOutputLinks(candidate.body, tenantDomain);
    if (validation.ok) {
      parsed = candidate;
      lastFindings = [];
      break;
    }

    lastFindings = validation.findings;
  }

  if (!parsed) {
    throw new ArticleLinkPolicyError({
      tenantDomain,
      attempts: MAX_ARTICLE_GENERATION_ATTEMPTS,
      findings: lastFindings,
    });
  }

  // Ensure slug is valid
  const articleSlug = slugify(parsed.slug || parsed.title);

  const insertContent = deps.insertContent ?? (async (values) => {
    const [record] = await db.insert(content).values(values).returning();
    return {
      id: record.id,
      title: record.title ?? "",
      slug: record.slug ?? "",
      metaDescription: record.metaDescription ?? "",
      body: record.body ?? "",
      seoScore: record.seoScore ?? 0,
      type: record.type,
      status: record.status,
    };
  });

  // Insert into content table
  return insertContent({
    tenantId,
    topicId,
    conversationId,
    status: "review",
    type: topic.suggestedArticleType,
    title: parsed.title,
    slug: articleSlug,
    metaDescription: parsed.metaDescription,
    body: parsed.body,
    seoScore: Math.max(0, Math.min(1, parsed.seoScore ?? 0.5)),
  });
}
