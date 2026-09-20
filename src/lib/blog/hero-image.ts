import { eq, and, sql } from "drizzle-orm";
import type OpenAI from "openai";

import { db } from "@/lib/db";
import { blogPosts, tenantAiImageUsage, tenants } from "@/lib/db/schema";
import { getOpenAIClient } from "@/lib/openai";
import { getSupabaseClient } from "@/lib/supabase-client";

import type { BrandJson } from "./create";
import type { BlogPostJson } from "./writing-rules";

export const HERO_IMAGE_BUCKET = "tenant-brand-assets";
export const SYSTEM_HERO_IMAGE_STYLE_PROMPT =
  "photorealistic natural light editorial hero image, no text, no logos, 16:9 composition, subject relevant to the article topic";
export const DEFAULT_HERO_IMAGE_MONTHLY_CAP_CENTS = 1000;
export const ESTIMATED_GPT_IMAGE_1_COST_CENTS = 4;

export type HeroImageUsage = {
  month: string;
  spendCents: number;
  imageCount: number;
  capCents: number;
};

export type HeroImageTenantConfig = {
  id: string;
  name: string;
  blogAiHeroEnabled: boolean;
  heroImageStylePrompt: string | null;
  blogAiHeroMonthlyCapCents: number;
};

export type HeroImageResult =
  | {
      ok: true;
      url: string;
      path: string;
      prompt: string;
      generationNumber: number;
      usage: HeroImageUsage;
    }
  | {
      ok: false;
      reason:
        | "feature_disabled"
        | "cost_cap_reached"
        | "generation_failed"
        | "upload_failed";
      prompt?: string;
      usage: HeroImageUsage;
      error?: string;
    };

type OpenAiImageClient = Pick<OpenAI["images"], "generate">;

export function currentUsageMonth(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

export function heroImageStylePrompt(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || SYSTEM_HERO_IMAGE_STYLE_PROMPT;
}

export function articleTopicForHero(post: Pick<BlogPostJson, "title" | "intro">) {
  const firstParagraph = post.intro.replace(/\s+/g, " ").trim();
  return [post.title.trim(), firstParagraph].filter(Boolean).join(" — ");
}

export function buildHeroImagePrompt({
  stylePrompt,
  post,
}: {
  stylePrompt: string | null | undefined;
  post: Pick<BlogPostJson, "title" | "intro">;
}) {
  return `${heroImageStylePrompt(stylePrompt)} — ${articleTopicForHero(post)}`;
}

export function heroImageStoragePath({
  tenantId,
  postId,
  generationNumber,
}: {
  tenantId: string;
  postId: string;
  generationNumber: number;
}) {
  return `${tenantId}/blog/${postId}-hero-${generationNumber}.jpg`;
}

export function heroImageCapState({
  spendCents,
  capCents,
  nextImageCostCents = ESTIMATED_GPT_IMAGE_1_COST_CENTS,
}: {
  spendCents: number;
  capCents: number;
  nextImageCostCents?: number;
}) {
  const cap = Math.max(0, capCents);
  const percentage = cap === 0 ? 100 : Math.floor((spendCents / cap) * 100);
  return {
    allowed: cap > 0 && spendCents + nextImageCostCents <= cap,
    warning: cap > 0 && spendCents >= cap * 0.8,
    percentage: Math.min(100, percentage),
  };
}

export function activeHeroUrl({
  aiHeroUrl,
  generatedHeroUrl,
  placeholderUrl,
  enabled = true,
}: {
  aiHeroUrl?: string | null;
  generatedHeroUrl?: string | null;
  placeholderUrl: string;
  enabled?: boolean;
}) {
  if (!enabled) return placeholderUrl;
  return aiHeroUrl || generatedHeroUrl || placeholderUrl;
}

export function nextHeroGenerationNumber(metadata: Record<string, unknown>) {
  const state = metadata.aiHeroImage;
  if (!state || typeof state !== "object" || Array.isArray(state)) return 1;
  const images = (state as Record<string, unknown>).images;
  return Array.isArray(images) ? images.length + 1 : 1;
}

export function applyAiHeroToMetadata({
  metadata,
  url,
  path,
  prompt,
  generationNumber,
  costCents = ESTIMATED_GPT_IMAGE_1_COST_CENTS,
}: {
  metadata: Record<string, unknown>;
  url: string;
  path: string;
  prompt: string;
  generationNumber: number;
  costCents?: number;
}) {
  const previousState =
    metadata.aiHeroImage &&
    typeof metadata.aiHeroImage === "object" &&
    !Array.isArray(metadata.aiHeroImage)
      ? (metadata.aiHeroImage as Record<string, unknown>)
      : {};
  const previousImages = Array.isArray(previousState.images)
    ? previousState.images
    : [];
  const hero =
    metadata.hero && typeof metadata.hero === "object" && !Array.isArray(metadata.hero)
      ? (metadata.hero as Record<string, unknown>)
      : {};
  const seo =
    metadata.seo && typeof metadata.seo === "object" && !Array.isArray(metadata.seo)
      ? (metadata.seo as Record<string, unknown>)
      : {};

  return {
    ...metadata,
    hero: {
      ...hero,
      url,
    },
    seo: {
      ...seo,
      ogImage: url,
    },
    aiHeroImage: {
      ...previousState,
      activeUrl: url,
      revertedAt: null,
      lastError: null,
      images: [
        ...previousImages,
        {
          url,
          path,
          prompt,
          generationNumber,
          costCents,
          generatedAt: new Date().toISOString(),
        },
      ],
    },
  };
}

export function revertAiHeroMetadata({
  metadata,
  placeholderUrl,
}: {
  metadata: Record<string, unknown>;
  placeholderUrl: string;
}) {
  const previousState =
    metadata.aiHeroImage &&
    typeof metadata.aiHeroImage === "object" &&
    !Array.isArray(metadata.aiHeroImage)
      ? (metadata.aiHeroImage as Record<string, unknown>)
      : {};
  const hero =
    metadata.hero && typeof metadata.hero === "object" && !Array.isArray(metadata.hero)
      ? (metadata.hero as Record<string, unknown>)
      : {};
  const seo =
    metadata.seo && typeof metadata.seo === "object" && !Array.isArray(metadata.seo)
      ? (metadata.seo as Record<string, unknown>)
      : {};

  return {
    ...metadata,
    hero: {
      ...hero,
      url: placeholderUrl,
    },
    seo: {
      ...seo,
      ogImage: placeholderUrl,
    },
    aiHeroImage: {
      ...previousState,
      activeUrl: null,
      revertedAt: new Date().toISOString(),
    },
  };
}

export async function getTenantHeroImageUsage(
  tenantId: string,
  capCents = DEFAULT_HERO_IMAGE_MONTHLY_CAP_CENTS,
  month = currentUsageMonth(),
): Promise<HeroImageUsage> {
  const [usage] = await db
    .select({
      spendCents: tenantAiImageUsage.spendCents,
      imageCount: tenantAiImageUsage.imageCount,
    })
    .from(tenantAiImageUsage)
    .where(
      and(
        eq(tenantAiImageUsage.tenantId, tenantId),
        eq(tenantAiImageUsage.month, month),
      ),
    )
    .limit(1);

  return {
    month,
    spendCents: usage?.spendCents ?? 0,
    imageCount: usage?.imageCount ?? 0,
    capCents,
  };
}

export async function recordTenantHeroImageUsage({
  tenantId,
  month = currentUsageMonth(),
  costCents = ESTIMATED_GPT_IMAGE_1_COST_CENTS,
}: {
  tenantId: string;
  month?: string;
  costCents?: number;
}) {
  await db
    .insert(tenantAiImageUsage)
    .values({
      tenantId,
      month,
      spendCents: costCents,
      imageCount: 1,
    })
    .onConflictDoUpdate({
      target: [tenantAiImageUsage.tenantId, tenantAiImageUsage.month],
      set: {
        spendCents: sql`${tenantAiImageUsage.spendCents} + ${costCents}`,
        imageCount: sql`${tenantAiImageUsage.imageCount} + 1`,
        updatedAt: new Date(),
      },
    });
}

export async function loadTenantHeroImageConfig(
  tenantId: string,
): Promise<HeroImageTenantConfig | null> {
  const [tenant] = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      blogAiHeroEnabled: tenants.blogAiHeroEnabled,
      heroImageStylePrompt: tenants.heroImageStylePrompt,
      blogAiHeroMonthlyCapCents: tenants.blogAiHeroMonthlyCapCents,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  return tenant ?? null;
}

async function generateImageBytes(client: OpenAiImageClient, prompt: string) {
  const response = (await client.generate({
    model: "gpt-image-1",
    prompt,
    size: "1536x1024",
    output_format: "jpeg",
  } as Parameters<OpenAiImageClient["generate"]>[0])) as {
    data?: Array<{ b64_json?: string | null; url?: string | null }>;
  };
  const image = response.data?.[0];
  const b64 = image && "b64_json" in image ? image.b64_json : null;
  if (b64) return Buffer.from(b64, "base64");

  const url = image && "url" in image ? image.url : null;
  if (url) {
    const fetched = await fetch(url);
    if (!fetched.ok) throw new Error(`Image download failed: ${fetched.status}`);
    return Buffer.from(await fetched.arrayBuffer());
  }

  throw new Error("OpenAI did not return image data");
}

export async function generateAndStoreHeroImage({
  tenant,
  postId,
  post,
  metadata,
  openai,
}: {
  tenant: HeroImageTenantConfig;
  postId: string;
  post: Pick<BlogPostJson, "title" | "intro">;
  metadata: Record<string, unknown>;
  openai?: OpenAiImageClient;
}): Promise<HeroImageResult> {
  const usage = await getTenantHeroImageUsage(
    tenant.id,
    tenant.blogAiHeroMonthlyCapCents,
  );
  if (!tenant.blogAiHeroEnabled) {
    return { ok: false, reason: "feature_disabled", usage };
  }

  const capState = heroImageCapState({
    spendCents: usage.spendCents,
    capCents: usage.capCents,
  });
  if (!capState.allowed) {
    return { ok: false, reason: "cost_cap_reached", usage };
  }

  const prompt = buildHeroImagePrompt({
    stylePrompt: tenant.heroImageStylePrompt,
    post,
  });
  const generationNumber = nextHeroGenerationNumber(metadata);
  const path = heroImageStoragePath({
    tenantId: tenant.id,
    postId,
    generationNumber,
  });

  let bytes: Buffer;
  try {
    bytes = await generateImageBytes(openai ?? getOpenAIClient().images, prompt);
  } catch (error) {
    return {
      ok: false,
      reason: "generation_failed",
      prompt,
      usage,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.storage.from(HERO_IMAGE_BUCKET).upload(path, bytes, {
      contentType: "image/jpeg",
      upsert: true,
    });
    if (error) throw error;
    const { data } = supabase.storage.from(HERO_IMAGE_BUCKET).getPublicUrl(path);
    await recordTenantHeroImageUsage({ tenantId: tenant.id, month: usage.month });

    return {
      ok: true,
      url: data.publicUrl,
      path,
      prompt,
      generationNumber,
      usage: {
        ...usage,
        spendCents: usage.spendCents + ESTIMATED_GPT_IMAGE_1_COST_CENTS,
        imageCount: usage.imageCount + 1,
      },
    };
  } catch (error) {
    return {
      ok: false,
      reason: "upload_failed",
      prompt,
      usage,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function persistGeneratedHero({
  postId,
  tenantId,
  metadata,
  content,
  contentSemantic,
}: {
  postId: string;
  tenantId: string;
  metadata: Record<string, unknown>;
  content: string;
  contentSemantic: string;
}) {
  await db
    .update(blogPosts)
    .set({
      metadata,
      content,
      contentSemantic,
      lastModified: new Date(),
    })
    .where(and(eq(blogPosts.id, postId), eq(blogPosts.tenantId, tenantId)));
}

export function blogPostJsonFromMetadata(metadata: Record<string, unknown>) {
  return metadata as unknown as BlogPostJson;
}

export function heroPlaceholderFromMetadata(metadata: Record<string, unknown>) {
  const hero =
    metadata.hero && typeof metadata.hero === "object" && !Array.isArray(metadata.hero)
      ? (metadata.hero as Record<string, unknown>)
      : {};
  return typeof hero.url === "string" && hero.url.trim() ? hero.url : null;
}

export type HeroImageRenderers = {
  render: (params: { brand: BrandJson; post: BlogPostJson }) => string;
  renderSemantic: (params: { brand: BrandJson; post: BlogPostJson }) => string;
};
