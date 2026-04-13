/**
 * GET  /api/content/[id] — get single content item
 * PATCH /api/content/[id] — update status, title, body, meta
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { content } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [item] = await db
    .select()
    .from(content)
    .where(eq(content.id, id))
    .limit(1);

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(item);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const body = await req.json();
  const allowedFields: Record<string, unknown> = {};

  // Only allow updating specific fields
  if (body.status !== undefined) allowedFields.status = body.status;
  if (body.title !== undefined) allowedFields.title = body.title;
  if (body.body !== undefined) allowedFields.body = body.body;
  if (body.metaDescription !== undefined)
    allowedFields.metaDescription = body.metaDescription;
  if (body.slug !== undefined) allowedFields.slug = body.slug;

  if (Object.keys(allowedFields).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  // Add updatedAt
  const updateData = {
    ...allowedFields,
    updatedAt: new Date(),
  } as Record<string, unknown>;

  // If approving/rejecting, add review timestamp
  if (body.status === "approved" || body.status === "rejected") {
    updateData.reviewedAt = new Date();
  }

  const [updated] = await db
    .update(content)
    .set(updateData)
    .where(eq(content.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
