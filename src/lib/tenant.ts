/**
 * Multi-tenant context utilities.
 * Every API/page request resolves the current tenant from the session.
 */
import { db } from "./db";
import { tenants, tenantMembers, users } from "./db/schema";
import { eq, and } from "drizzle-orm";

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
  return db.transaction(async (tx) => {
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
