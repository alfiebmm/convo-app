"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  adminSessionCookieName,
  adminStepUpCookieName,
  getAdminSessionCookieOptions,
  mintAdminSession,
  mintStepUpSession,
} from "@/lib/platform-admin/admin-session-core";
import { requirePlatformStaff } from "@/lib/platform-admin/access";
import {
  sensitiveAuditActions,
  withAuditLog,
  type SensitiveAction,
} from "@/lib/platform-admin/audit";
import {
  consumeRecoveryCodeAndResetTotp,
  lockUserUntil,
  recordTotpAttempt,
  verifyUserTotp,
} from "@/lib/platform-admin/mfa";

function getRequestIp(headerStore: Headers) {
  return (
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerStore.get("x-real-ip") ??
    null
  );
}

function getSensitiveAction(value: FormDataEntryValue | null): SensitiveAction | null {
  if (typeof value !== "string" || !value) return null;
  return (sensitiveAuditActions as readonly string[]).includes(value)
    ? (value as SensitiveAction)
    : null;
}

export async function verifyTotpAndIssueSession(formData: FormData) {
  const { user } = await requirePlatformStaff();
  const token = String(formData.get("token") ?? "");
  const callbackUrl = String(formData.get("callbackUrl") ?? "/platform-admin");
  const stepUpAction = getSensitiveAction(formData.get("stepUp"));
  const headerStore = await headers();
  const ip = getRequestIp(headerStore);

  const verified = await verifyUserTotp(user.id, token);
  const attempt = await recordTotpAttempt({ userId: user.id, success: verified, ip });

  if (!verified) {
    await withAuditLog({
      action: stepUpAction ? "admin.mfa.stepup_failure" : "admin.mfa.challenge_failure",
      target: { type: "user", id: user.id },
      metadata: { ip, locked: attempt.locked, step_up_action: stepUpAction },
      fn: async () => ({ success: false, locked: attempt.locked }),
    });

    if (attempt.locked) {
      await withAuditLog({
        action: "admin.mfa.locked",
        target: { type: "user", id: user.id },
        metadata: { ip, locked_until: attempt.lockedUntil?.toISOString() },
        fn: async () => {
          if (!attempt.lockedUntil) throw new Error("Missing locked_until");
          return lockUserUntil(user.id, attempt.lockedUntil);
        },
      });
      redirect("/platform-admin/locked");
    }

    redirect(`/platform-admin/challenge-mfa?error=code${stepUpAction ? `&stepUp=${encodeURIComponent(stepUpAction)}` : ""}`);
  }

  const action = stepUpAction ? "admin.mfa.stepup_success" : "admin.mfa.challenge_success";
  const result = await withAuditLog({
    action,
    target: { type: "user", id: user.id },
    metadata: { ip, step_up_action: stepUpAction },
    fn: async () => ({ success: true }),
  });
  if (!result.ok) throw result.error;

  const cookieStore = await cookies();
  if (stepUpAction) {
    cookieStore.set(
      adminStepUpCookieName,
      await mintStepUpSession(user.id, stepUpAction),
      getAdminSessionCookieOptions(5 * 60),
    );
  } else {
    cookieStore.set(
      adminSessionCookieName,
      await mintAdminSession(user.id),
      getAdminSessionCookieOptions(),
    );
  }

  redirect(callbackUrl.startsWith("/platform-admin") ? callbackUrl : "/platform-admin");
}

export async function useRecoveryCodeAction(formData: FormData) {
  const { user } = await requirePlatformStaff();
  const code = String(formData.get("recoveryCode") ?? "");
  const audit = await withAuditLog({
    action: "admin.mfa.recovery_code_used",
    target: { type: "user", id: user.id },
    fn: async () => consumeRecoveryCodeAndResetTotp({ userId: user.id, code }),
  });
  if (!audit.ok) throw audit.error;
  if (!audit.value.ok) {
    redirect("/platform-admin/challenge-mfa?error=recovery");
  }

  redirect("/platform-admin/enrol-mfa");
}
