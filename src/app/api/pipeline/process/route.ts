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
import { auth } from "@/lib/auth";
import {
  getActiveTenantIdForUser,
  userHasTenantAccess,
} from "@/lib/auth-context";
import { getConversation } from "@/lib/conversations";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
      const conversation = await getConversation(conversationId);
      if (!conversation) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 }
        );
      }

      const hasAccess = await userHasTenantAccess(
        session.user.id,
        conversation.tenantId
      );
      if (!hasAccess) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      const result = await processConversation(conversationId);
      results.push(result);
    } else if (tenantId) {
      const activeTenantId = await getActiveTenantIdForUser(session.user.id);
      if (!activeTenantId || activeTenantId !== tenantId) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

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
