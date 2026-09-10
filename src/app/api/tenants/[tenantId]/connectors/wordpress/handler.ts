import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { getTenantMembership } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import { verifyCredentials } from "@/lib/blog/connectors/wordpress";
import {
  deleteWordPressConnectorForTenant,
  getWordPressConnectorForTenant,
  requireWordPressConnectorManageAccess,
  requireWordPressConnectorReadAccess,
  saveWordPressConnectorForTenant,
  testWordPressConnectorForTenant,
  type WordPressRouteDeps,
} from "@/lib/blog/connectors/wordpress-settings-actions";

export const WORDPRESS_CONNECTOR_ROUTE =
  "/api/tenants/[tenantId]/connectors/wordpress";
export const WORDPRESS_CONNECTOR_TEST_ROUTE =
  "/api/tenants/[tenantId]/connectors/wordpress/test";

function json(body: unknown, init?: ResponseInit) {
  return Response.json(body, init);
}

export function buildWordPressConnectorDeps(): WordPressRouteDeps {
  return {
    getSessionUserId: async () => {
      const session = await auth();
      return session?.user?.id ?? null;
    },
    getTenantMembership,
    async getTenantSettings(tenantId) {
      const [tenant] = await db
        .select({ settings: tenants.settings })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);
      if (!tenant) return null;
      return (tenant.settings ?? {}) as Record<string, unknown>;
    },
    async saveTenantSettings(tenantId, settings) {
      const [updated] = await db
        .update(tenants)
        .set({ settings, updatedAt: new Date() })
        .where(eq(tenants.id, tenantId))
        .returning({ settings: tenants.settings });
      return (updated?.settings ?? settings) as Record<string, unknown>;
    },
    verifyCredentials,
    now: () => new Date(),
  };
}

export async function handleWordPressConnectorGet(
  tenantId: string,
  deps: WordPressRouteDeps = buildWordPressConnectorDeps(),
) {
  const access = await requireWordPressConnectorReadAccess(tenantId, deps);
  if (!access.ok) return json({ error: access.error }, { status: access.status });

  const result = await getWordPressConnectorForTenant(tenantId, deps);
  if (!result.ok) return json({ error: result.error }, { status: 404 });
  return json(result);
}

export async function handleWordPressConnectorPut(
  tenantId: string,
  request: Request,
  deps: WordPressRouteDeps = buildWordPressConnectorDeps(),
) {
  const access = await requireWordPressConnectorManageAccess(tenantId, deps);
  if (!access.ok) return json({ error: access.error }, { status: access.status });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = await saveWordPressConnectorForTenant(
    tenantId,
    body,
    deps,
    deps.now(),
  );
  if (!result.ok) {
    const status = result.error === "Tenant not found" ? 404 : 400;
    return json({ error: result.error }, { status });
  }
  return json(result);
}

export async function handleWordPressConnectorDelete(
  tenantId: string,
  deps: WordPressRouteDeps = buildWordPressConnectorDeps(),
) {
  const access = await requireWordPressConnectorManageAccess(tenantId, deps);
  if (!access.ok) return json({ error: access.error }, { status: access.status });

  const result = await deleteWordPressConnectorForTenant(tenantId, deps);
  if (!result.ok) return json({ error: result.error }, { status: 404 });
  return json(result);
}

export async function handleWordPressConnectorTest(
  tenantId: string,
  request: Request,
  deps: WordPressRouteDeps = buildWordPressConnectorDeps(),
) {
  const access = await requireWordPressConnectorManageAccess(tenantId, deps);
  if (!access.ok) return json({ error: access.error }, { status: access.status });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = await testWordPressConnectorForTenant(tenantId, body, deps);
  if (!result.ok) return json(result, { status: 400 });
  return json(result);
}
