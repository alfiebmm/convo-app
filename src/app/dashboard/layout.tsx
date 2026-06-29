import Link from "next/link";
import { Suspense } from "react";
import { headers } from "next/headers";
import { APP_CONFIG } from "@/config/app";
import {
  requireAuth,
  getCurrentTenant,
  getUserTenantsForCurrentUser,
} from "@/lib/auth-context";
import { TenantSwitcher } from "./tenant-switcher";
import { UserMenu } from "./user-menu";
import { WelcomeBackToast } from "./welcome-back-toast";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: "📊" },
  { href: "/dashboard/conversations", label: "Conversations", icon: "💬" },
  { href: "/dashboard/contacts", label: "Contacts", icon: "👥" },
  { href: "/dashboard/content", label: "Content", icon: "📝" },
  { href: "/dashboard/knowledge", label: "Knowledge", icon: "📚" },
  { href: "/dashboard/widget", label: "Widget", icon: "⚡" },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙️" },
  { href: "/dashboard/help", label: "Help", icon: "?" },
];

async function getDashboardContext() {
  const { user } = await requireAuth();
  const tenant = await getCurrentTenant();
  const userTenants = await getUserTenantsForCurrentUser();

  return { user, tenant, userTenants };
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const requestHeaders = await headers();
  const isLocalHelpPreview =
    requestHeaders.get("x-convo-local-help-preview") === "1";
  const { user, tenant, userTenants } = isLocalHelpPreview
    ? {
        user: {
          name: "Local Help Preview",
          email: "preview@localhost",
          image: null,
          avatarUrl: null,
        },
        tenant: null,
        userTenants: [],
      }
    : await getDashboardContext();

  return (
    <div className="dashboard-shell flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-200 bg-white">
        <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-6">
          <span className="text-xl font-bold text-slate-900">
            {APP_CONFIG.name}
          </span>
        </div>
        <nav className="p-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-slate-50">
        <div className="h-16 border-b border-slate-200 bg-white flex items-center px-8">
          <div className="ml-auto flex items-center gap-4">
            {userTenants.length > 1 ? (
              <TenantSwitcher
                tenants={userTenants.map((t) => ({
                  id: t.tenant.id,
                  name: t.tenant.name,
                }))}
                activeTenantId={tenant?.id ?? null}
              />
            ) : (
              <span className="text-sm text-slate-500">
                {tenant?.name ?? "No site"}
              </span>
            )}
            <UserMenu
              name={user.name ?? user.email}
              email={user.email}
              avatarUrl={user.image ?? user.avatarUrl ?? null}
            />
          </div>
        </div>
        <div className="p-8">{children}</div>
      </main>
      <Suspense fallback={null}>
        <WelcomeBackToast />
      </Suspense>
    </div>
  );
}
