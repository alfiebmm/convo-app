import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { SensitiveAction } from "@/lib/platform-admin/audit";
import {
  adminStepUpCookieName,
  verifyStepUpSession,
} from "@/lib/platform-admin/admin-session-core";
import { requireAdminSession } from "@/lib/platform-admin/admin-session";

export async function requireStepUp(action: SensitiveAction) {
  const { user } = await requireAdminSession();
  const cookieStore = await cookies();
  const token = cookieStore.get(adminStepUpCookieName)?.value;
  const session = token ? await verifyStepUpSession(token, action) : null;

  if (!session || session.userId !== user.id) {
    redirect(`/platform-admin/challenge-mfa?stepUp=${encodeURIComponent(action)}`);
  }

  return { user, action, issuedAt: session.issuedAt };
}
