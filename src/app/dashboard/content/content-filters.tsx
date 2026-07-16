"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const SELECT_CLASS =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700";
const INPUT_CLASS =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400";

const statusOptions = [
  { value: "", label: "Any status" },
  { value: "draft", label: "Draft" },
  { value: "in_review", label: "In Review" },
  { value: "approved", label: "Approved" },
  { value: "published", label: "Published" },
  { value: "rejected", label: "Rejected" },
];

function FilterShell({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="min-w-0">
      <span className="mb-1 block text-xs font-medium text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

export function ContentFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  const filters = useMemo(() => new URLSearchParams(search), [search]);

  function push(next: URLSearchParams) {
    const query = next.toString();
    router.push(`/dashboard/content${query ? `?${query}` : ""}`);
  }

  function updateFilter(key: "status" | "topic" | "persona", value: string) {
    const next = new URLSearchParams(filters.toString());
    if (value.trim()) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.delete("page");
    push(next);
  }

  function clearFilters() {
    router.push("/dashboard/content");
  }

  return (
    <div className="mt-4 w-full border-t border-slate-200 pt-4 sm:mt-0 sm:border-t-0 sm:pt-0">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FilterShell label="Status">
          <select
            value={filters.get("status") ?? ""}
            onChange={(event) => updateFilter("status", event.target.value)}
            className={SELECT_CLASS}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FilterShell>

        <FilterShell label="Topic">
          <input
            value={filters.get("topic") ?? ""}
            onChange={(event) => updateFilter("topic", event.target.value)}
            className={INPUT_CLASS}
            placeholder="Any topic"
          />
        </FilterShell>

        <FilterShell label="Persona">
          <input
            value={filters.get("persona") ?? ""}
            onChange={(event) => updateFilter("persona", event.target.value)}
            className={INPUT_CLASS}
            placeholder="Any persona"
          />
        </FilterShell>

        <div className="flex items-end">
          <button
            type="button"
            onClick={clearFilters}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            Clear filters
          </button>
        </div>
      </div>
    </div>
  );
}
