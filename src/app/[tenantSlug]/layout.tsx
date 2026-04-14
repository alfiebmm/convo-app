import { notFound } from "next/navigation";
import Link from "next/link";
import { getTenantBySlug } from "@/lib/db/queries";
import { APP_CONFIG } from "@/config/app";

interface TenantSettings {
  primaryColor?: string;
  logo?: string;
  [key: string]: unknown;
}

export default async function TenantPublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const tenant = await getTenantBySlug(tenantSlug);

  if (!tenant) {
    notFound();
  }

  const settings = (tenant.settings ?? {}) as TenantSettings;
  const primaryColor = settings.primaryColor || APP_CONFIG.branding.primary;

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-50">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-4 sm:px-6 h-16">
          <Link
            href={`/${tenantSlug}`}
            className="flex items-center gap-3"
          >
            {settings.logo ? (
              <img
                src={settings.logo as string}
                alt={tenant.name}
                className="h-8 w-auto"
              />
            ) : (
              <span
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white text-sm font-bold"
                style={{ backgroundColor: primaryColor }}
              >
                {tenant.name.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="text-lg font-semibold text-slate-900">
              {tenant.name}
            </span>
          </Link>
          <span className="text-xs text-slate-400 hidden sm:block">
            Knowledge Hub
          </span>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} {tenant.name}. All rights reserved.
          </p>
          <a
            href={APP_CONFIG.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
          >
            Powered by {APP_CONFIG.name}
          </a>
        </div>
      </footer>
    </div>
  );
}
