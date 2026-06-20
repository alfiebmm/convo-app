"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import type { ContactCaseHistoryRow } from "@/lib/contacts";
import { revealContactIdentifier } from "../actions";

const STATUS_COLORS: Record<string, string> = {
  open: "bg-green-100 text-green-800",
  in_progress: "bg-blue-100 text-blue-800",
  waiting_on_customer: "bg-amber-100 text-amber-800",
  resolved: "bg-emerald-100 text-emerald-800",
  dismissed: "bg-slate-100 text-slate-800",
};

function formatLabel(value: string | null | undefined) {
  if (!value) return "None";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDateTime(date: Date | null | undefined) {
  if (!date) return "Not recorded";
  return new Date(date).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

export function ContactIdentifierReveal({
  contactId,
  identifierId,
  type,
  hasValue,
}: {
  contactId: string;
  identifierId: string;
  type: string;
  hasValue: boolean;
}) {
  const [value, setValue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reveal() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await revealContactIdentifier(contactId, identifierId);
        setValue(result.value ?? "Not captured");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Reveal failed");
      }
    });
  }

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <dt className="text-xs font-medium text-slate-500">
        {formatLabel(type)}
      </dt>
      <dd className="mt-1 flex min-h-7 items-center justify-between gap-3 text-sm text-slate-800">
        <span className="break-all">
          {value ?? (hasValue ? "Hidden" : "Not captured")}
        </span>
        {hasValue && value === null && (
          <button
            type="button"
            onClick={reveal}
            disabled={isPending}
            className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
          >
            {isPending ? "Revealing" : "Reveal"}
          </button>
        )}
      </dd>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

export function ContactCaseHistory({ cases }: { cases: ContactCaseHistoryRow[] }) {
  const [caseType, setCaseType] = useState("all");
  const [status, setStatus] = useState("all");
  const caseTypes = useMemo(
    () => Array.from(new Set(cases.map((item) => item.caseType))).sort(),
    [cases],
  );
  const statuses = useMemo(
    () => Array.from(new Set(cases.map((item) => item.status))).sort(),
    [cases],
  );
  const filtered = cases.filter(
    (item) =>
      (caseType === "all" || item.caseType === caseType) &&
      (status === "all" || item.status === status),
  );

  if (cases.length === 0) {
    return <p className="text-sm text-slate-400">No cases for this contact.</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <FilterButton active={caseType === "all"} onClick={() => setCaseType("all")}>
          All types
        </FilterButton>
        {caseTypes.map((type) => (
          <FilterButton
            key={type}
            active={caseType === type}
            onClick={() => setCaseType(type)}
          >
            {formatLabel(type)}
          </FilterButton>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <FilterButton active={status === "all"} onClick={() => setStatus("all")}>
          All statuses
        </FilterButton>
        {statuses.map((item) => (
          <FilterButton
            key={item}
            active={status === item}
            onClick={() => setStatus(item)}
          >
            {formatLabel(item)}
          </FilterButton>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">
          No cases match those filters.
        </p>
      ) : (
        <div className="mt-4 divide-y divide-slate-100 rounded-md border border-slate-200">
          {filtered.map((item) => (
            <Link
              key={item.id}
              href={`/dashboard/conversations?case=${item.id}`}
              className="block px-3 py-3 transition-colors hover:bg-slate-50"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium text-slate-900">
                    {item.title ?? `${formatLabel(item.caseType)} case`}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Updated {formatDateTime(item.updatedAt)}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    STATUS_COLORS[item.status] ?? "bg-slate-100 text-slate-800"
                  }`}
                >
                  {formatLabel(item.status)}
                </span>
              </div>
              {item.summary && (
                <p className="mt-2 text-sm text-slate-600">{item.summary}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
