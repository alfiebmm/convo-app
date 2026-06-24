import type { ReactNode } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/platform-admin/admin-session";
import { requirePlatformStaff } from "@/lib/platform-admin/access";

export const dynamic = "force-dynamic";

function navClass(pathname: string, href: string) {
  const active =
    href === "/platform-admin" ? pathname === href : pathname.startsWith(href);
  return `block rounded-md px-3 py-2 ${
    active
      ? "bg-zinc-800 text-white"
      : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
  }`;
}

export default async function PlatformAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { user } = await requirePlatformStaff();
  const headerStore = await headers();
  const pathname = headerStore.get("x-platform-admin-pathname") ?? "";
  const now = Number(headerStore.get("x-platform-admin-now") ?? "0");
  const adminEmail = user.email;
  const lockedUntil = user.lockedUntil ? new Date(user.lockedUntil) : null;
  const isLocked = lockedUntil ? lockedUntil.getTime() > now : false;
  const isEnrolmentRoute = pathname === "/platform-admin/enrol-mfa";
  const isChallengeRoute = pathname === "/platform-admin/challenge-mfa";
  const isLockedRoute = pathname === "/platform-admin/locked";

  if (isLocked && !isLockedRoute) {
    redirect("/platform-admin/locked");
  }

  if (isLockedRoute) {
    return children;
  }

  if (!user.totpEnrolledAt && !isEnrolmentRoute) {
    redirect("/platform-admin/enrol-mfa");
  }

  if (user.totpEnrolledAt && isEnrolmentRoute) {
    redirect("/platform-admin");
  }

  if (!isEnrolmentRoute && !isChallengeRoute) {
    await requireAdminSession();
  }

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-950">
      <div className="fixed inset-x-0 top-0 z-50 border-b border-red-950 bg-red-700 px-5 py-2 text-sm font-semibold text-white shadow-sm">
        Platform Admin &mdash; {adminEmail}
      </div>

      <div className="flex min-h-screen pt-9">
        <aside className="fixed bottom-0 left-0 top-9 w-64 border-r border-zinc-800 bg-zinc-900 text-white">
          <div className="absolute inset-y-0 left-0 w-1 bg-[#FF6B2C]" />
          <div className="px-6 py-7">
            <Link
              href="/platform-admin"
              className="font-display text-2xl font-bold tracking-normal text-white"
            >
              Convo
            </Link>
            <p className="mt-1 text-xs font-medium uppercase tracking-normal text-zinc-400">
              Platform Admin
            </p>
          </div>

          <nav className="space-y-1 px-3 text-sm font-medium">
            <Link
              href="/platform-admin"
              className={navClass(pathname, "/platform-admin")}
            >
              Home
            </Link>
            <Link
              href="/platform-admin/tenants"
              className={navClass(pathname, "/platform-admin/tenants")}
            >
              Tenants
            </Link>
            <Link
              href="/platform-admin/injection-events"
              className={navClass(pathname, "/platform-admin/injection-events")}
            >
              Injection events
            </Link>
            <Link
              href="/platform-admin/audit"
              className={navClass(pathname, "/platform-admin/audit")}
            >
              Audit log
            </Link>
          </nav>
        </aside>

        <main className="ml-64 flex min-h-[calc(100vh-2.25rem)] flex-1 flex-col">
          <div className="border-b border-zinc-200 bg-white px-8 py-5">
            <div className="h-1 w-24 rounded-full bg-[#FF6B2C]" />
          </div>
          <div className="flex-1 px-8 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
