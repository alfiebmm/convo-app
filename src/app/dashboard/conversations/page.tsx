import ConversationList from "./conversation-list";
import CaseDetailPanel from "./case-detail-panel";
import ConversationDetailPanel from "./conversation-detail-panel";
import { ConversationFilters } from "./conversation-filters";
import { Suspense } from "react";
import {
  getCurrentTenant,
  listTenantUsersForCurrentUser,
} from "@/lib/auth-context";
import { redirect } from "next/navigation";
import {
  type ConversationFilterState,
  parseConversationFilters,
} from "./filter-state";
import {
  getCaseDetailById,
  getConversationDetailById,
  listConversationsByTenantWithOptionalCase,
  listConversationFilterOptions,
  type CaseStatus,
  type ListCasesWithActivityFilters,
} from "@/lib/cases";
import { withDashboardErrorLogging } from "@/lib/errors/wrap";

function parseDateParam(value: string | undefined, endOfDay = false) {
  if (!value) return undefined;
  const date = new Date(endOfDay ? `${value}T23:59:59.999` : `${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseAssignedFilter(value: string | undefined) {
  if (!value) return undefined;
  if (value === "unassigned") return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
    ? value
    : undefined;
}

function toCaseListFilters(
  filters: ConversationFilterState
): ListCasesWithActivityFilters {
  return {
    caseType: filters["case-type"],
    hasCase:
      filters["has-case"] === undefined
        ? undefined
        : filters["has-case"] === "yes",
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
    limit: 100,
  };
}

async function ConversationsPageImpl({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const params = await searchParams;
  const urlParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      if (value[0]) urlParams.set(key, value[0]);
    } else if (value) {
      urlParams.set(key, value);
    }
  }
  const activeFilters = parseConversationFilters(urlParams);
  const selectedCaseId = typeof params.case === "string" ? params.case : undefined;
  const selectedConversationId =
    typeof params.conversation === "string" ? params.conversation : undefined;
  const [convoData, filterOptions, tenantUsers] = await Promise.all([
    listConversationsByTenantWithOptionalCase(
      tenant.id,
      toCaseListFilters(activeFilters)
    ),
    listConversationFilterOptions(tenant.id),
    listTenantUsersForCurrentUser(tenant.id),
  ]);
  const selectedCaseDetail = selectedCaseId
    ? await getCaseDetailById(tenant.id, selectedCaseId)
    : null;
  const selectedConversationDetail =
    !selectedCaseDetail && selectedConversationId
      ? await getConversationDetailById(tenant.id, selectedConversationId)
      : null;

  return (
    <div>
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Conversations</h1>
          <p className="mt-1 text-sm text-slate-500">
            Follow-up cases raised from chatbot conversations.
          </p>
        </div>
        <Suspense>
          <ConversationFilters options={filterOptions} />
        </Suspense>
      </div>

      {convoData.length === 0 ? (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white">
          <div className="p-12 text-center text-sm text-slate-400">
            No conversations yet. Conversations will appear here once visitors
            start chatting with your widget.
          </div>
        </div>
      ) : (
        <ConversationList
          conversations={convoData}
          selectedCaseId={selectedCaseDetail?.case.id}
          selectedConversationId={selectedConversationDetail?.conversation.id}
        />
      )}

      {selectedCaseDetail && (
        <CaseDetailPanel detail={selectedCaseDetail} tenantUsers={tenantUsers} />
      )}
      {selectedConversationDetail && (
        <ConversationDetailPanel detail={selectedConversationDetail} />
      )}
    </div>
  );
}

// CON-error-logging: capture any throw from the conversations render path.
// Strong candidate site for production digest `2442540290` 
// CON-error-logging: capture any throw from the conversations render path.
// Strong candidate site for production digest 2442540290 -
// listCasesByTenantWithActivity (CON-174 store) or getCaseDetailById.
export default withDashboardErrorLogging(ConversationsPageImpl, {
  route: "/dashboard/conversations",
});
