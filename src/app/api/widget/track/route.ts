import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { widgetSessions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * POST /api/widget/track
 *
 * Lightweight endpoint for widget session tracking.
 * Called on widget load and when a conversation starts.
 *
 * Body: { tenantId, visitorId, pageUrl, engaged?, conversationId? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenantId, visitorId, pageUrl, engaged, conversationId } = body;

    if (!tenantId || !visitorId) {
      return NextResponse.json(
        { error: "tenantId and visitorId are required" },
        { status: 400 }
      );
    }

    if (engaged && conversationId) {
      // Update existing session to mark engagement
      await db
        .update(widgetSessions)
        .set({ engaged: true, conversationId })
        .where(
          and(
            eq(widgetSessions.tenantId, tenantId),
            eq(widgetSessions.visitorId, visitorId)
          )
        );

      return NextResponse.json({ ok: true });
    }

    // Create new session record
    await db.insert(widgetSessions).values({
      tenantId,
      visitorId,
      pageUrl: pageUrl ?? null,
      engaged: false,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
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
