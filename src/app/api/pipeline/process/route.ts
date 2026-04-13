/**
 * POST /api/pipeline/process
 *
 * Manual pipeline trigger.
 * Accepts: { conversationId } or { tenantId } (process all unprocessed active convos)
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conversations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { processConversation, type PipelineResult } from "@/lib/pipeline";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { conversationId, tenantId } = body as {
      conversationId?: string;
      tenantId?: string;
    };

    if (!conversationId && !tenantId) {
      return NextResponse.json(
        { error: "conversationId or tenantId is required" },
        { status: 400 }
      );
    }

    const results: PipelineResult[] = [];

    if (conversationId) {
      const result = await processConversation(conversationId);
      results.push(result);
    } else if (tenantId) {
      // Process all active (unprocessed) conversations for this tenant
      const activeConvos = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.tenantId, tenantId),
            eq(conversations.status, "active")
          )
        );

      for (const convo of activeConvos) {
        const result = await processConversation(convo.id);
        results.push(result);
      }
    }

    const summary = {
      processed: results.length,
      succeeded: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };

    return NextResponse.json(summary);
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
