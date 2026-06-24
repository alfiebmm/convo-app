import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { requirePlatformStaff } from "@/lib/platform-admin/access";
import {
  adminSessionCookieName,
  getAdminSessionCookieOptions,
  refreshAdminSessionToken,
  shouldRefreshAdminSession,
  verifyAdminSession,
} from "@/lib/platform-admin/admin-session-core";

export {
  adminSessionCookieName,
  getAdminSessionCookieOptions,
  mintAdminSession,
  verifyAdminSession,
} from "@/lib/platform-admin/admin-session-core";

export async function requireAdminSession() {
  const { user } = await requirePlatformStaff();
  const cookieStore = await cookies();
  const token = cookieStore.get(adminSessionCookieName)?.value;
  if (!token) redirect("/platform-admin/challenge-mfa");

  const session = await verifyAdminSession(token);
  if (!session || session.userId !== user.id) {
    redirect("/platform-admin/challenge-mfa");
  }

  if (shouldRefreshAdminSession(session)) {
    cookieStore.set(
      adminSessionCookieName,
      await refreshAdminSessionToken(session),
      getAdminSessionCookieOptions(),
    );
  }

  return { user, session };
}

export async function requireAdminSessionOrNotFound() {
  try {
    return await requireAdminSession();
  } catch (err) {
    if (err instanceof Error && err.message === "NEXT_NOT_FOUND") throw err;
    notFound();
  }
}
