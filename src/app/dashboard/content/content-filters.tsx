"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function StatusFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("status") ?? "all";

  const options = [
    { value: "all", label: "All statuses" },
    { value: "pending", label: "Pending" },
    { value: "review", label: "In Review" },
    { value: "approved", label: "Approved" },
    { value: "published", label: "Published" },
    { value: "rejected", label: "Rejected" },
  ];

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    if (e.target.value === "all") {
      params.delete("status");
    } else {
      params.set("status", e.target.value);
    }
    router.push(`/dashboard/content?${params.toString()}`);
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

export function TypeFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("type") ?? "all";

  const options = [
    { value: "all", label: "All types" },
    { value: "blog", label: "Blog" },
    { value: "faq", label: "FAQ" },
    { value: "page_section", label: "Page Section" },
  ];

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    if (e.target.value === "all") {
      params.delete("type");
    } else {
      params.set("type", e.target.value);
    }
    router.push(`/dashboard/content?${params.toString()}`);
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
