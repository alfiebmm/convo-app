/**
 * Server-side auth & tenant context helpers.
 * Use these in RSC pages and route handlers.
 */
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "./auth";
import { db } from "./db";
import { users, tenantMembers, tenants } from "./db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Get the authenticated user from the session.
 * Returns null if not authenticated.
 */
export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  return user ?? null;
}

/**
 * Get the active tenant for the current user.
 * Priority: cookie "active-tenant" > first tenant membership.
 */
export async function getCurrentTenant() {
  const user = await getCurrentUser();
  if (!user) return null;

  const cookieStore = await cookies();
  const activeTenantId = cookieStore.get("active-tenant")?.value;

  // If user has a cookie preference, verify membership
  if (activeTenantId) {
    const [membership] = await db
      .select({ tenant: tenants, role: tenantMembers.role })
      .from(tenantMembers)
      .innerJoin(tenants, eq(tenantMembers.tenantId, tenants.id))
      .where(
        and(
          eq(tenantMembers.userId, user.id),
          eq(tenantMembers.tenantId, activeTenantId)
        )
      )
      .limit(1);

    if (membership) return membership.tenant;
  }

  // Fall back to first tenant
  const [first] = await db
    .select({ tenant: tenants, role: tenantMembers.role })
    .from(tenantMembers)
    .innerJoin(tenants, eq(tenantMembers.tenantId, tenants.id))
    .where(eq(tenantMembers.userId, user.id))
    .limit(1);

  return first?.tenant ?? null;
}

/**
 * Get all tenants the current user belongs to.
 */
export async function getUserTenantsForCurrentUser() {
  const user = await getCurrentUser();
  if (!user) return [];

  return db
    .select({ tenant: tenants, role: tenantMembers.role })
    .from(tenantMembers)
    .innerJoin(tenants, eq(tenantMembers.tenantId, tenants.id))
    .where(eq(tenantMembers.userId, user.id));
}

/**
 * Require auth — redirects to /login if not authenticated.
 * Returns the user and session.
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user) {
    redirect("/login");
  }

  return { user, session };
}

/**
 * Verify the current user has access to a specific tenant.
 */
export async function requireTenantAccess(tenantId: string) {
  const { user } = await requireAuth();

  const [membership] = await db
    .select()
    .from(tenantMembers)
    .where(
      and(
        eq(tenantMembers.tenantId, tenantId),
        eq(tenantMembers.userId, user.id)
      )
    )
    .limit(1);

  if (!membership) {
    redirect("/dashboard");
  }

  return { user, membership };
}
