export const CONVERSATION_FILTER_STORAGE_KEY = "convo:conversations:filters";

export const CONVERSATION_FILTER_PARAM_KEYS = [
  "case-type",
  "follow-up",
  "status",
  "priority",
  "assigned",
  "routing",
  "rule",
  "persona",
  "mkt-side",
  "topic",
  "dest",
  "delivery",
  "from",
  "to",
] as const;

export type ConversationFilterParamKey =
  (typeof CONVERSATION_FILTER_PARAM_KEYS)[number];

export interface ConversationFilterState {
  "case-type"?: string;
  "follow-up"?: string;
  status?: string;
  priority?: string;
  assigned?: string;
  routing?: string;
  rule?: string;
  persona?: string;
  "mkt-side"?: string;
  topic?: string;
  dest?: string;
  delivery?: string;
  from?: string;
  to?: string;
}

export function parseConversationFilters(
  params: URLSearchParams
): ConversationFilterState {
  const filters: ConversationFilterState = {};
  for (const key of CONVERSATION_FILTER_PARAM_KEYS) {
    const raw = params.get(key);
    if (!raw) continue;
    if (key === "follow-up" && raw !== "true" && raw !== "false") continue;
    filters[key] = raw.trim();
  }
  return filters;
}

export function conversationFiltersToSearchParams(
  filters: ConversationFilterState
): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of CONVERSATION_FILTER_PARAM_KEYS) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  return params;
}

export function hasConversationFilterParams(params: URLSearchParams): boolean {
  return CONVERSATION_FILTER_PARAM_KEYS.some((key) => params.has(key));
}

export function serialiseConversationFilters(
  filters: ConversationFilterState
): string {
  return conversationFiltersToSearchParams(filters).toString();
}

export function parseStoredConversationFilters(
  stored: string | null
): ConversationFilterState {
  if (!stored) return {};
  try {
    const parsed = JSON.parse(stored) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const source = parsed as Record<string, unknown>;
    const filters: ConversationFilterState = {};
    for (const key of CONVERSATION_FILTER_PARAM_KEYS) {
      const value = source[key];
      if (typeof value === "string" && value.trim()) {
        if (key === "follow-up" && value !== "true" && value !== "false") {
          continue;
        }
        filters[key] = value.trim();
      }
    }
    return filters;
  } catch {
    return {};
  }
}

export function conversationFiltersToStorage(
  filters: ConversationFilterState
): string {
  const clean: ConversationFilterState = {};
  for (const key of CONVERSATION_FILTER_PARAM_KEYS) {
    const value = filters[key];
    if (value) clean[key] = value;
  }
  return JSON.stringify(clean);
}
