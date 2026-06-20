import type { getTenantMembership } from "@/lib/auth-context";

type TenantMembership = NonNullable<Awaited<ReturnType<typeof getTenantMembership>>>;
type TenantRole = TenantMembership["role"];

const ROLE_RANK: Record<TenantRole, number> = {
  owner: 4,
  admin: 3,
  editor: 2,
  viewer: 1,
};

export function canViewCasePii(membership: TenantMembership | null): boolean {
  if (!membership) return false;
  return ROLE_RANK[membership.role] >= ROLE_RANK.editor;
}

export function canMutateCases(membership: TenantMembership | null): boolean {
  if (!membership) return false;
  return ROLE_RANK[membership.role] >= ROLE_RANK.editor;
}
