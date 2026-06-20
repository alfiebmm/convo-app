import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentTenant } from "@/lib/auth-context";
import { getContactDetailById, type ContactDetailRow } from "@/lib/contacts";
import {
  ContactCaseHistory,
  ContactIdentifierReveal,
} from "./contact-detail-controls";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  open: "bg-green-100 text-green-800",
  in_progress: "bg-blue-100 text-blue-800",
  waiting_on_customer: "bg-amber-100 text-amber-800",
  resolved: "bg-emerald-100 text-emerald-800",
  dismissed: "bg-slate-100 text-slate-800",
  pending: "bg-amber-100 text-amber-800",
  sent: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
  abandoned: "bg-slate-100 text-slate-800",
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

function formatDay(date: Date) {
  return new Date(date).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatJsonValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "None";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
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

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function groupEventsByDay(detail: ContactDetailRow) {
  const groups = new Map<string, typeof detail.events>();
  for (const event of detail.events) {
    const key = formatDay(event.createdAt);
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  return Array.from(groups.entries());
}

function AttributeValue({ value }: { value: unknown }) {
  const rendered = formatJsonValue(value);
  const isStructured = typeof value === "object" && value !== null;

  return isStructured ? (
    <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-700">
      {rendered}
    </pre>
  ) : (
    <dd className="mt-1 break-words text-sm text-slate-800">{rendered}</dd>
  );
}

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ contactId: string }>;
}) {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const { contactId } = await params;
  const detail = await getContactDetailById(tenant.id, contactId);
  if (!detail) notFound();

  const contact = detail.contact;
  const title = contact.displayName ?? "No name";
  const attributes = Object.entries(contact.attributes).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const consentCapturedAt = contact.firstSeenAt;

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            href="/dashboard/contacts"
            className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
          >
            Back to contacts
          </Link>
          <h1 className="mt-3 break-words text-2xl font-bold text-slate-900">
            {title}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Person profile across identifiers, conversations, cases, connectors,
            consent, and audit events.
          </p>
        </div>
        <div className="text-sm text-slate-500 sm:text-right">
          <p>First seen {formatDateTime(contact.firstSeenAt)}</p>
          <p>Last seen {formatDateTime(contact.lastSeenAt)}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <div className="space-y-6">
          <Section title="Identifiers">
            {detail.identifiers.length === 0 ? (
              <p className="text-sm text-slate-400">
                No contact identifiers captured.
              </p>
            ) : (
              <dl className="grid gap-2 sm:grid-cols-2">
                {detail.identifiers.map((identifier) => (
                  <ContactIdentifierReveal
                    key={identifier.id}
                    contactId={contact.id}
                    identifierId={identifier.id}
                    type={identifier.type}
                    hasValue={Boolean(identifier.valueNormalised)}
                  />
                ))}
              </dl>
            )}
          </Section>

          <Section title="Merged attributes">
            {attributes.length === 0 ? (
              <p className="text-sm text-slate-400">
                No merged attributes captured.
              </p>
            ) : (
              <dl className="grid gap-2 sm:grid-cols-2">
                {attributes.map(([key, value]) => (
                  <div
                    key={key}
                    className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <dt className="text-xs font-medium text-slate-500">
                      {formatLabel(key)}
                    </dt>
                    <AttributeValue value={value} />
                  </div>
                ))}
              </dl>
            )}
          </Section>

          <Section title="Conversation history">
            {detail.conversations.length === 0 ? (
              <p className="text-sm text-slate-400">
                No linked conversations for this contact.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 rounded-md border border-slate-200">
                {detail.conversations.map((conversation) => (
                  <Link
                    key={conversation.id}
                    href={
                      conversation.caseId
                        ? `/dashboard/conversations?case=${conversation.caseId}`
                        : "/dashboard/conversations"
                    }
                    className="block px-3 py-3 transition-colors hover:bg-slate-50"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-medium text-slate-900">
                          Conversation {conversation.id.slice(0, 8)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {conversation.messageCount} messages -{" "}
                          {formatDateTime(conversation.startedAt)}
                        </p>
                      </div>
                      <Pill
                        className={
                          STATUS_COLORS[conversation.caseStatus ?? conversation.status] ??
                          "bg-slate-100 text-slate-800"
                        }
                      >
                        {formatLabel(conversation.caseStatus ?? conversation.status)}
                      </Pill>
                    </div>
                    {conversation.caseType && (
                      <p className="mt-2 text-xs text-slate-500">
                        Opens {formatLabel(conversation.caseType)} case detail
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </Section>

          <Section title="Case history">
            <ContactCaseHistory cases={detail.cases} />
          </Section>

          <Section title="Audit events">
            {detail.events.length === 0 ? (
              <p className="text-sm text-slate-400">
                No activity recorded across the case history.
              </p>
            ) : (
              <div className="space-y-4">
                {groupEventsByDay(detail).map(([day, events]) => (
                  <div key={day}>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      {day}
                    </p>
                    <ol className="mt-2 space-y-2">
                      {events.map((event) => (
                        <li
                          key={event.id}
                          className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <Link
                              href={`/dashboard/conversations?case=${event.caseId}`}
                              className="font-medium text-slate-800 hover:underline"
                            >
                              {formatLabel(event.eventType)}
                            </Link>
                            <span className="text-xs text-slate-500">
                              {formatDateTime(event.createdAt)}
                            </span>
                          </div>
                          {Object.keys(event.payload).length > 0 && (
                            <pre className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-500">
                              {formatJsonValue(event.payload)}
                            </pre>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Consent state">
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="text-xs font-medium text-slate-500">State</dt>
                <dd className="mt-1 text-slate-800">
                  {formatLabel(contact.consentState)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">
                  Privacy notice version
                </dt>
                <dd className="mt-1 text-slate-800">
                  {contact.privacyNoticeVersion ?? "Not recorded"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">
                  Captured at
                </dt>
                <dd className="mt-1 text-slate-800">
                  {formatDateTime(consentCapturedAt)}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-slate-500">
              Captured at uses first seen because the contact schema stores
              consent state and privacy version without a separate consent
              timestamp.
            </p>
          </Section>

          <Section title="Connector records">
            {detail.connectors.length === 0 ? (
              <p className="text-sm text-slate-400">
                No connector records for this contact.
              </p>
            ) : (
              <div className="space-y-2">
                {detail.connectors.map((connector) => (
                  <Link
                    key={connector.connectorType}
                    href={`/dashboard/conversations?case=${connector.caseId}`}
                    className="block rounded-md border border-slate-200 px-3 py-2 text-sm transition-colors hover:bg-slate-50"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-slate-800">
                        {formatLabel(connector.connectorType)}
                      </span>
                      <Pill
                        className={
                          STATUS_COLORS[connector.status] ??
                          "bg-slate-100 text-slate-700"
                        }
                      >
                        {formatLabel(connector.status)}
                      </Pill>
                    </div>
                    <dl className="mt-2 grid gap-2 text-xs text-slate-500">
                      <div>
                        <dt>Destination</dt>
                        <dd className="mt-0.5 text-slate-700">
                          {connector.destinationId ?? "Not recorded"}
                        </dd>
                      </div>
                      <div>
                        <dt>Attempts</dt>
                        <dd className="mt-0.5 text-slate-700">
                          {connector.attemptCount}
                        </dd>
                      </div>
                      <div>
                        <dt>Latest row</dt>
                        <dd className="mt-0.5 text-slate-700">
                          {formatDateTime(connector.createdAt)}
                        </dd>
                      </div>
                    </dl>
                    {connector.lastError && (
                      <p className="mt-2 text-xs text-rose-600">
                        {connector.lastError}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
