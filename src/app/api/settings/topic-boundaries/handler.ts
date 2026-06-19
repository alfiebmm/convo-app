import { NextResponse } from "next/server";
import { z } from "zod";

export type TopicBoundariesDeps = {
  getTenantSettings: (tenantId: string) => Promise<Record<string, unknown> | null>;
  saveTenantSettings: (
    tenantId: string,
    settings: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
};

export const topicBoundariesSchema = z.object({
  deflect: z.array(
    z.object({
      topic: z.string(),
      response: z.string(),
    }),
  ),
  hardBlock: z.array(z.string()),
});

const DEFAULT_BOUNDARIES = {
  deflect: [] as { topic: string; response: string }[],
  hardBlock: [] as string[],
};

export async function handleTopicBoundariesGet(
  tenantId: string,
  deps: TopicBoundariesDeps,
) {
  const settings = await deps.getTenantSettings(tenantId);
  if (settings === null) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  return NextResponse.json({
    topicBoundaries: readTopicBoundaries(settings),
  });
}

export async function handleTopicBoundariesPatch(
  tenantId: string,
  body: unknown,
  deps: TopicBoundariesDeps,
) {
  const parsed = topicBoundariesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const settings = await deps.getTenantSettings(tenantId);
  if (settings === null) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const guardrails = isPlainObject(settings.guardrails)
    ? (settings.guardrails as Record<string, unknown>)
    : {};
  const currentTopicBoundaries = isPlainObject(guardrails.topicBoundaries)
    ? (guardrails.topicBoundaries as Record<string, unknown>)
    : {};

  const nextSettings: Record<string, unknown> = {
    ...settings,
    guardrails: {
      ...guardrails,
      topicBoundaries: {
        ...currentTopicBoundaries,
        deflect: parsed.data.deflect,
        hardBlock: parsed.data.hardBlock,
      },
    },
  };

  const saved = await deps.saveTenantSettings(tenantId, nextSettings);
  return NextResponse.json({
    topicBoundaries: readTopicBoundaries(saved),
  });
}

function readTopicBoundaries(settings: Record<string, unknown>) {
  const guardrails = isPlainObject(settings.guardrails)
    ? (settings.guardrails as Record<string, unknown>)
    : {};
  const raw = isPlainObject(guardrails.topicBoundaries)
    ? guardrails.topicBoundaries
    : {};
  const parsed = topicBoundariesSchema.partial().safeParse(raw);
  return {
    ...DEFAULT_BOUNDARIES,
    ...(parsed.success ? parsed.data : {}),
  };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
