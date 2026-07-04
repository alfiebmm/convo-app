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

/**
 * Distinct-value option lists surfaced to the filter dropdowns. Populated
 * from `listConversationFilterOptions` on the server and passed in from
 * the page (Bug 1, 3 Jul 2026 — Cam).
 */
export interface ConversationFilterOptions {
  routingKeys: string[];
  ruleIds: string[];
  personas: string[];
  marketplaceSides: string[];
  topics: string[];
  connectorDestinations: string[];
}

const EMPTY_OPTIONS: ConversationFilterOptions = {
  routingKeys: [],
  ruleIds: [],
  personas: [],
  marketplaceSides: [],
  topics: [],
  connectorDestinations: [],
};

/**
 * Render a labelled `<select>` populated from a distinct-value list.
 * Includes a stable "Any…" default option. When the currently-selected
 * filter value exists but is NOT in the option list (e.g. an old URL
 * pointing at a value that no longer matches any case), we still render
 * it so the user isn't silently robbed of the filter — it appears with
 * a "(no matches)" suffix.
 */
function OptionSelect({
  value,
  options,
  onChange,
  anyLabel,
}: {
  value: string;
  options: string[];
  onChange: (next: string) => void;
  anyLabel: string;
}) {
  const hasStaleValue = value.length > 0 && !options.includes(value);
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={SELECT_CLASS}
    >
      <option value="">{anyLabel}</option>
      {hasStaleValue ? (
        <option value={value}>{`${value} (no matches)`}</option>
      ) : null}
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function shouldRenderFilter(options: string[], value: string | undefined) {
  return options.length > 0 || Boolean(value);
}

const caseTypeOptions = [
  { value: "", label: "Any type" },
  { value: "cx_support", label: "CX support" },
  { value: "lead", label: "Lead" },
];

const hasCaseOptions = [
  { value: "", label: "Any" },
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
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

export function ConversationFilters({
  options = EMPTY_OPTIONS,
}: {
  options?: ConversationFilterOptions;
} = {}) {
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

        <FilterShell label="Has case">
          <select
            value={filters["has-case"] ?? ""}
            onChange={(event) => updateFilter("has-case", event.target.value)}
            className={SELECT_CLASS}
          >
            {hasCaseOptions.map((option) => (
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

        {shouldRenderFilter(options.routingKeys, filters.routing) ? (
          <FilterShell label="Routing key">
            <OptionSelect
              value={filters.routing ?? ""}
              options={options.routingKeys}
              onChange={(next) => updateFilter("routing", next)}
              anyLabel="Any routing key"
            />
          </FilterShell>
        ) : null}

        {shouldRenderFilter(options.ruleIds, filters.rule) ? (
          <FilterShell label="Matched rule">
            <OptionSelect
              value={filters.rule ?? ""}
              options={options.ruleIds}
              onChange={(next) => updateFilter("rule", next)}
              anyLabel="Any rule"
            />
          </FilterShell>
        ) : null}

        {shouldRenderFilter(options.personas, filters.persona) ? (
          <FilterShell label="Persona">
            <OptionSelect
              value={filters.persona ?? ""}
              options={options.personas}
              onChange={(next) => updateFilter("persona", next)}
              anyLabel="Any persona"
            />
          </FilterShell>
        ) : null}

        {shouldRenderFilter(options.marketplaceSides, filters["mkt-side"]) ? (
          <FilterShell label="Marketplace side">
            <OptionSelect
              value={filters["mkt-side"] ?? ""}
              options={options.marketplaceSides}
              onChange={(next) => updateFilter("mkt-side", next)}
              anyLabel="Any side"
            />
          </FilterShell>
        ) : null}

        {shouldRenderFilter(options.topics, filters.topic) ? (
          <FilterShell label="Topic">
            <OptionSelect
              value={filters.topic ?? ""}
              options={options.topics}
              onChange={(next) => updateFilter("topic", next)}
              anyLabel="Any topic"
            />
          </FilterShell>
        ) : null}

        {shouldRenderFilter(options.connectorDestinations, filters.dest) ? (
          <FilterShell label="Connector destination">
            <OptionSelect
              value={filters.dest ?? ""}
              options={options.connectorDestinations}
              onChange={(next) => updateFilter("dest", next)}
              anyLabel="Any destination"
            />
          </FilterShell>
        ) : null}

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
