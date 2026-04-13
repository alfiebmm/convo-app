import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/chat
 * Widget sends messages here. This is the conversation engine endpoint.
 * Phase 2 will wire this to OpenAI + RAG + conversation persistence.
 * For now: echo back to confirm the pipeline works.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenantId, conversationId, message } = body;

    if (!tenantId || !message) {
      return NextResponse.json(
        { error: "tenantId and message are required" },
        { status: 400 }
      );
    }

    // TODO Phase 2: resolve tenant, load persona, call LLM, persist messages
    return NextResponse.json({
      conversationId: conversationId ?? "demo-conversation-id",
      reply: `[Convo Echo] You said: "${message}". The conversation engine will be wired in Phase 2.`,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
