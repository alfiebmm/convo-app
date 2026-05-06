/**
 * PATCH /api/conversations/[id]
 *
 * Updates human-triage flags on a conversation.
 * Body: { needsFollowup?: boolean, resolved?: boolean }
 *
 * - `resolved: true`  → clears `needsFollowup`, sets `resolvedAt` + `resolvedBy`.
 * - `resolved: false` → clears `resolvedAt` + `resolvedBy` (re-opens).
 * - `needsFollowup: true`  → sets the flag, clears any prior resolution.
 * - `needsFollowup: false` → clears the flag without changing resolution.
 *
 * Auth: requires session + active tenant membership owning the conversation.
 * Viewers are read-only and rejected here.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conversations, tenantMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: { needsFollowup?: boolean; resolved?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { needsFollowup, resolved } = body;
  if (needsFollowup === undefined && resolved === undefined) {
    return NextResponse.json(
      { error: "no_fields", message: "Pass needsFollowup and/or resolved." },
      { status: 400 }
    );
  }

  // Load conversation + verify caller has write access to its tenant.
  const [convo] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id))
    .limit(1);

  if (!convo) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const [membership] = await db
    .select()
    .from(tenantMembers)
    .where(
      and(
        eq(tenantMembers.tenantId, convo.tenantId),
        eq(tenantMembers.userId, session.user.id)
      )
    )
    .limit(1);

  if (!membership || membership.role === "viewer") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const update: Partial<typeof conversations.$inferInsert> = {};

  if (resolved === true) {
    update.needsFollowup = false;
    update.resolvedAt = new Date();
    update.resolvedBy = session.user.id;
  } else if (resolved === false) {
    update.resolvedAt = null;
    update.resolvedBy = null;
  }

  if (needsFollowup === true) {
    update.needsFollowup = true;
    // Re-flagging a previously resolved chat clears the resolution stamp.
    update.resolvedAt = null;
    update.resolvedBy = null;
  } else if (needsFollowup === false && resolved !== true) {
    update.needsFollowup = false;
  }

  const [updated] = await db
    .update(conversations)
    .set(update)
    .where(eq(conversations.id, id))
    .returning();

  return NextResponse.json({
    conversation: {
      id: updated.id,
      needsFollowup: updated.needsFollowup,
      resolvedAt: updated.resolvedAt,
      resolvedBy: updated.resolvedBy,
    },
  });
}
