import Link from "next/link";
import { APP_CONFIG } from "@/config/app";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: "📊" },
  { href: "/dashboard/conversations", label: "Conversations", icon: "💬" },
  { href: "/dashboard/content", label: "Content", icon: "📝" },
  { href: "/dashboard/widget", label: "Widget", icon: "⚡" },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙️" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
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
            <span className="text-sm text-slate-500">Tenant: Demo Site</span>
          </div>
        </div>
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
