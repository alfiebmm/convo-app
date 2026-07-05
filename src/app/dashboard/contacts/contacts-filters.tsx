"use client";

import { useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CONTACT_FILTER_STORAGE_KEY,
  contactFiltersToSearchParams,
  contactFiltersToStorage,
  hasContactFilterParams,
  parseContactFilters,
  parseStoredContactFilters,
  type ContactFilterParamKey,
  type ContactFilterState,
} from "./filter-state";

const SELECT_CLASS =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700";
const INPUT_CLASS =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400";

const caseStatusOptions = [
  { value: "", label: "Any case status" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "waiting_on_customer", label: "Waiting on customer" },
];

function setManagedParams(filters: ContactFilterState) {
  return contactFiltersToSearchParams(filters).toString();
}

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

export function ContactsFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  const filters = useMemo(
    () => parseContactFilters(new URLSearchParams(search)),
    [search],
  );

  useEffect(() => {
    const current = new URLSearchParams(search);
    if (hasContactFilterParams(current)) {
      sessionStorage.setItem(
        CONTACT_FILTER_STORAGE_KEY,
        contactFiltersToStorage(parseContactFilters(current)),
      );
      return;
    }

    const stored = parseStoredContactFilters(
      sessionStorage.getItem(CONTACT_FILTER_STORAGE_KEY),
    );
    const storedQuery = setManagedParams(stored);
    if (storedQuery) {
      router.replace(`/dashboard/contacts?${storedQuery}`);
    }
  }, [router, search]);

  function updateFilter(key: ContactFilterParamKey, value: string) {
    const next: ContactFilterState = { ...filters };
    if (value) {
      if (key === "sort") {
        next.sort = value as ContactFilterState["sort"];
      } else {
        next[key] = value as ContactFilterState[typeof key];
      }
    } else {
      delete next[key];
    }
    if (key !== "page") delete next.page;

    const query = setManagedParams(next);
    sessionStorage.setItem(
      CONTACT_FILTER_STORAGE_KEY,
      contactFiltersToStorage(next),
    );
    router.push(`/dashboard/contacts${query ? `?${query}` : ""}`);
  }

  function clearFilters() {
    sessionStorage.removeItem(CONTACT_FILTER_STORAGE_KEY);
    router.push("/dashboard/contacts");
  }

  return (
    <div className="mt-4 w-full border-t border-slate-200 pt-4 sm:mt-0 sm:border-t-0 sm:pt-0">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <FilterShell label="Search">
          <input
            value={filters.q ?? ""}
            onChange={(event) => updateFilter("q", event.target.value)}
            className={INPUT_CLASS}
            placeholder="Name, email, phone, company"
          />
        </FilterShell>

        <FilterShell label="Persona">
          <input
            value={filters.persona ?? ""}
            onChange={(event) => updateFilter("persona", event.target.value)}
            className={INPUT_CLASS}
            placeholder="Any persona"
          />
        </FilterShell>

        <FilterShell label="Case type">
          <input
            value={filters["case-type"] ?? ""}
            onChange={(event) => updateFilter("case-type", event.target.value)}
            className={INPUT_CLASS}
            placeholder="Any type"
          />
        </FilterShell>

        <FilterShell label="Case status">
          <select
            value={filters["case-status"] ?? ""}
            onChange={(event) =>
              updateFilter("case-status", event.target.value)
            }
            className={SELECT_CLASS}
          >
            {caseStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FilterShell>

        <FilterShell label="From">
          <input
            type="date"
            value={filters.from ?? ""}
            onChange={(event) => updateFilter("from", event.target.value)}
            className={INPUT_CLASS}
          />
        </FilterShell>

        <FilterShell label="To">
          <input
            type="date"
            value={filters.to ?? ""}
            onChange={(event) => updateFilter("to", event.target.value)}
            className={INPUT_CLASS}
          />
        </FilterShell>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={clearFilters}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
        >
          Clear filters
        </button>
      </div>
    </div>
  );
}
