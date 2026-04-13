/**
 * Article generation from a topic + source conversation using GPT-4o.
 */
import OpenAI from "openai";
import { db } from "../db";
import { content } from "../db/schema";
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
  topicId: string,
  conversationId: string,
  topic: ExtractedTopic,
  conversationMessages: { role: string; content: string }[]
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

  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.7,
    messages: [
      { role: "system", content: ARTICLE_PROMPT },
      { role: "user", content: context },
    ],
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error("No response from article generation");

  const parsed = JSON.parse(raw) as {
    title: string;
    metaDescription: string;
    slug: string;
    body: string;
    seoScore: number;
  };

  // Ensure slug is valid
  const articleSlug = slugify(parsed.slug || parsed.title);

  // Insert into content table
  const [record] = await db
    .insert(content)
    .values({
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
    })
    .returning();

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
}
