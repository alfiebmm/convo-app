/**
 * POST /api/conversations/qualifying  (CON-94 / C-05)
 *
 * Accepts a single qualifying-question answer and returns the next question
 * (or `null` if the flow is complete). Creates the conversation lazily on
 * the FIRST answer so we don't spawn empty conversations for visitors who
 * never engage.
 *
 * Request:
 *   {
 *     tenantId: string,
 *     conversationId?: string,      // omit on first answer
 *     visitorId: string,
 *     field: string,                // persona_field from forum.config
 *     value: string,                // option.value from forum.config
 *     question: string,             // question text snapshot (for audit)
 *     metadata?: { pageUrl?, referrer? }
 *   }
 *
 * Response:
 *   {
 *     conversationId: string,
 *     persona: Record<string, string>,
 *     next: QualifyingPrompt | null,
 *     completedAt: string | null,
 *   }
 *
 * The widget renders `next` as a quick-reply card, or unlocks free-text
 * input when `next === null`.
 *
 * Trust model: the request says which `field`/`value` was picked, but
 * the server checks both against the tenant's configured questions to
 * reject any client-side tampering (visitors can't invent persona fields).
 */

import { NextRequest, NextResponse } from "next/server";
import { getTenantById } from "@/lib/tenant";
import {
  createConversation,
  appendQualifyingAnswer,
  getConversationForVisitor,
  setQualifyingState,
} from "@/lib/conversations";
import {
  getConfiguredQuestions,
  getNextQuestion,
} from "@/lib/qualifying/resolve";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function badRequest(message: string) {
  return NextResponse.json(
    { error: message },
    { status: 400, headers: CORS_HEADERS }
  );
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("invalid JSON body");
  }

  const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
  const visitorId = typeof body.visitorId === "string" ? body.visitorId : "";
  const field = typeof body.field === "string" ? body.field : "";
  const value = typeof body.value === "string" ? body.value : "";
  const questionText =
    typeof body.question === "string" ? body.question : "";
  const conversationId =
    typeof body.conversationId === "string" ? body.conversationId : undefined;
  const skip = body.skip === true;
  const metadata =
    typeof body.metadata === "object" && body.metadata !== null
      ? (body.metadata as Record<string, unknown>)
      : undefined;

  if (!tenantId || !visitorId) {
    return badRequest("tenantId and visitorId are required");
  }
  if (!skip && (!field || !value || !questionText)) {
    return badRequest("field, value, and question are required");
  }

  const tenant = await getTenantById(tenantId);
  if (!tenant) {
    return NextResponse.json(
      { error: "Tenant not found" },
      { status: 404, headers: CORS_HEADERS }
    );
  }

  const configured = getConfiguredQuestions(
    tenant.settings as Record<string, unknown> | null
  );

  // Server-side validation: reject answers that don't match a configured
  // question. Same defence as CON-93's URL allowlist — the model and the
  // widget can only operate inside the config-declared space.
  if (!skip) {
    const matchingQuestion = configured.find((q) => q.field === field);
    if (!matchingQuestion) {
      return badRequest(`unknown persona field: ${field}`);
    }
    const matchingOption = matchingQuestion.options.find(
      (o) => o.value === value
    );
    if (!matchingOption) {
      return badRequest(`unknown option value for ${field}: ${value}`);
    }
  }

  // Lazily create the conversation on the first answer (or skip).
  let convoId = conversationId;
  if (!convoId) {
    const convo = await createConversation(tenantId, visitorId, metadata);
    convoId = convo.id;
  } else {
    const existingConversation = await getConversationForVisitor(
      convoId,
      tenantId,
      visitorId
    );
    if (!existingConversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404, headers: CORS_HEADERS }
      );
    }
  }

  if (skip) {
    const state = await setQualifyingState(convoId, {
      skipped: true,
      completedAt: new Date().toISOString(),
    });
    return NextResponse.json(
      {
        conversationId: convoId,
        persona: state?.persona ?? {},
        next: null,
        completedAt: state?.completedAt ?? null,
      },
      { headers: CORS_HEADERS }
    );
  }

  const updated = await appendQualifyingAnswer(convoId, {
    field,
    value,
    question: questionText,
  });

  const next = getNextQuestion(configured, updated);

  // If no more questions, stamp completedAt so the widget knows to unlock.
  let completedAt = updated.completedAt ?? null;
  if (next === null && !completedAt) {
    const finalised = await setQualifyingState(convoId, {
      completedAt: new Date().toISOString(),
    });
    completedAt = finalised?.completedAt ?? null;
  }

  return NextResponse.json(
    {
      conversationId: convoId,
      persona: updated.persona,
      next,
      completedAt,
    },
    { headers: CORS_HEADERS }
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
