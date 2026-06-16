/**
 * GET   /api/settings/forum-config   — returns the tenant's current forumConfig
 * PATCH /api/settings/forum-config   — partial update (any subset of the four authoring slices)
 *
 * CON-191 (Epic — Dashboard authoring UI for forumConfig).
 *
 * Authoring scope (V1): `ai_persona`, `qualifying_questions`, `allowed_topics`, `follow_up`.
 * Other slices on the root forumConfig (`cta_rules`, `lead_capture`, `seo_defaults`,
 * `connectors`, `limits`, `schema_version`, `exclusion_list`) are NOT writable
 * through this endpoint — they're preserved untouched by deep-merge.
 *
 * Tenant scoping: B5 helpers from CON-164 — auth() session resolves to a user,
 * `getActiveTenantIdForUser` resolves to the active tenant via cookie/membership.
 * Cross-tenant writes are impossible because all writes are gated on the
 * server-resolved tenantId.
 *
 * Validation: each provided slice is parsed against its Zod schema. The whole
 * request fails (400) if any slice is invalid — partial saves of a partial
 * shape are deliberately not supported, to keep the persisted forumConfig
 * always schema-valid.
 *
 * Deep merge: top-level merge per slice. Inside a slice the new value REPLACES
 * the old (a slice is the atomic write unit). This matches the authoring
 * surface — a panel saves a whole slice or doesn't save it.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getActiveTenantIdForUser } from "@/lib/auth-context";
import {
  handleForumConfigGet,
  handleForumConfigPatch,
  type ForumConfigDeps,
} from "./handler";

function buildDeps(): ForumConfigDeps {
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
  return handleForumConfigGet(tenantId, buildDeps());
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
  return handleForumConfigPatch(tenantId, body, buildDeps());
}
