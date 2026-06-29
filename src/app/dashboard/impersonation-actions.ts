"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { withAuditLog } from "@/lib/platform-admin/audit";
import {
  impersonationCookieName,
  verifyImpersonationCookie,
} from "@/lib/platform-admin/impersonation";
import { getCurrentUser } from "@/lib/auth-context";

/**
 * CON-239 \u2014 Stop impersonating the current tenant.
 *
 * Writes an `impersonation.end` audit event, clears the cookie, and
 * redirects back to /platform-admin. Safe to call when no cookie is
 * set (treated as a no-op redirect).
 */
export async function stopImpersonationAction() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(impersonationCookieName)?.value;
  const payload = await verifyImpersonationCookie(raw);

  if (payload) {
    const user = await getCurrentUser();
    // Only the staff member who minted the cookie may end its own
    // impersonation. Anything else is a malformed/stolen cookie; we
    // clear it but skip the audit write to avoid spurious actor rows.
    if (user && user.id === payload.staffUserId) {
      await withAuditLog({
        action: "impersonation.end",
        target: { type: "tenant", id: payload.tenantId },
        fn: async () => ({
          staffUserId: payload.staffUserId,
          staffEmail: payload.staffEmail,
          tenantId: payload.tenantId,
        }),
      });
    }
  }

  cookieStore.set(impersonationCookieName, "", {
    path: "/",
    maxAge: 0,
  });

  redirect("/platform-admin");
}
