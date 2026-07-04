"use client";

import type { ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { CaseListItemRow, ConversationListItemRow } from "@/lib/cases";

const STATUS_COLORS: Record<string, string> = {
  open: "bg-green-100 text-green-800",
  in_progress: "bg-blue-100 text-blue-800",
  waiting_on_customer: "bg-amber-100 text-amber-800",
  resolved: "bg-emerald-100 text-emerald-800",
  dismissed: "bg-slate-100 text-slate-800",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-blue-100 text-blue-800",
  high: "bg-amber-100 text-amber-800",
  urgent: "bg-red-100 text-red-800",
};

function formatLabel(value: string | null) {
  if (!value) return "None";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncateReason(reason: string | null) {
  if (!reason) return "No reason captured";
  return reason.length > 80 ? `${reason.slice(0, 80).trimEnd()}...` : reason;
}

function isFollowUpRequired(kase: CaseListItemRow | null) {
  return Boolean(
    kase && kase.status !== "resolved" && kase.status !== "dismissed"
  );
}

function Pill({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

function ConnectorState({ conversation }: { conversation: CaseListItemRow }) {
  if (!conversation.latestConnectorType || !conversation.latestConnectorStatus) {
    return <span className="text-slate-400">No connector</span>;
  }

  return (
    <span className="text-slate-700">
      {formatLabel(conversation.latestConnectorType)} -{" "}
      {formatLabel(conversation.latestConnectorStatus)}
    </span>
  );
}

export function getConversationListItemDisplay(row: ConversationListItemRow) {
  const kase = row.case;
  return {
    followUpRequired: isFollowUpRequired(kase),
    caseType: kase ? formatLabel(kase.caseType) : "—",
    status: kase ? formatLabel(kase.status) : "No case",
    priority: kase ? formatLabel(kase.priority) : "—",
    reason: kase ? truncateReason(kase.reason) : "Conversation only",
    contact: kase ? kase.contactDisplayName ?? "No contact" : "—",
    owner: kase ? kase.assignedOwnerName ?? "Unassigned" : "—",
  };
}

export default function ConversationList({
  conversations,
  selectedCaseId,
  selectedConversationId,
}: {
  conversations: ConversationListItemRow[];
  selectedCaseId?: string;
  selectedConversationId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function openCase(caseId: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("case", caseId);
    next.delete("conversation");
    router.push(`/dashboard/conversations?${next.toString()}`);
  }

  function openConversation(conversationId: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("conversation", conversationId);
    next.delete("case");
    router.push(`/dashboard/conversations?${next.toString()}`);
  }

  function openRow(row: ConversationListItemRow) {
    if (row.case) {
      openCase(row.case.id);
      return;
    }
    openConversation(row.conversation.id);
  }

  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="divide-y divide-slate-100 md:hidden">
        {conversations.map((row) => {
          const kase = row.case;
          const display = getConversationListItemDisplay(row);
          const isSelected = kase
            ? selectedCaseId === kase.id
            : selectedConversationId === row.conversation.id;
          return (
            <button
              key={row.conversation.id}
              type="button"
              onClick={() => openRow(row)}
              className={`block w-full px-4 py-4 text-left transition-colors hover:bg-slate-50 ${
                isSelected ? "bg-slate-50" : ""
              }`}
            >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill
                    className={
                      display.followUpRequired
                        ? "bg-amber-100 text-amber-800"
                        : "bg-slate-100 text-slate-700"
                    }
                  >
                    {display.followUpRequired ? "Required" : "No follow-up"}
                  </Pill>
                  <Pill
                    className={
                      kase
                        ? STATUS_COLORS[kase.status] ??
                          "bg-slate-100 text-slate-800"
                        : "bg-slate-100 text-slate-700"
                    }
                  >
                    {display.status}
                  </Pill>
                </div>
                <p className="mt-2 text-sm font-medium text-slate-900">
                  {display.contact}
                </p>
                <p
                  className="mt-1 text-sm text-slate-500"
                  title={kase?.reason ?? undefined}
                >
                  {display.reason}
                </p>
              </div>
              <span className="shrink-0 text-right text-xs text-slate-400">
                {formatDate(row.conversation.lastActivityAt)}
              </span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-slate-400">Type</dt>
                <dd className="mt-0.5 text-slate-700">
                  {display.caseType}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Priority</dt>
                <dd className="mt-0.5 text-slate-700">
                  {display.priority}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Owner</dt>
                <dd className="mt-0.5 text-slate-700">
                  {display.owner}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Connector</dt>
                <dd className="mt-0.5">
                  {kase ? (
                    <ConnectorState conversation={kase} />
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </dd>
              </div>
            </dl>
            </button>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-[1180px] divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Follow-up required</th>
              <th className="px-4 py-3">Case type</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">External sync</th>
              <th className="px-4 py-3">Last activity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {conversations.map((row) => {
              const kase = row.case;
              const display = getConversationListItemDisplay(row);
              const isSelected = kase
                ? selectedCaseId === kase.id
                : selectedConversationId === row.conversation.id;
              return (
                <tr
                  key={row.conversation.id}
                  onClick={() => openRow(row)}
                  className={`cursor-pointer transition-colors hover:bg-slate-50 ${
                    isSelected ? "bg-slate-50" : ""
                  }`}
                >
                <td className="px-4 py-3">
                  <Pill
                    className={
                      display.followUpRequired
                        ? "bg-amber-100 text-amber-800"
                        : "bg-slate-100 text-slate-700"
                    }
                  >
                    {display.followUpRequired ? "Yes" : "No"}
                  </Pill>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {display.caseType}
                </td>
                <td className="px-4 py-3">
                  {kase?.priority ? (
                    <Pill
                      className={
                        PRIORITY_COLORS[kase.priority] ??
                        "bg-slate-100 text-slate-700"
                      }
                    >
                      {formatLabel(kase.priority)}
                    </Pill>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Pill
                    className={
                      kase
                        ? STATUS_COLORS[kase.status] ??
                          "bg-slate-100 text-slate-800"
                        : "bg-slate-100 text-slate-700"
                    }
                  >
                    {display.status}
                  </Pill>
                </td>
                <td
                  className="max-w-[260px] px-4 py-3 text-slate-600"
                  title={kase?.reason ?? undefined}
                >
                  <span className="block truncate">
                    {display.reason}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {display.contact}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {display.owner}
                </td>
                <td className="px-4 py-3">
                  {kase ? (
                    <ConnectorState conversation={kase} />
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                  {formatDate(row.conversation.lastActivityAt)}
                </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
