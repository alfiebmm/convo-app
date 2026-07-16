import { after, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getTenantMembership } from "@/lib/auth-context";
import { canMutateCases } from "@/lib/auth/permissions";
import { requestBlogPipeline } from "@/lib/blog/trigger";
import { getConversation } from "@/lib/conversations";
import { withApiErrorLogging } from "@/lib/errors/wrap";

export const runtime = "nodejs";

async function postImpl(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const conversation = await getConversation(id);
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const membership = await getTenantMembership(
    session.user.id,
    conversation.tenantId
  );
  if (!membership || !canMutateCases(membership)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await requestBlogPipeline(id, {
    source: "manual",
    tenantId: conversation.tenantId,
    schedule: (task) => after(task),
  });

  return NextResponse.json(result);
}

export const POST = withApiErrorLogging(postImpl, {
  route: "/api/conversations/[id]/convert-to-blog",
});

