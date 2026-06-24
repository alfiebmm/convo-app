import { notFound } from "next/navigation";
import { requireAuth, getCurrentUser } from "@/lib/auth-context";

type PlatformStaffUser = {
  id: string;
  email: string | null;
  isPlatformStaff: boolean | null;
};

type AuthResult = {
  user: PlatformStaffUser;
};

export function parsePlatformStaffEmails(
  raw = process.env.PLATFORM_STAFF_EMAILS ?? "",
) {
  return new Set(
    raw
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function evaluatePlatformStaffAccess(
  user: PlatformStaffUser | null | undefined,
  allowlist = parsePlatformStaffEmails(),
) {
  if (!user?.email) return false;
  return allowlist.has(user.email.toLowerCase()) && user.isPlatformStaff === true;
}

export async function isPlatformStaff({
  getUser = getCurrentUser,
  allowlist = parsePlatformStaffEmails(),
}: {
  getUser?: () => Promise<PlatformStaffUser | null>;
  allowlist?: Set<string>;
} = {}) {
  try {
    const user = await getUser();
    return evaluatePlatformStaffAccess(user, allowlist);
  } catch {
    return false;
  }
}

export async function requirePlatformStaff({
  requireUser = requireAuth,
  allowlist = parsePlatformStaffEmails(),
}: {
  requireUser?: () => Promise<AuthResult>;
  allowlist?: Set<string>;
} = {}) {
  const { user } = await requireUser();

  if (!evaluatePlatformStaffAccess(user, allowlist)) {
    notFound();
  }

  return { user };
}
