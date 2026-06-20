import type { ContactListSort } from "@/lib/contacts";

export const CONTACT_FILTER_STORAGE_KEY = "convo:contacts:filters";

export const CONTACT_FILTER_PARAM_KEYS = [
  "q",
  "persona",
  "mkt-side",
  "case-type",
  "case-status",
  "from",
  "to",
  "page",
  "sort",
] as const;

export type ContactFilterParamKey = (typeof CONTACT_FILTER_PARAM_KEYS)[number];

const CONTACT_SORTS = new Set<ContactListSort>([
  "name-asc",
  "name-desc",
  "last-seen-desc",
  "last-seen-asc",
]);

export interface ContactFilterState {
  q?: string;
  persona?: string;
  "mkt-side"?: string;
  "case-type"?: string;
  "case-status"?: string;
  from?: string;
  to?: string;
  page?: string;
  sort?: ContactListSort;
}

function setFilterValue(
  filters: ContactFilterState,
  key: ContactFilterParamKey,
  value: string,
) {
  if (key === "sort") {
    filters.sort = value as ContactListSort;
    return;
  }
  filters[key] = value as ContactFilterState[typeof key];
}

function cleanValue(key: ContactFilterParamKey, raw: string | null) {
  if (!raw) return undefined;
  const value = raw.trim();
  if (!value) return undefined;
  if (key === "page" && !/^[1-9]\d*$/.test(value)) return undefined;
  if (key === "sort" && !CONTACT_SORTS.has(value as ContactListSort)) {
    return undefined;
  }
  return value;
}

export function parseContactFilters(
  params: URLSearchParams,
): ContactFilterState {
  const filters: ContactFilterState = {};
  for (const key of CONTACT_FILTER_PARAM_KEYS) {
    const value = cleanValue(key, params.get(key));
    if (!value) continue;
    setFilterValue(filters, key, value);
  }
  return filters;
}

export function contactFiltersToSearchParams(
  filters: ContactFilterState,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of CONTACT_FILTER_PARAM_KEYS) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  return params;
}

export function hasContactFilterParams(params: URLSearchParams): boolean {
  return CONTACT_FILTER_PARAM_KEYS.some((key) => params.has(key));
}

export function serialiseContactFilters(filters: ContactFilterState): string {
  return contactFiltersToSearchParams(filters).toString();
}

export function parseStoredContactFilters(
  stored: string | null,
): ContactFilterState {
  if (!stored) return {};
  try {
    const parsed = JSON.parse(stored) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const source = parsed as Record<string, unknown>;
    const filters: ContactFilterState = {};
    for (const key of CONTACT_FILTER_PARAM_KEYS) {
      const raw = source[key];
      const value = typeof raw === "string" ? cleanValue(key, raw) : undefined;
      if (value) setFilterValue(filters, key, value);
    }
    return filters;
  } catch {
    return {};
  }
}

export function contactFiltersToStorage(filters: ContactFilterState): string {
  const clean: ContactFilterState = {};
  for (const key of CONTACT_FILTER_PARAM_KEYS) {
    const value = filters[key];
    if (value) setFilterValue(clean, key, value);
  }
  return JSON.stringify(clean);
}
