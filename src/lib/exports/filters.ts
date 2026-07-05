import {
  parseConversationFilters,
  type ConversationFilterState,
} from "@/app/dashboard/conversations/filter-state";
import {
  parseContactFilters,
  type ContactFilterState,
} from "@/app/dashboard/contacts/filter-state";
import type {
  CaseStatus,
  ListCasesWithActivityFilters,
} from "@/lib/cases";
import type {
  ContactListSort,
  ListContactsByTenantFilters,
} from "@/lib/contacts";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

function parseDateParam(value: string | undefined, endOfDay = false) {
  if (!value) return undefined;
  const date = new Date(
    endOfDay ? `${value}T23:59:59.999` : `${value}T00:00:00`,
  );
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseAssignedFilter(value: string | undefined) {
  if (!value) return undefined;
  if (value === "unassigned") return null;
  return UUID_RE.test(value) ? value : undefined;
}

function parsePage(value: string | undefined) {
  if (!value || !/^[1-9]\d*$/.test(value)) return 1;
  return Math.max(1, Number(value));
}

export function parseCaseExportFilters(
  params: URLSearchParams,
): ListCasesWithActivityFilters {
  const filters: ConversationFilterState = parseConversationFilters(params);
  return {
    caseType: filters["case-type"],
    followUpRequired:
      filters["follow-up"] === undefined
        ? undefined
        : filters["follow-up"] === "true",
    status: filters.status as CaseStatus | undefined,
    priority: filters.priority,
    assignedTo: parseAssignedFilter(filters.assigned),
    routingKey: filters.routing,
    ruleId: filters.rule,
    persona: filters.persona,
    topic: filters.topic,
    connectorDestination: filters.dest,
    connectorDeliveryState: filters.delivery,
    from: parseDateParam(filters.from),
    to: parseDateParam(filters.to, true),
    limit: 1000,
  };
}

export function parseContactExportFilters(
  params: URLSearchParams,
): ListContactsByTenantFilters {
  const filters: ContactFilterState = parseContactFilters(params);
  return {
    q: filters.q,
    persona: filters.persona,
    caseType: filters["case-type"],
    caseStatus: filters["case-status"],
    from: parseDateParam(filters.from),
    to: parseDateParam(filters.to, true),
    page: parsePage(filters.page),
    sort: (filters.sort ?? "last-seen-desc") as ContactListSort,
  };
}
