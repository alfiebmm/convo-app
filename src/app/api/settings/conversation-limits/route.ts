import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getActiveTenantIdForUser } from "@/lib/auth-context";
import {
  handleConversationLimitsGet,
  handleConversationLimitsPatch,
  type ConversationLimitsDeps,
} from "./handler";

function buildDeps(): ConversationLimitsDeps {
  return {
    getTenantSettings: async (tenantId: string) => {
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);
      if (!tenant) return null;
      return (tenant.settings ?? {}) as Record<string, unknown>;
    },
    saveTenantSettings: async (tenantId: string, settings) => {
      const [updated] = await db
        .update(tenants)
        .set({ settings, updatedAt: new Date() })
        .where(eq(tenants.id, tenantId))
        .returning();
      return (updated.settings ?? {}) as Record<string, unknown>;
    },
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tenantId = await getActiveTenantIdForUser(session.user.id);
  if (!tenantId) {
    return NextResponse.json({ error: "No tenant" }, { status: 404 });
  }
  return handleConversationLimitsGet(tenantId, buildDeps());
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tenantId = await getActiveTenantIdForUser(session.user.id);
  if (!tenantId) {
    return NextResponse.json({ error: "No tenant" }, { status: 404 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  return handleConversationLimitsPatch(tenantId, body, buildDeps());
}
