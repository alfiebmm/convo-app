"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function ConversationStatusFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("status") ?? "all";

  const options = [
    { value: "all", label: "All statuses" },
    { value: "active", label: "Active" },
    { value: "completed", label: "Completed" },
    { value: "archived", label: "Archived" },
  ];

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    if (e.target.value === "all") {
      params.delete("status");
    } else {
      params.set("status", e.target.value);
    }
    router.push(`/dashboard/conversations?${params.toString()}`);
  }

  return (
    <select
      value={current}
      onChange={onChange}
      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
