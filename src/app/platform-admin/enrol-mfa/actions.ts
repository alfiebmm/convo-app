"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verify } from "otplib";
import {
  adminSessionCookieName,
  getAdminSessionCookieOptions,
  mintAdminSession,
} from "@/lib/platform-admin/admin-session";
import { requirePlatformStaff } from "@/lib/platform-admin/access";
import { withAuditLog } from "@/lib/platform-admin/audit";
import { enrolUserTotp } from "@/lib/platform-admin/mfa";

export async function enrolMfaAction(formData: FormData) {
  const { user } = await requirePlatformStaff();
  if (user.totpEnrolledAt) redirect("/platform-admin");

  const secret = String(formData.get("secret") ?? "");
  const token = String(formData.get("token") ?? "");
  const saved = formData.get("saved") === "on";
  const recoveryCodes = formData
    .getAll("recoveryCode")
    .map((value) => String(value))
    .filter(Boolean);

  if (!saved || recoveryCodes.length !== 10) {
    redirect("/platform-admin/enrol-mfa?error=recovery");
  }

  const verified = (await verify({ token: token.trim(), secret })).valid;
  if (!verified) {
    redirect("/platform-admin/enrol-mfa?error=code");
  }

  const result = await withAuditLog({
    action: "admin.mfa.enrolled",
    target: { type: "user", id: user.id },
    metadata: { recovery_code_count: recoveryCodes.length },
    fn: () => enrolUserTotp({ userId: user.id, secret, recoveryCodes }),
  });

  if (!result.ok) {
    throw result.error;
  }

  const cookieStore = await cookies();
  cookieStore.set(
    adminSessionCookieName,
    await mintAdminSession(user.id),
    getAdminSessionCookieOptions(),
  );
  redirect("/platform-admin");
}
