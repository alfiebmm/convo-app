import { redirect } from "next/navigation";
import Link from "next/link";

import { getCurrentTenant } from "@/lib/auth-context";
import { assertTenantId } from "@/lib/cases/tenant-guard";
import { WordPressSettingsPanel } from "./wordpress-settings-panel";

export default async function WordPressSettingsPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");
  assertTenantId(tenant.id);

  return (
    <div>
      <header className="mb-6">
        <Link
          href="/dashboard/settings"
          className="text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900"
        >
          Back to settings
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-zinc-900">
          WordPress connector
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Save the WordPress credentials used by the blog publishing flow.
        </p>
      </header>

      <WordPressSettingsPanel tenantId={tenant.id} />
    </div>
  );
}
