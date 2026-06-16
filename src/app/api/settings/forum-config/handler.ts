/**
 * Pure (dependency-injected) handlers for /api/settings/forum-config.
 *
 * Separated from `route.ts` so unit tests can drive the same code path
 * with in-memory fakes for `getTenantSettings` / `saveTenantSettings`
 * (no DB, no Next runtime).
 *
 * CON-191.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  aiPersonaSchema,
  qualifyingQuestionsSchema,
  allowedTopicsSchema,
  followUpSchema,
  forumConfigSchema,
} from "@/lib/forum-config/schema";

export type ForumConfigDeps = {
  getTenantSettings: (tenantId: string) => Promise<Record<string, unknown> | null>;
  saveTenantSettings: (
    tenantId: string,
    settings: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
};

/** Authoring slices exposed by the dashboard UI. */
export const AUTHORING_SLICES = [
  "ai_persona",
  "qualifying_questions",
  "allowed_topics",
  "follow_up",
] as const;

export type AuthoringSlice = (typeof AUTHORING_SLICES)[number];

/**
 * Per-slice Zod schemas used for incoming PATCH validation.
 *
 * The root forumConfigSchema is used for the GET response so any tenant
 * with a sparse or absent forumConfig still gets a schema-default object
 * (mirrors the read-only follow-up tab's "parse for defaults" pattern).
 */
const SLICE_SCHEMAS: Record<AuthoringSlice, z.ZodTypeAny> = {
  ai_persona: aiPersonaSchema,
  qualifying_questions: qualifyingQuestionsSchema,
  allowed_topics: allowedTopicsSchema,
  follow_up: followUpSchema,
};

type SliceErrors = Partial<Record<AuthoringSlice, z.core.$ZodIssue[]>>;

/**
 * GET — returns the current full forumConfig (defaults populated) for the
 * tenant, plus the raw stored object (for debug / round-trip).
 */
export async function handleForumConfigGet(
  tenantId: string,
  deps: ForumConfigDeps,
) {
  const settings = await deps.getTenantSettings(tenantId);
  if (settings === null) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }
  const raw = (settings.forumConfig ?? {}) as Record<string, unknown>;
  // Best-effort parse for the response so the UI gets schema defaults.
  // If the existing stored config is malformed we still return the raw
  // object so the operator can see and repair it.
  const parsed = forumConfigSchema.safeParse(raw);
  return NextResponse.json({
    forumConfig: parsed.success ? parsed.data : raw,
    forumConfigRaw: raw,
    parseOk: parsed.success,
  });
}

/**
 * PATCH — validates and applies a partial forumConfig update.
 *
 * Rules:
 * - Body must be an object.
 * - Only known authoring slices are accepted; unknown keys are ignored
 *   (forwards-compat). At least one known slice must be present.
 * - Each provided slice is parsed against its Zod schema. If ANY slice
 *   fails, the whole request is rejected 400 with per-slice issues.
 * - Successful slices REPLACE the slice in `settings.forumConfig`; other
 *   slices (`cta_rules`, `lead_capture`, etc.) are preserved verbatim.
 * - Other top-level `settings` keys (`widget`, `cms`, ...) are preserved.
 */
export async function handleForumConfigPatch(
  tenantId: string,
  body: unknown,
  deps: ForumConfigDeps,
) {
  if (!isPlainObject(body)) {
    return NextResponse.json(
      { error: "Request body must be a JSON object" },
      { status: 400 },
    );
  }

  const providedSlices: Partial<Record<AuthoringSlice, unknown>> = {};
  for (const slice of AUTHORING_SLICES) {
    if (Object.prototype.hasOwnProperty.call(body, slice)) {
      providedSlices[slice] = (body as Record<string, unknown>)[slice];
    }
  }

  if (Object.keys(providedSlices).length === 0) {
    return NextResponse.json(
      {
        error: "No authoring slices provided",
        allowed: AUTHORING_SLICES,
      },
      { status: 400 },
    );
  }

  const validated: Partial<Record<AuthoringSlice, unknown>> = {};
  const errors: SliceErrors = {};
  for (const [slice, value] of Object.entries(providedSlices) as [
    AuthoringSlice,
    unknown,
  ][]) {
    const result = SLICE_SCHEMAS[slice].safeParse(value);
    if (result.success) {
      validated[slice] = result.data;
    } else {
      errors[slice] = result.error.issues;
    }
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: errors,
      },
      { status: 400 },
    );
  }

  const settings = await deps.getTenantSettings(tenantId);
  if (settings === null) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const currentForumConfig = isPlainObject(settings.forumConfig)
    ? (settings.forumConfig as Record<string, unknown>)
    : {};

  const nextForumConfig: Record<string, unknown> = {
    ...currentForumConfig,
    ...validated,
  };

  const nextSettings: Record<string, unknown> = {
    ...settings,
    forumConfig: nextForumConfig,
  };

  const saved = await deps.saveTenantSettings(tenantId, nextSettings);
  const savedForumConfig = isPlainObject(saved.forumConfig)
    ? (saved.forumConfig as Record<string, unknown>)
    : {};

  // Re-parse for the response so the UI receives schema-defaulted values.
  const parsed = forumConfigSchema.safeParse(savedForumConfig);

  return NextResponse.json({
    forumConfig: parsed.success ? parsed.data : savedForumConfig,
    forumConfigRaw: savedForumConfig,
    parseOk: parsed.success,
    appliedSlices: Object.keys(validated),
  });
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
