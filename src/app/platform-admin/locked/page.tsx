import { requirePlatformStaff } from "@/lib/platform-admin/access";
import { withAuditLog } from "@/lib/platform-admin/audit";

export default async function PlatformAdminLockedPage() {
  const { user } = await requirePlatformStaff();

  await withAuditLog({
    action: "admin.mfa.locked_visit",
    target: { type: "user", id: user.id },
    metadata: {
      locked_until: user.lockedUntil
        ? new Date(user.lockedUntil).toISOString()
        : null,
    },
    fn: async () => ({ locked: true }),
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12 text-zinc-950">
      <p className="text-sm font-semibold uppercase tracking-normal text-[#E85A1E]">
        Platform Admin
      </p>
      <h1 className="mt-2 font-display text-4xl font-bold tracking-normal">
        Account locked
      </h1>
      <p className="mt-4 text-base leading-7 text-zinc-700">
        Account locked. Contact Blake to unlock.
      </p>
    </main>
  );
}
