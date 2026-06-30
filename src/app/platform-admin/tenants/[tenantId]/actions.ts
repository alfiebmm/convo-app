"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/platform-admin/admin-session";
import { withAuditLog } from "@/lib/platform-admin/audit";
import {
  getImpersonationCookieOptions,
  impersonationCookieName,
  mintImpersonationCookie,
} from "@/lib/platform-admin/impersonation";

/**
 * CON-239 \u2014 Start impersonating a tenant.
 *
 * Gated by `requireAdminSession` (the same gate every other /platform-admin
 * route uses, which already checks `is_platform_staff`, the email
 * allowlist, and a fresh MFA challenge). Writes an `impersonation.start`
 * audit event via `withAuditLog`, then sets a 60-minute signed cookie
 * and redirects to /dashboard, where `getCurrentTenant` will scope to
 * the impersonated tenant.
 */
export async function startImpersonationAction(tenantId: string) {
  if (!tenantId || typeof tenantId !== "string") {
    throw new Error("startImpersonationAction: tenantId is required");
  }

  const { user } = await requireAdminSession();
  if (!user.email) {
    throw new Error("startImpersonationAction: staff user has no email");
  }

  const result = await withAuditLog({
    action: "impersonation.start",
    target: { type: "tenant", id: tenantId },
    reason: "Staff impersonation via /platform-admin/tenants",
    fn: async () => ({
      staffUserId: user.id,
      staffEmail: user.email as string,
      tenantId,
    }),
  });

  if (!result.ok) {
    throw new Error(
      `startImpersonationAction: audit log failed: ${result.error.message}`,
    );
  }

  const token = await mintImpersonationCookie({
    staffUserId: user.id,
    staffEmail: user.email,
    tenantId,
  });

  const cookieStore = await cookies();
  cookieStore.set(
    impersonationCookieName,
    token,
    getImpersonationCookieOptions(),
  );

  redirect("/dashboard");
}
