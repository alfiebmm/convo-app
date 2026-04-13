/**
 * GET /api/content?tenantId=...&status=...&type=...
 *
 * List content for a tenant, filterable by status and type.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { content } from "@/lib/db/schema";
import { eq, and, desc, type SQL } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  const status = searchParams.get("status");
  const type = searchParams.get("type");

  if (!tenantId) {
    return NextResponse.json(
      { error: "tenantId is required" },
      { status: 400 }
    );
  }

  const conditions: SQL[] = [eq(content.tenantId, tenantId)];

  if (status) {
    conditions.push(
      eq(
        content.status,
        status as
          | "pending"
          | "generating"
          | "review"
          | "approved"
          | "published"
          | "rejected"
          | "archived"
      )
    );
  }
  if (type) {
    conditions.push(eq(content.type, type));
  }

  const items = await db
    .select()
    .from(content)
    .where(and(...conditions))
    .orderBy(desc(content.createdAt))
    .limit(100);

  return NextResponse.json({ content: items });
}
