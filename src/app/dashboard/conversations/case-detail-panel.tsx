import type { ReactNode } from "react";
import type { CaseDetail } from "@/lib/cases";
import { ConversationTranscript } from "./conversation-transcript";
import { CasePanelCloseButton, PiiRevealField } from "./case-detail-controls";

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
  return JSON.stringify(value);
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
    <section className="border-t border-slate-200 px-5 py-5">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function groupEventsByDay(detail: CaseDetail) {
  const groups = new Map<string, typeof detail.events>();
  for (const event of detail.events) {
    const key = formatDay(event.createdAt);
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  return Array.from(groups.entries());
}

export default function CaseDetailPanel({ detail }: { detail: CaseDetail }) {
  const kase = detail.case;
  const title =
    kase.title ??
    detail.contact?.displayName ??
    `${formatLabel(kase.caseType)} case`;
  const contact = detail.contact;
  const hasNotes = detail.events.some((event) =>
    event.eventType.toLowerCase().includes("note")
  );
  const noteEvents = detail.events.filter((event) =>
    event.eventType.toLowerCase().includes("note")
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35">
      <aside className="flex h-full w-full flex-col bg-white shadow-xl md:max-w-3xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Case detail
            </p>
            <h2 className="mt-1 break-words text-xl font-semibold text-slate-900">
              {title}
            </h2>
          </div>
          <CasePanelCloseButton />
        </div>

        <div className="overflow-y-auto">
          <Section title="Case summary">
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-slate-500">Type</p>
                <p className="mt-1 text-slate-800">{formatLabel(kase.caseType)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Status</p>
                <div className="mt-1">
                  <Pill
                    className={
                      STATUS_COLORS[kase.status] ?? "bg-slate-100 text-slate-800"
                    }
                  >
                    {formatLabel(kase.status)}
                  </Pill>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Priority</p>
                <div className="mt-1">
                  <Pill
                    className={
                      PRIORITY_COLORS[kase.priority ?? ""] ??
                      "bg-slate-100 text-slate-700"
                    }
                  >
                    {formatLabel(kase.priority)}
                  </Pill>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Created</p>
                <p className="mt-1 text-slate-800">
                  {formatDateTime(kase.createdAt)}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs font-medium text-slate-500">Reason</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-800">
                  {kase.reason ?? "No reason captured"}
                </p>
              </div>
            </div>
          </Section>

          <Section title="Why flagged">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-slate-500">
                  Matched rule
                </dt>
                <dd className="mt-1 text-slate-800">
                  {kase.ruleId ?? "No rule recorded"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">
                  Classifier confidence
                </dt>
                <dd className="mt-1 text-slate-800">
                  {kase.classifierConfidence === null
                    ? "Not recorded"
                    : `${Math.round(kase.classifierConfidence * 100)}%`}
                </dd>
              </div>
            </dl>
          </Section>

          <Section title="Detected attributes">
            {detail.attributes.length === 0 ? (
              <p className="text-sm text-slate-400">No attributes detected.</p>
            ) : (
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                {detail.attributes.map((attribute) => (
                  <div
                    key={attribute.key}
                    className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <dt className="text-xs font-medium text-slate-500">
                      {formatLabel(attribute.key)}
                    </dt>
                    <dd className="mt-1 break-words text-slate-800">
                      {formatJsonValue(attribute.value)}
                    </dd>
                    <dd className="mt-1 text-xs text-slate-500">
                      {attribute.source ?? "Unknown source"}
                      {attribute.confidence === null
                        ? ""
                        : ` - ${Math.round(attribute.confidence * 100)}%`}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </Section>

          <Section title="Captured contact details">
            <dl className="grid gap-2 sm:grid-cols-3">
              <PiiRevealField
                caseId={kase.id}
                field="displayName"
                label="Name"
                hasValue={Boolean(contact?.displayName)}
              />
              <PiiRevealField
                caseId={kase.id}
                field="emailNormalised"
                label="Email"
                hasValue={Boolean(contact?.emailNormalised)}
              />
              <PiiRevealField
                caseId={kase.id}
                field="phoneNormalised"
                label="Phone"
                hasValue={Boolean(contact?.phoneNormalised)}
              />
            </dl>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-slate-500">
                  Preferred method
                </dt>
                <dd className="mt-1 text-slate-800">
                  {formatLabel(contact?.preferredContactMethod)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">
                  Consent state
                </dt>
                <dd className="mt-1 text-slate-800">
                  {formatLabel(contact?.consentState)}
                </dd>
              </div>
            </dl>
          </Section>

          <Section title="Privacy notice shown">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-slate-500">Version</dt>
                <dd className="mt-1 text-slate-800">
                  {contact?.privacyNoticeVersion ?? "Not recorded"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">
                  Timestamp
                </dt>
                <dd className="mt-1 text-slate-800">
                  {formatDateTime(contact?.privacyNoticeRecordedAt)}
                </dd>
              </div>
            </dl>
          </Section>

          <Section title="Full transcript">
            <ConversationTranscript messages={detail.messages} />
          </Section>

          <Section title="Internal links offered">
            {detail.internalLinks.length === 0 ? (
              <p className="text-sm text-slate-400">
                No internal CTA link was resolved for the latest assistant turn.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {detail.internalLinks.map((link) => (
                  <li
                    key={`${link.tag}:${link.url}`}
                    className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <a
                      href={link.url}
                      className="font-medium text-slate-900 underline underline-offset-2"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {link.text}
                    </a>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatLabel(link.tag)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Internal notes">
            {!hasNotes ? (
              <p className="text-sm text-slate-400">
                No internal notes yet. Notes ship in CON-177.
              </p>
            ) : (
              <ul className="space-y-2 text-sm text-slate-700">
                {noteEvents.map((event) => (
                  <li
                    key={event.id}
                    className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <p>{formatJsonValue(event.payload)}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDateTime(event.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Assignment">
            <p className="text-sm text-slate-800">
              {detail.assignedOwnerName ?? "Unassigned"}
            </p>
          </Section>

          <Section title="Activity timeline">
            {detail.events.length === 0 ? (
              <p className="text-sm text-slate-400">No activity recorded.</p>
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
                            <span className="font-medium text-slate-800">
                              {formatLabel(event.eventType)}
                            </span>
                            <span className="text-xs text-slate-500">
                              {formatDateTime(event.createdAt)}
                            </span>
                          </div>
                          {Object.keys(event.payload).length > 0 && (
                            <p className="mt-1 break-words text-xs text-slate-500">
                              {formatJsonValue(event.payload)}
                            </p>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="External CRM/helpdesk delivery state">
            {detail.connectors.length === 0 ? (
              <p className="text-sm text-slate-400">
                No connector delivery rows for this case.
              </p>
            ) : (
              <div className="space-y-2">
                {detail.connectors.map((connector) => (
                  <div
                    key={connector.id}
                    className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-slate-800">
                        {formatLabel(connector.connectorType)}
                      </span>
                      <Pill className="bg-slate-100 text-slate-700">
                        {formatLabel(connector.status)}
                      </Pill>
                    </div>
                    <dl className="mt-2 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
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
                        <dt>Created</dt>
                        <dd className="mt-0.5 text-slate-700">
                          {formatDateTime(connector.createdAt)}
                        </dd>
                      </div>
                      <div>
                        <dt>Delivered</dt>
                        <dd className="mt-0.5 text-slate-700">
                          {formatDateTime(connector.deliveredAt)}
                        </dd>
                      </div>
                    </dl>
                    {connector.lastError && (
                      <p className="mt-2 text-xs text-rose-600">
                        {connector.lastError}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Actions">
            <div className="flex flex-wrap gap-2">
              {["Resolve", "Dismiss", "Retry sync", "Assign"].map((label) => (
                <span key={label} title="Actions ship in CON-177">
                  <button
                    type="button"
                    disabled
                    className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-400"
                  >
                    {label}
                  </button>
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Actions ship in CON-177.
            </p>
          </Section>
        </div>
      </aside>
    </div>
  );
}
