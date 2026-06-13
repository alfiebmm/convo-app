/**
 * GET /api/conversations/qualifying/state?conversation=<id>  (CON-94 / C-05)
 *
 * Returns the qualifying state for an existing conversation so the widget
 * can rehydrate (post-refresh, post-session-restore) without re-asking
 * questions a visitor already answered.
 *
 * Public — same trust posture as `/api/widget/config`. A visitor with a
 * conversation ID owns that conversation; we expose only their own state.
 * No tenant fan-out: conversation IDs are random UUIDs.
 */

import { NextRequest, NextResponse } from "next/server";
import { getConversationForVisitor } from "@/lib/conversations";
import { readQualifying } from "@/lib/qualifying/types";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

type QualifyingStateConversation = {
  id: string;
  tenantId: string;
  visitorId: string | null;
  metadata: unknown;
} | null;

type QualifyingStateDeps = {
  getConversationForVisitor: (
    conversationId: string,
    tenantId: string,
    visitorId: string
  ) => Promise<QualifyingStateConversation>;
};

const defaultDeps: QualifyingStateDeps = {
  getConversationForVisitor,
};

export async function handleQualifyingState(
  url: URL,
  deps: QualifyingStateDeps = defaultDeps
) {
  const conversationId = url.searchParams.get("conversation");
  const tenantId = url.searchParams.get("tenant");
  const visitorId = url.searchParams.get("visitor");
  if (!conversationId || !tenantId || !visitorId) {
    return NextResponse.json(
      { error: "conversation, tenant, and visitor query params required" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const convo = await deps.getConversationForVisitor(
    conversationId,
    tenantId,
    visitorId
  );
  if (!convo) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404, headers: CORS_HEADERS }
    );
  }

  const state = readQualifying(
    convo.metadata as Record<string, unknown> | null
  );

  return NextResponse.json(
    {
      conversationId,
      persona: state?.persona ?? {},
      answeredFields: (state?.answers ?? []).map((a) => a.field),
      completedAt: state?.completedAt ?? null,
      skipped: state?.skipped ?? false,
    },
    { headers: CORS_HEADERS }
  );
}

export async function GET(req: NextRequest) {
  return handleQualifyingState(req.nextUrl);
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
