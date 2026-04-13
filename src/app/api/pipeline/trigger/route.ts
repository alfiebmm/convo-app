/**
 * POST /api/pipeline/trigger
 *
 * Called by the widget when the chat window is closed.
 * Marks conversation as completed and processes it through the content pipeline.
 *
 * Accepts: { conversationId }
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conversations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { processConversation } from "@/lib/pipeline";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { conversationId } = body as { conversationId?: string };

    if (!conversationId) {
      return NextResponse.json(
        { error: "conversationId is required" },
        { status: 400 }
      );
    }

    // Check conversation exists and is active
    const [convo] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

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

    // Process through the pipeline (synchronous for v1)
    const result = await processConversation(conversationId);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
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
