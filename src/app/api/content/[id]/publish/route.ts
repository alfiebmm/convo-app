/**
 * POST /api/content/[id]/publish?draft=true
 *
 * Triggers publishing for a specific content item.
 * Content must be in 'approved' status.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { content } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { publishContent } from "@/lib/publishing";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const draft = searchParams.get("draft") === "true";

  // Validate content exists and is approved
  const [item] = await db
    .select()
    .from(content)
    .where(eq(content.id, id))
    .limit(1);

  if (!item) {
    return NextResponse.json({ error: "Content not found" }, { status: 404 });
  }

  if (item.status !== "approved") {
    return NextResponse.json(
      {
        error: `Content must be in 'approved' status to publish. Current status: ${item.status}`,
      },
      { status: 400 }
    );
  }

  const result = await publishContent(id, draft);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error, success: false },
      { status: 500 }
    );
  }

  return NextResponse.json(result);
}
