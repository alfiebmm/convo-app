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
import {
  impersonationCookieName,
  verifyImpersonationCookie,
} from "./platform-admin/impersonation";

/**
 * CON-239 — if a valid impersonation cookie is set AND the current
 * session belongs to that staff user, return the impersonated tenant
 * id so tenant-scoped queries see the right rows.
 */
async function getImpersonatedTenantIdForUser(userId: string) {
  const cookieStore = await cookies();
  const raw = cookieStore.get(impersonationCookieName)?.value;
  const payload = await verifyImpersonationCookie(raw);
  if (!payload) return null;
  if (payload.staffUserId !== userId) return null;
  return payload.tenantId;
}

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

  // CON-239: impersonation cookie wins when present + valid + bound
  // to this user. Falls back to the user's own membership.
  const impersonatedTenantId = user.isPlatformStaff
    ? await getImpersonatedTenantIdForUser(user.id)
    : null;
  const activeTenantId =
    impersonatedTenantId ?? (await getActiveTenantIdForUser(user.id));
  if (!activeTenantId) return null;

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, activeTenantId))
    .limit(1);

  return tenant ?? null;
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

export async function listTenantUsersForCurrentUser(tenantId: string) {
  const user = await getCurrentUser();
  if (!user) return [];

  const membership = await getTenantMembership(user.id, tenantId);
  if (!membership) return [];

  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: tenantMembers.role,
    })
    .from(tenantMembers)
    .innerJoin(users, eq(tenantMembers.userId, users.id))
    .where(eq(tenantMembers.tenantId, tenantId))
    .orderBy(users.name, users.email);
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

  const membership = await getTenantMembership(user.id, tenantId);

  if (!membership) {
    redirect("/dashboard");
  }

  return { user, membership };
}

export async function getTenantMembership(userId: string, tenantId: string) {
  const [membership] = await db
    .select()
    .from(tenantMembers)
    .where(
      and(
        eq(tenantMembers.tenantId, tenantId),
        eq(tenantMembers.userId, userId)
      )
    )
    .limit(1);

  return membership ?? null;
}

export async function userHasTenantAccess(userId: string, tenantId: string) {
  const membership = await getTenantMembership(userId, tenantId);
  return membership !== null;
}

export async function getActiveTenantIdForUser(userId: string) {
  const cookieStore = await cookies();
  const activeTenantId = cookieStore.get("active-tenant")?.value;

  if (activeTenantId) {
    const membership = await getTenantMembership(userId, activeTenantId);
    if (membership) return activeTenantId;
  }

  const [first] = await db
    .select({ tenantId: tenantMembers.tenantId })
    .from(tenantMembers)
    .where(eq(tenantMembers.userId, userId))
    .limit(1);

  return first?.tenantId ?? null;
}
