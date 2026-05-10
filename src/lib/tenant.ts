/**
 * Multi-tenant context utilities.
 * Every API/page request resolves the current tenant from the session.
 */
import { db } from "./db";
import { tenants, tenantMembers } from "./db/schema";
import { eq, and } from "drizzle-orm";
import { indexTenantSite } from "./knowledge/indexer";

export async function getTenantBySlug(slug: string) {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  return tenant ?? null;
}

export async function getTenantById(id: string) {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, id))
    .limit(1);
  return tenant ?? null;
}

export async function getUserTenants(userId: string) {
  return db
    .select({
      tenant: tenants,
      role: tenantMembers.role,
    })
    .from(tenantMembers)
    .innerJoin(tenants, eq(tenantMembers.tenantId, tenants.id))
    .where(eq(tenantMembers.userId, userId));
}

export async function createTenant(data: {
  name: string;
  slug: string;
  domain?: string;
  ownerUserId: string;
}) {
  const tenant = await db.transaction(async (tx) => {
    const [tenant] = await tx
      .insert(tenants)
      .values({
        name: data.name,
        slug: data.slug,
        domain: data.domain,
      })
      .returning();

    await tx.insert(tenantMembers).values({
      tenantId: tenant.id,
      userId: data.ownerUserId,
      role: "owner",
    });

    return tenant;
  });

  // Trigger site indexing asynchronously if domain provided
  if (data.domain) {
    // Fire and forget - don't block tenant creation
    setImmediate(() => {
      indexTenantSite(tenant.id, data.domain!).catch((error) => {
        console.error(
          `[Tenant] Failed to index site for tenant ${tenant.id}:`,
          error
        );
      });
    });
  }

  return tenant;
}

export async function checkMembership(tenantId: string, userId: string) {
  const [member] = await db
    .select()
    .from(tenantMembers)
    .where(
      and(
        eq(tenantMembers.tenantId, tenantId),
        eq(tenantMembers.userId, userId)
      )
    )
    .limit(1);
  return member ?? null;
}
