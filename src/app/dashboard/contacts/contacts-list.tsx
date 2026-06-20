"use client";

import type { ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ContactListItemRow, ContactListSort } from "@/lib/contacts";

const STATUS_COLORS: Record<string, string> = {
  open: "bg-green-100 text-green-800",
  in_progress: "bg-blue-100 text-blue-800",
  waiting_on_customer: "bg-amber-100 text-amber-800",
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

function ContactName({ contact }: { contact: ContactListItemRow }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-medium text-slate-900">
        {contact.displayName ?? "No name"}
      </p>
      <p className="mt-1 truncate text-xs text-slate-500">
        {contact.emailNormalised ??
          contact.phoneNormalised ??
          "No contact details"}
      </p>
    </div>
  );
}

function CaseState({ contact }: { contact: ContactListItemRow }) {
  if (!contact.relatedCaseType || !contact.openCaseStatus) {
    return <span className="text-slate-400">No open case</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-slate-700">
        {formatLabel(contact.relatedCaseType)}
      </span>
      <Pill
        className={
          STATUS_COLORS[contact.openCaseStatus] ?? "bg-slate-100 text-slate-800"
        }
      >
        {formatLabel(contact.openCaseStatus)}
      </Pill>
    </div>
  );
}

function nextSort(currentSort: ContactListSort, field: "name" | "last-seen") {
  if (field === "name") {
    return currentSort === "name-asc" ? "name-desc" : "name-asc";
  }
  return currentSort === "last-seen-desc" ? "last-seen-asc" : "last-seen-desc";
}

export default function ContactsList({
  contacts,
  totalCount,
  page,
  sort,
}: {
  contacts: ContactListItemRow[];
  totalCount: number;
  page: number;
  sort: ContactListSort;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(totalCount / 50));

  function pushWithParams(next: URLSearchParams) {
    const query = next.toString();
    router.push(`/dashboard/contacts${query ? `?${query}` : ""}`);
  }

  function openContact(contactId: string) {
    router.push(`/dashboard/contacts/${contactId}`);
  }

  function updateSort(field: "name" | "last-seen") {
    const next = new URLSearchParams(searchParams.toString());
    next.set("sort", nextSort(sort, field));
    next.delete("page");
    pushWithParams(next);
  }

  function updatePage(nextPage: number) {
    const next = new URLSearchParams(searchParams.toString());
    if (nextPage <= 1) {
      next.delete("page");
    } else {
      next.set("page", String(nextPage));
    }
    pushWithParams(next);
  }

  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="divide-y divide-slate-100 md:hidden">
        {contacts.map((contact) => (
          <button
            key={contact.id}
            type="button"
            onClick={() => openContact(contact.id)}
            className="block w-full px-4 py-4 text-left transition-colors hover:bg-slate-50"
          >
            <div className="flex items-start justify-between gap-3">
              <ContactName contact={contact} />
              <span className="shrink-0 text-right text-xs text-slate-400">
                {formatDate(contact.lastSeenAt)}
              </span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-slate-400">Company</dt>
                <dd className="mt-0.5 text-slate-700">
                  {contact.company ?? "None"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Location</dt>
                <dd className="mt-0.5 text-slate-700">
                  {contact.location ?? "None"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Persona</dt>
                <dd className="mt-0.5 text-slate-700">
                  {contact.persona ?? "None"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Case</dt>
                <dd className="mt-0.5">
                  <CaseState contact={contact} />
                </dd>
              </div>
            </dl>
          </button>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-[1180px] divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => updateSort("name")}
                  className="font-medium uppercase tracking-wide text-slate-500 hover:text-slate-900"
                >
                  Name
                </button>
              </th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Persona</th>
              <th className="px-4 py-3">Marketplace side</th>
              <th className="px-4 py-3">Service or product</th>
              <th className="px-4 py-3">Related case</th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => updateSort("last-seen")}
                  className="font-medium uppercase tracking-wide text-slate-500 hover:text-slate-900"
                >
                  Last seen
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {contacts.map((contact) => (
              <tr
                key={contact.id}
                onClick={() => openContact(contact.id)}
                className="cursor-pointer transition-colors hover:bg-slate-50"
              >
                <td className="px-4 py-3">
                  <ContactName contact={contact} />
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {contact.emailNormalised ?? "None"}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {contact.phoneNormalised ?? "None"}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {contact.company ?? "None"}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {contact.location ?? "None"}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {contact.persona ?? "None"}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {contact.marketplaceSide ?? "None"}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {contact.serviceOrProduct ?? "None"}
                </td>
                <td className="px-4 py-3">
                  <CaseState contact={contact} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                  {formatDate(contact.lastSeenAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <span>
          Page {page} of {totalPages} - {totalCount} contacts
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => updatePage(page - 1)}
            className="rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => updatePage(page + 1)}
            className="rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
