import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { getActiveTenantIdForUser } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { tenantSeoStrategy } from "@/lib/db/schema";
import { withApiErrorLogging } from "@/lib/errors/wrap";

import {
  handleSeoStrategyGet,
  handleSeoStrategyPatch,
  type SeoStrategyDeps,
  type SeoStrategyRecord,
} from "./handler";

function mapRow(row: typeof tenantSeoStrategy.$inferSelect): SeoStrategyRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    targetKeywords: row.targetKeywords,
    priorityServices: row.priorityServices,
    priorityLocations: row.priorityLocations,
    targetAudiences: row.targetAudiences,
    approvedInternalUrls: row.approvedInternalUrls,
    preferredCtas: row.preferredCtas,
    avoidTopics: row.avoidTopics,
    avoidClaims: row.avoidClaims,
    avoidKeywords: row.avoidKeywords,
    revision: row.revision,
  };
}

function buildDeps(): SeoStrategyDeps {
  return {
    async getStrategy(tenantId) {
      const [row] = await db
        .select()
        .from(tenantSeoStrategy)
        .where(eq(tenantSeoStrategy.tenantId, tenantId))
        .limit(1);
      return row ? mapRow(row) : null;
    },
    async upsertStrategy(tenantId, payload) {
      const [row] = await db
        .insert(tenantSeoStrategy)
        .values({ tenantId, ...payload })
        .onConflictDoUpdate({
          target: tenantSeoStrategy.tenantId,
          set: {
            ...payload,
            updatedAt: new Date(),
          },
        })
        .returning();
      return mapRow(row);
    },
  };
}

async function tenantIdFromSession() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return getActiveTenantIdForUser(session.user.id);
}

async function getImpl() {
  const tenantId = await tenantIdFromSession();
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return handleSeoStrategyGet(tenantId, buildDeps());
}

async function patchImpl(req: NextRequest) {
  const tenantId = await tenantIdFromSession();
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  return handleSeoStrategyPatch(tenantId, body, buildDeps());
}

export const GET = withApiErrorLogging(getImpl, {
  route: "/api/settings/seo-strategy",
});
export const PATCH = withApiErrorLogging(patchImpl, {
  route: "/api/settings/seo-strategy",
});
