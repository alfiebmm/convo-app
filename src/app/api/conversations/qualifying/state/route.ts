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
import { getConversation } from "@/lib/conversations";
import { readQualifying } from "@/lib/qualifying/types";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

export async function GET(req: NextRequest) {
  const conversationId = req.nextUrl.searchParams.get("conversation");
  if (!conversationId) {
    return NextResponse.json(
      { error: "conversation query param required" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const convo = await getConversation(conversationId);
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

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
