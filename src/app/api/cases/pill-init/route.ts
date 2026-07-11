/**
 * POST /api/cases/pill-init (CON-255)
 *
 * Visitor-facing endpoint used by starter-pill lead capture actions. The
 * normal capture route requires a pre-existing case row; this endpoint mints
 * that case after verifying tenant + visitor + conversation scope.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { withApiErrorLogging } from "@/lib/errors/wrap";

import { createCase, getCaseByConversation, type CaseRow } from "@/lib/cases";
import { setCaseAttribute } from "@/lib/cases/attributes";
import { getConversationForVisitor } from "@/lib/conversations";
import { DEFAULT_STARTER_PROMPTS } from "@/lib/forum-config/defaults";
import {
  capturePolicySpecSchema,
  starterPromptsSchema,
  type CapturePolicy,
  type StarterPrompt,
} from "@/lib/forum-config/schema";
import { getTenantById } from "@/lib/tenant";

type TenantLookupRow = { id: string; settings?: unknown } | null;
type ConversationLookupRow = { id: string; tenantId: string } | null;

export type PillInitDeps = {
  getTenantById: (id: string) => Promise<TenantLookupRow>;
  getConversationForVisitor: (
    conversationId: string,
    tenantId: string,
    visitorId: string,
  ) => Promise<ConversationLookupRow>;
  getCaseByConversation: (
    tenantId: string,
    conversationId: string,
  ) => Promise<CaseRow | null>;
  createCase: typeof createCase;
  setCaseAttribute: typeof setCaseAttribute;
};

const defaultDeps: PillInitDeps = {
  getTenantById,
  getConversationForVisitor,
  getCaseByConversation,
  createCase,
  setCaseAttribute,
};

const requestBodySchema = z.object({
  tenantId: z.string().uuid(),
  visitorId: z.string().min(1),
  conversationId: z.string().uuid(),
  capture_policy_id: z.string().min(1),
});

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function badRequest(message: string): Response {
  return jsonResponse({ error: message }, 400);
}

function notFound(): Response {
  return jsonResponse({ error: "Not found" }, 404);
}

function settingsStarterPrompts(settings: unknown): StarterPrompt[] {
  const forumConfig =
    settings && typeof settings === "object"
      ? (settings as Record<string, unknown>).forumConfig
      : undefined;
  const rawPrompts =
    forumConfig && typeof forumConfig === "object"
      ? (forumConfig as Record<string, unknown>).starter_prompts
      : undefined;
  const parsed = starterPromptsSchema.safeParse(rawPrompts);
  return parsed.success && parsed.data.length > 0
    ? parsed.data
    : DEFAULT_STARTER_PROMPTS;
}

function resolvePillCapturePolicy(
  prompts: StarterPrompt[],
  capturePolicyId: string,
): CapturePolicy | null {
  for (const prompt of prompts) {
    const action = prompt.action;
    if (
      action?.type === "lead_capture" &&
      action.capture_policy.id === capturePolicyId
    ) {
      return action.capture_policy;
    }
  }
  return null;
}

export async function handlePillInit(
  req: { json: () => Promise<unknown> },
  deps: PillInitDeps = defaultDeps,
): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const parsed = requestBodySchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const fieldPath = issue?.path?.join(".") ?? "body";
    return badRequest(`Invalid request: ${fieldPath}`);
  }

  const body = parsed.data;

  const tenant = await deps.getTenantById(body.tenantId);
  if (!tenant) return notFound();

  const conversation = await deps.getConversationForVisitor(
    body.conversationId,
    body.tenantId,
    body.visitorId,
  );
  if (!conversation) return notFound();

  const capturePolicy = resolvePillCapturePolicy(
    settingsStarterPrompts(tenant.settings),
    body.capture_policy_id,
  );
  if (!capturePolicy) return badRequest("Unknown capture_policy_id");

  const validatedPolicy = capturePolicySpecSchema.parse(capturePolicy);
  const existing = await deps.getCaseByConversation(
    body.tenantId,
    body.conversationId,
  );
  const kase =
    existing ??
    (await deps.createCase(body.tenantId, {
      conversationId: body.conversationId,
      caseType: validatedPolicy.case_type,
      source: "starter_pill",
      reason: "capture_details_then_flag",
    }));

  await deps.setCaseAttribute(body.tenantId, {
    caseId: kase.id,
    key: "origin",
    value: "pill_lead_capture",
    source: "starter_pill",
    confidence: 1,
  });

  return jsonResponse(
    {
      case_id: kase.id,
      capture_policy: validatedPolicy,
    },
    200,
  );
}

async function postImpl(req: NextRequest): Promise<Response> {
  return handlePillInit(req);
}

export const POST = withApiErrorLogging(postImpl, {
  route: "/api/cases/pill-init",
});

export function OPTIONS(): Response {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}
