import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { widgetSessions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getConversationForVisitor } from "@/lib/conversations";

type VisitorConversationLookup = {
  id: string;
  tenantId: string;
  visitorId: string | null;
} | null;

export type WidgetTrackDeps = {
  getConversationForVisitor: (
    conversationId: string,
    tenantId: string,
    visitorId: string
  ) => Promise<VisitorConversationLookup>;
  markEngaged: (
    tenantId: string,
    visitorId: string,
    conversationId: string
  ) => Promise<void>;
  createSession: (
    tenantId: string,
    visitorId: string,
    pageUrl: string | null
  ) => Promise<void>;
};

const defaultDeps: WidgetTrackDeps = {
  getConversationForVisitor,
  markEngaged: async (tenantId, visitorId, conversationId) => {
    await db
      .update(widgetSessions)
      .set({ engaged: true, conversationId })
      .where(
        and(
          eq(widgetSessions.tenantId, tenantId),
          eq(widgetSessions.visitorId, visitorId)
        )
      );
  },
  createSession: async (tenantId, visitorId, pageUrl) => {
    await db.insert(widgetSessions).values({
      tenantId,
      visitorId,
      pageUrl,
      engaged: false,
    });
  },
};

/**
 * POST /api/widget/track
 *
 * Lightweight endpoint for widget session tracking.
 * Called on widget load and when a conversation starts.
 *
 * Body: { tenantId, visitorId, pageUrl, engaged?, conversationId? }
 */
export async function handleWidgetTrack(
  req: { json: () => Promise<unknown> },
  deps: WidgetTrackDeps = defaultDeps
) {
  try {
    const body = (await req.json()) as {
      tenantId?: string;
      visitorId?: string;
      pageUrl?: string | null;
      engaged?: boolean;
      conversationId?: string;
    };
    const { tenantId, visitorId, pageUrl, engaged, conversationId } = body;

    if (!tenantId || !visitorId) {
      return NextResponse.json(
        { error: "tenantId and visitorId are required" },
        { status: 400 }
      );
    }

    if (engaged && conversationId) {
      const conversation = await deps.getConversationForVisitor(
        conversationId,
        tenantId,
        visitorId
      );
      if (!conversation) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 }
        );
      }

      // Update existing session to mark engagement
      await deps.markEngaged(tenantId, visitorId, conversationId);

      return NextResponse.json({ ok: true });
    }

    await deps.createSession(tenantId, visitorId, pageUrl ?? null);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  return handleWidgetTrack(req);
}

/** CORS preflight */
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
