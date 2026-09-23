import { NextResponse } from "next/server";
import { z } from "zod";

const keywordSchema = z.object({
  keyword: z.string().trim().min(1).max(160),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  notes: z.string().trim().max(500).optional(),
});
const namedSchema = z.object({
  name: z.string().trim().min(1).max(160),
  url: z.string().trim().url().optional(),
  notes: z.string().trim().max(500).optional(),
});
const locationSchema = z.object({
  name: z.string().trim().min(1).max(160),
  notes: z.string().trim().max(500).optional(),
});
const audienceSchema = z.object({
  persona: z.string().trim().min(1).max(160),
  description: z.string().trim().max(500).optional(),
});
const internalUrlSchema = z.object({
  url: z.string().trim().url(),
  label: z.string().trim().max(160).optional(),
  topic: z.string().trim().max(160).optional(),
});
const ctaSchema = z.object({
  label: z.string().trim().min(1).max(160),
  url: z.string().trim().url().optional(),
  article_type: z.string().trim().max(80).optional(),
  audience: z.string().trim().max(160).optional(),
});

export const seoStrategyPayloadSchema = z.object({
  targetKeywords: z.array(keywordSchema).default([]),
  priorityServices: z.array(namedSchema).default([]),
  priorityLocations: z.array(locationSchema).default([]),
  targetAudiences: z.array(audienceSchema).default([]),
  approvedInternalUrls: z.array(internalUrlSchema).default([]),
  preferredCtas: z.array(ctaSchema).default([]),
  avoidTopics: z.array(z.string().trim().min(1).max(200)).default([]),
  avoidClaims: z.array(z.string().trim().min(1).max(200)).default([]),
  avoidKeywords: z.array(z.string().trim().min(1).max(200)).default([]),
});

export type SeoStrategyPayload = z.infer<typeof seoStrategyPayloadSchema>;
export type SeoStrategyRecord = SeoStrategyPayload & {
  id?: string;
  tenantId: string;
  revision: number;
};

export type SeoStrategyDeps = {
  getStrategy: (tenantId: string) => Promise<SeoStrategyRecord | null>;
  upsertStrategy: (
    tenantId: string,
    payload: SeoStrategyPayload,
  ) => Promise<SeoStrategyRecord>;
};

export function emptySeoStrategy(tenantId: string): SeoStrategyRecord {
  return {
    tenantId,
    revision: 1,
    ...seoStrategyPayloadSchema.parse({}),
  };
}

export async function handleSeoStrategyGet(tenantId: string, deps: SeoStrategyDeps) {
  const strategy = (await deps.getStrategy(tenantId)) ?? emptySeoStrategy(tenantId);
  return NextResponse.json({ seoStrategy: strategy });
}

export async function handleSeoStrategyPatch(
  tenantId: string,
  body: unknown,
  deps: SeoStrategyDeps,
) {
  const parsed = seoStrategyPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const strategy = await deps.upsertStrategy(tenantId, parsed.data);
  return NextResponse.json({ seoStrategy: strategy });
}
