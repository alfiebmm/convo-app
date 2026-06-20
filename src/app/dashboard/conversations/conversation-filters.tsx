"use client";

import { useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CONVERSATION_FILTER_STORAGE_KEY,
  conversationFiltersToSearchParams,
  conversationFiltersToStorage,
  hasConversationFilterParams,
  parseConversationFilters,
  parseStoredConversationFilters,
  type ConversationFilterParamKey,
  type ConversationFilterState,
} from "./filter-state";

const SELECT_CLASS =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700";
const INPUT_CLASS =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400";

const caseTypeOptions = [
  { value: "", label: "Any type" },
  { value: "cx_support", label: "CX support" },
  { value: "lead", label: "Lead" },
];

const followUpOptions = [
  { value: "", label: "Any follow-up" },
  { value: "true", label: "Required" },
  { value: "false", label: "Not required" },
];

const statusOptions = [
  { value: "", label: "Any status" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "waiting_on_customer", label: "Waiting on customer" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
];

const priorityOptions = [
  { value: "", label: "Any priority" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const deliveryOptions = [
  { value: "", label: "Any delivery" },
  { value: "pending", label: "Pending" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
  { value: "abandoned", label: "Abandoned" },
];

function setManagedParams(filters: ConversationFilterState) {
  return conversationFiltersToSearchParams(filters).toString();
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

export function ConversationFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  const filters = useMemo(
    () => parseConversationFilters(new URLSearchParams(search)),
    [search]
  );

  useEffect(() => {
    const current = new URLSearchParams(search);
    if (hasConversationFilterParams(current)) {
      sessionStorage.setItem(
        CONVERSATION_FILTER_STORAGE_KEY,
        conversationFiltersToStorage(parseConversationFilters(current))
      );
      return;
    }

    const stored = parseStoredConversationFilters(
      sessionStorage.getItem(CONVERSATION_FILTER_STORAGE_KEY)
    );
    const storedQuery = setManagedParams(stored);
    if (storedQuery) {
      router.replace(`/dashboard/conversations?${storedQuery}`);
    }
  }, [router, search]);

  function updateFilter(key: ConversationFilterParamKey, value: string) {
    const next: ConversationFilterState = { ...filters };
    if (value) {
      next[key] = value as ConversationFilterState[typeof key];
    } else {
      delete next[key];
    }

    const query = setManagedParams(next);
    sessionStorage.setItem(
      CONVERSATION_FILTER_STORAGE_KEY,
      conversationFiltersToStorage(next)
    );
    router.push(`/dashboard/conversations${query ? `?${query}` : ""}`);
  }

  function clearFilters() {
    sessionStorage.removeItem(CONVERSATION_FILTER_STORAGE_KEY);
    router.push("/dashboard/conversations");
  }

  return (
    <div className="mt-4 w-full border-t border-slate-200 pt-4 sm:mt-0 sm:border-t-0 sm:pt-0">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <FilterShell label="Case type">
          <select
            value={filters["case-type"] ?? ""}
            onChange={(event) => updateFilter("case-type", event.target.value)}
            className={SELECT_CLASS}
          >
            {caseTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FilterShell>

        <FilterShell label="Follow-up">
          <select
            value={filters["follow-up"] ?? ""}
            onChange={(event) => updateFilter("follow-up", event.target.value)}
            className={SELECT_CLASS}
          >
            {followUpOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FilterShell>

        <FilterShell label="Status">
          <select
            value={filters.status ?? ""}
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

        <FilterShell label="Priority">
          <select
            value={filters.priority ?? ""}
            onChange={(event) => updateFilter("priority", event.target.value)}
            className={SELECT_CLASS}
          >
            {priorityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FilterShell>

        <FilterShell label="Owner">
          <input
            value={filters.assigned ?? ""}
            onChange={(event) => updateFilter("assigned", event.target.value)}
            className={INPUT_CLASS}
            placeholder="User ID or unassigned"
          />
        </FilterShell>

        <FilterShell label="Routing key">
          <input
            value={filters.routing ?? ""}
            onChange={(event) => updateFilter("routing", event.target.value)}
            className={INPUT_CLASS}
            placeholder="Any routing key"
          />
        </FilterShell>

        <FilterShell label="Matched rule">
          <input
            value={filters.rule ?? ""}
            onChange={(event) => updateFilter("rule", event.target.value)}
            className={INPUT_CLASS}
            placeholder="Any rule"
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

        <FilterShell label="Marketplace side">
          <input
            value={filters["mkt-side"] ?? ""}
            onChange={(event) => updateFilter("mkt-side", event.target.value)}
            className={INPUT_CLASS}
            placeholder="Any side"
          />
        </FilterShell>

        <FilterShell label="Topic">
          <input
            value={filters.topic ?? ""}
            onChange={(event) => updateFilter("topic", event.target.value)}
            className={INPUT_CLASS}
            placeholder="Any topic"
          />
        </FilterShell>

        <FilterShell label="Connector destination">
          <input
            value={filters.dest ?? ""}
            onChange={(event) => updateFilter("dest", event.target.value)}
            className={INPUT_CLASS}
            placeholder="Any destination"
          />
        </FilterShell>

        <FilterShell label="Delivery state">
          <select
            value={filters.delivery ?? ""}
            onChange={(event) => updateFilter("delivery", event.target.value)}
            className={SELECT_CLASS}
          >
            {deliveryOptions.map((option) => (
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
