/**
 * Topic extraction from conversation messages using GPT-4o-mini.
 * Includes audience tagging and content categorisation.
 */
import OpenAI from "openai";

export type UserIntent = "faq" | "educational" | "product-specific" | "support";
export type ArticleType = "blog" | "faq" | "page_section";
export type AudienceTag = "buyer" | "breeder" | "general";
export type ContentCategory =
  | "breed guide"
  | "care guide"
  | "breeder help"
  | "faq"
  | "listicle";

export interface ExtractedTopic {
  primaryTopic: string;
  subtopics: string[];
  userIntent: UserIntent;
  suggestedArticleType: ArticleType;
  seoKeywords: string[];
  confidence: number;
  audience: AudienceTag;
  contentCategory: ContentCategory;
}

const EXTRACTION_PROMPT = `You are an SEO content strategist. Analyze the following conversation between a website visitor and a chatbot.

Extract:
1. **primaryTopic**: The main topic/question the visitor is asking about (concise, 3-8 words)
2. **subtopics**: Related subtopics mentioned (array of strings)
3. **userIntent**: One of: "faq" (simple question), "educational" (wants to learn), "product-specific" (about a product/service), "support" (needs help with an issue)
4. **suggestedArticleType**: One of: "blog" (in-depth article), "faq" (short Q&A), "page_section" (brief content block)
5. **seoKeywords**: Target SEO keywords that would help this content rank (array, 3-8 keywords)
6. **confidence**: How confident you are this is a meaningful topic worth creating content for (0-1, where 1 = definitely worth it)
7. **audience**: Who this conversation is from — one of: "buyer" (someone looking to purchase/browse), "breeder" (a business/supplier/seller), "general" (neither clearly)
8. **contentCategory**: The best content category for the resulting article — one of: "breed guide" (information about specific breeds/products), "care guide" (how-to/care/maintenance advice), "breeder help" (help for sellers/businesses using the platform), "faq" (frequently asked question), "listicle" (list-based article)

Respond with valid JSON only, no markdown fences.`;

function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  return new OpenAI({ apiKey });
}

export async function extractTopics(
  conversationMessages: { role: string; content: string }[]
): Promise<ExtractedTopic> {
  const transcript = conversationMessages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");

  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    messages: [
      { role: "system", content: EXTRACTION_PROMPT },
      { role: "user", content: transcript },
    ],
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error("No response from topic extraction");

  const parsed = JSON.parse(raw) as ExtractedTopic;

  // Validate and clamp confidence
  parsed.confidence = Math.max(0, Math.min(1, parsed.confidence ?? 0.5));

  // Default audience/category if LLM didn't return them
  if (!parsed.audience || !["buyer", "breeder", "general"].includes(parsed.audience)) {
    parsed.audience = "general";
  }
  if (
    !parsed.contentCategory ||
    !["breed guide", "care guide", "breeder help", "faq", "listicle"].includes(
      parsed.contentCategory
    )
  ) {
    parsed.contentCategory = "faq";
  }

  return parsed;
}
