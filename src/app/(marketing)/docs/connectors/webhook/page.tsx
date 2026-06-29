import Link from "next/link";
import type { ReactNode } from "react";

import { marketingMetadata } from "@/lib/marketing/seo";

export const metadata = marketingMetadata({
  title: "Webhook Connector Docs",
  description:
    "How to configure Convo webhook delivery, verify signatures, handle retries, and replay outbox rows.",
  path: "/docs/connectors/webhook",
  keywords: ["Convo webhook", "webhook connector", "webhook signatures"],
});

const EXAMPLES = {
  "case.created": {
    event: "case.created",
    occurred_at: "2026-06-28T01:12:00.000Z",
    data: {
      event: "case.created",
      case: {
        id: "c1111111-1111-4111-8111-111111111111",
        status: "open",
        subject: "Quote request",
      },
      contact: {
        id: "d1111111-1111-4111-8111-111111111111",
        email: "customer@example.com",
      },
    },
  },
  "case.updated": {
    event: "case.updated",
    occurred_at: "2026-06-28T02:24:00.000Z",
    data: {
      event: "case.updated",
      case: {
        id: "c1111111-1111-4111-8111-111111111111",
        status: "in_progress",
        assignee: "sales",
      },
    },
  },
  "case.resolved": {
    event: "case.resolved",
    occurred_at: "2026-06-28T03:36:00.000Z",
    data: {
      event: "case.resolved",
      case: {
        id: "c1111111-1111-4111-8111-111111111111",
        status: "resolved",
        resolution: "Customer contacted",
      },
    },
  },
  "contact.updated": {
    event: "contact.updated",
    occurred_at: "2026-06-28T04:48:00.000Z",
    data: {
      event: "contact.updated",
      contact: {
        id: "d1111111-1111-4111-8111-111111111111",
        email: "customer@example.com",
        phone: "+61 400 000 000",
      },
    },
  },
} as const;

export default function WebhookDocsPage() {
  return (
    <main className="bg-white">
      <section className="border-b border-zinc-200">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#FF6B2C]">
            Connector docs
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-zinc-950">
            Webhook connector
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-600">
            Send subscribed case and contact events from Convo to your HTTPS
            endpoint, verify each request with an HMAC signature, and replay
            delivery rows from the tenant dashboard.
          </p>
          <div className="mt-6">
            <Link
              href="/dashboard/settings/connectors/webhook"
              className="rounded-lg bg-[#FF6B2C] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#E85A1E]"
            >
              Open webhook settings
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl space-y-10 px-6 py-12">
        <DocsBlock title="Overview">
          <p>
            The webhook connector delivers V1 case and contact events to a
            single configured HTTPS destination for the current tenant. Events
            fire when a follow-up case is created, materially updated, resolved,
            or when a captured contact record changes.
          </p>
          <p>
            V1 supports one endpoint per tenant, one shared signing secret, JSON
            payloads, fixed retry rules, and outbox replay. It does not support
            per-event destinations, custom headers, endpoint-specific payload
            transforms, or multiple active secrets.
          </p>
        </DocsBlock>

        <DocsBlock title="Event Types">
          <div className="space-y-6">
            {Object.entries(EXAMPLES).map(([event, payload]) => (
              <div key={event}>
                <h3 className="text-base font-semibold text-zinc-950">{event}</h3>
                <CodeBlock value={JSON.stringify(payload, null, 2)} />
              </div>
            ))}
          </div>
        </DocsBlock>

        <DocsBlock title="Signature Scheme">
          <p>
            Every request includes{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5">
              X-Convo-Signature
            </code>{" "}
            with this exact format:
          </p>
          <CodeBlock value="t=<unix_timestamp>,v1=<hex_hmac_sha256>" />
          <p>
            The HMAC input is{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5">
              &lt;timestamp&gt;.&lt;raw request body&gt;
            </code>
            , signed with SHA-256 and your webhook secret. Reject requests when
            the timestamp is more than 300 seconds from your server time.
          </p>
        </DocsBlock>

        <DocsBlock title="Retry Policy">
          <p>
            Delivery uses a 10-second per-request timeout. Retryable failures
            use this backoff schedule: 60 seconds, 300 seconds, 1,800 seconds,
            7,200 seconds, then 43,200 seconds. Rows are abandoned after five
            attempts.
          </p>
          <p>
            HTTP 408, HTTP 429, and 5xx responses are retryable. Other 4xx
            responses are treated as permanent failures.
          </p>
        </DocsBlock>

        <DocsBlock title="Idempotency">
          <p>
            Convo sends an{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5">
              Idempotency-Key
            </code>{" "}
            header for every delivery. Store processed keys on your side and
            return a 2xx response for duplicate keys that have already been
            handled successfully.
          </p>
        </DocsBlock>

        <DocsBlock title="Setup Walkthrough">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Open{" "}
              <Link
                href="/dashboard/settings/connectors/webhook"
                className="font-medium text-[#D94F15] underline underline-offset-2"
              >
                webhook settings
              </Link>
              .
            </li>
            <li>Enter an HTTPS destination URL.</li>
            <li>Create or rotate the signing secret and store it securely.</li>
            <li>Select the events your endpoint should receive.</li>
            <li>Send a test event and confirm your endpoint returns 2xx.</li>
            <li>Use the outbox replay page to inspect and replay delivery rows.</li>
          </ol>
        </DocsBlock>

        <DocsBlock title="Connector Surfaces">
          <p>
            Convo can enqueue webhook deliveries from two tenant settings
            surfaces. The dashboard webhook connector is the tenant-wide V1
            surface: one HTTPS URL, one signing secret, and selected event
            subscriptions. Follow-up forumConfig destinations are routing
            destinations attached to a case type and routing key, so a matching
            follow-up case can be sent to the destination configured for that
            rule path.
          </p>
          <p>
            When both surfaces are configured, they deliver independently and
            create separate outbox rows. The dashboard connector uses its shared
            HMAC secret. A forumConfig webhook destination is signed only when
            its destination config includes{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5">
              secret_ciphertext
            </code>
            . In V1, destinations without that field deliver unsigned and do not
            include{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5">
              X-Convo-Signature
            </code>
            .
          </p>
        </DocsBlock>
      </section>
    </main>
  );
}

function DocsBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-zinc-950">{title}</h2>
      <div className="space-y-4 text-sm leading-6 text-zinc-600">{children}</div>
    </section>
  );
}

function CodeBlock({ value }: { value: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-950 p-4 text-xs leading-5 text-zinc-100">
      <code>{value}</code>
    </pre>
  );
}
