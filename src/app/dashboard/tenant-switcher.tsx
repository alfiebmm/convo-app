"use client";

import { useRouter } from "next/navigation";

interface TenantSwitcherProps {
  tenants: Array<{ id: string; name: string }>;
  activeTenantId: string | null;
}

export function TenantSwitcher({ tenants, activeTenantId }: TenantSwitcherProps) {
  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const tenantId = e.target.value;
    // Set cookie and refresh
    document.cookie = `active-tenant=${tenantId};path=/;max-age=${60 * 60 * 24 * 365}`;
    router.refresh();
  }

  return (
    <select
      value={activeTenantId ?? ""}
      onChange={handleChange}
      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600"
    >
      {tenants.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  );
}
