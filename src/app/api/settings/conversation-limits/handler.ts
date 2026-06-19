import { NextResponse } from "next/server";
import { z } from "zod";

export type ConversationLimitsDeps = {
  getTenantSettings: (tenantId: string) => Promise<Record<string, unknown> | null>;
  saveTenantSettings: (
    tenantId: string,
    settings: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
};

export const conversationLimitsSchema = z.object({
  maxTurnsBeforeCTA: z.number().int().min(1).max(50),
  idleTimeoutMinutes: z.number().int().min(1).max(120),
});

const DEFAULT_LIMITS = {
  maxTurnsBeforeCTA: 5,
  idleTimeoutMinutes: 10,
};

export async function handleConversationLimitsGet(
  tenantId: string,
  deps: ConversationLimitsDeps,
) {
  const settings = await deps.getTenantSettings(tenantId);
  if (settings === null) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  return NextResponse.json({
    conversationLimits: readConversationLimits(settings),
  });
}

export async function handleConversationLimitsPatch(
  tenantId: string,
  body: unknown,
  deps: ConversationLimitsDeps,
) {
  const parsed = conversationLimitsSchema.safeParse(body);
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

  const nextSettings: Record<string, unknown> = {
    ...settings,
    guardrails: {
      ...guardrails,
      conversationLimits: {
        ...readConversationLimits(settings),
        ...parsed.data,
      },
    },
  };

  const saved = await deps.saveTenantSettings(tenantId, nextSettings);
  return NextResponse.json({
    conversationLimits: readConversationLimits(saved),
  });
}

function readConversationLimits(settings: Record<string, unknown>) {
  const guardrails = isPlainObject(settings.guardrails)
    ? (settings.guardrails as Record<string, unknown>)
    : {};
  const raw = isPlainObject(guardrails.conversationLimits)
    ? guardrails.conversationLimits
    : {};
  const parsed = conversationLimitsSchema.partial().safeParse(raw);
  return {
    ...DEFAULT_LIMITS,
    ...(parsed.success ? parsed.data : {}),
  };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
