/**
 * POST /api/pipeline/trigger
 *
 * Called by the widget when the chat window is closed.
 * Marks conversation as completed and processes it through the content pipeline.
 *
 * Accepts: { conversationId, tenantId, visitorId }
 */
import { NextRequest, NextResponse } from "next/server";
import { processConversation } from "@/lib/pipeline";
import { getConversationForVisitor } from "@/lib/conversations";

type TriggerConversation = {
  id: string;
  status: string;
};

export type PipelineTriggerDeps = {
  getConversationForVisitor: (
    conversationId: string,
    tenantId: string,
    visitorId: string
  ) => Promise<TriggerConversation | null>;
  processConversation: (conversationId: string) => Promise<unknown>;
};

const defaultDeps: PipelineTriggerDeps = {
  getConversationForVisitor,
  processConversation,
};

export async function handlePipelineTrigger(
  req: { json: () => Promise<unknown> },
  deps: PipelineTriggerDeps = defaultDeps
) {
  try {
    const body = await req.json();
    const { conversationId, tenantId, visitorId } = body as {
      conversationId?: string;
      tenantId?: string;
      visitorId?: string;
    };

    if (!conversationId || !tenantId || !visitorId) {
      return NextResponse.json(
        { error: "conversationId, tenantId, and visitorId are required" },
        { status: 400 }
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
        { status: 404 }
      );
    }

    if (convo.status === "completed") {
      return NextResponse.json({
        message: "Conversation already processed",
        conversationId,
      });
    }

    const result = await deps.processConversation(conversationId);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  return handlePipelineTrigger(req);
}

/** Handle CORS preflight for widget cross-origin requests */
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
