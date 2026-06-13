/**
 * GET /api/content?tenantId=...&status=...&type=...
 *
 * List content for a tenant, filterable by status and type.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { content } from "@/lib/db/schema";
import { eq, and, desc, type SQL } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getActiveTenantIdForUser } from "@/lib/auth-context";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const requestedTenantId = searchParams.get("tenantId");
  const status = searchParams.get("status");
  const type = searchParams.get("type");
  const tenantId = await getActiveTenantIdForUser(session.user.id);

  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant not found" },
      { status: 404 }
    );
  }

  if (requestedTenantId && requestedTenantId !== tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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
