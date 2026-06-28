"use client";

import { useMemo, useState, useTransition } from "react";

import type { WebhookEvent } from "@/lib/connectors/webhook/settings";
import {
  rotateWebhookSecret,
  saveWebhookSettings,
  sendTestWebhook,
} from "./actions";
import type { WebhookStatusSummary } from "./page";

const EVENT_OPTIONS: { value: WebhookEvent; label: string; description: string }[] = [
  {
    value: "case.created",
    label: "case.created",
    description: "A new follow-up case is opened.",
  },
  {
    value: "case.updated",
    label: "case.updated",
    description: "A case changes owner, state, or details.",
  },
  {
    value: "case.resolved",
    label: "case.resolved",
    description: "A case is marked resolved.",
  },
  {
    value: "contact.updated",
    label: "contact.updated",
    description: "A captured contact record changes.",
  },
];

type InitialSettings = {
  enabled: boolean;
  url: string;
  events: WebhookEvent[];
  hasSecret: boolean;
};

type Banner =
  | { tone: "success"; message: string }
  | { tone: "error"; message: string }
  | null;

export function WebhookSettingsPanel({
  initialSettings,
  status,
}: {
  initialSettings: InitialSettings;
  status: WebhookStatusSummary;
}) {
  const [enabled, setEnabled] = useState(initialSettings.enabled);
  const [url, setUrl] = useState(initialSettings.url);
  const [events, setEvents] = useState<WebhookEvent[]>(initialSettings.events);
  const [hasSecret, setHasSecret] = useState(initialSettings.hasSecret);
  const [rotatedSecret, setRotatedSecret] = useState<string | null>(null);
  const [banner, setBanner] = useState<Banner>(null);
  const [testBanner, setTestBanner] = useState<Banner>(null);
  const [isSaving, startSaving] = useTransition();
  const [isRotating, startRotating] = useTransition();
  const [isTesting, startTesting] = useTransition();

  const urlError = useMemo(() => {
    if (!url.trim()) return "Enter a destination URL.";
    try {
      return new URL(url).protocol === "https:"
        ? null
        : "Destination URL must start with https://";
    } catch {
      return "Enter a valid HTTPS URL.";
    }
  }, [url]);

  function toggleEvent(eventName: WebhookEvent) {
    setEvents((current) =>
      current.includes(eventName)
        ? current.filter((value) => value !== eventName)
        : [...current, eventName],
    );
  }

  function handleSave() {
    setBanner(null);
    if (urlError) {
      setBanner({ tone: "error", message: urlError });
      return;
    }
    if (events.length === 0) {
      setBanner({ tone: "error", message: "Choose at least one event." });
      return;
    }

    startSaving(async () => {
      const result = await saveWebhookSettings({ enabled, url, events });
      if (result.ok) {
        setHasSecret(result.hasSecret);
        setBanner({ tone: "success", message: "Webhook settings saved." });
      } else {
        setBanner({ tone: "error", message: result.error });
      }
    });
  }

  function handleRotate() {
    setBanner(null);
    startRotating(async () => {
      const result = await rotateWebhookSecret();
      if (result.ok) {
        setHasSecret(true);
        setRotatedSecret(result.plaintext);
        setBanner({
          tone: "success",
          message:
            "Secret rotated. Copy the new secret now, as it will not be shown again.",
        });
      } else {
        setBanner({ tone: "error", message: result.error });
      }
    });
  }

  function handleTestSend() {
    setTestBanner(null);
    startTesting(async () => {
      const result = await sendTestWebhook();
      if (result.ok) {
        setTestBanner({
          tone: "success",
          message: `Test sent. HTTP ${result.statusCode} in ${result.latencyMs} ms.`,
        });
      } else {
        setTestBanner({ tone: "error", message: result.error });
      }
    });
  }

  async function copyRotatedSecret() {
    if (!rotatedSecret) return;
    await navigator.clipboard.writeText(rotatedSecret);
    setBanner({ tone: "success", message: "Secret copied to clipboard." });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-zinc-900">Settings</h2>
          <p className="mt-0.5 text-sm text-zinc-500">
            Configure the HTTPS destination and the event types it receives.
          </p>
        </div>

        <div className="space-y-5">
          <label className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
            <span>
              <span className="block text-sm font-medium text-zinc-900">
                Enabled
              </span>
              <span className="block text-xs text-zinc-500">
                Deliver subscribed events to the configured endpoint.
              </span>
            </span>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
              className="h-5 w-5 rounded border-zinc-300 text-[#FF6B2C] focus:ring-[#FF6B2C]"
            />
          </label>

          <div>
            <label
              htmlFor="webhook-url"
              className="block text-sm font-medium text-zinc-900"
            >
              Destination URL
            </label>
            <input
              id="webhook-url"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/webhooks/convo"
              className="mt-1.5 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-[#FF6B2C] focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30"
            />
            {urlError && (
              <p className="mt-1 text-xs text-red-600" role="alert">
                {urlError}
              </p>
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-zinc-900">Secret</h3>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Used to sign webhook payloads. The stored value is encrypted
                  and cannot be displayed again.
                </p>
              </div>
              <button
                type="button"
                onClick={handleRotate}
                disabled={isRotating}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isRotating ? "Rotating…" : hasSecret ? "Rotate secret" : "Create secret"}
              </button>
            </div>
            <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm text-zinc-700">
              {hasSecret ? "••••••••••••••••••••••••" : "No secret set"}
            </div>
          </div>

          {rotatedSecret && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-medium text-emerald-900">
                New webhook secret
              </p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <code className="min-w-0 flex-1 break-all rounded-md bg-white px-3 py-2 text-sm text-emerald-950">
                  {rotatedSecret}
                </code>
                <button
                  type="button"
                  onClick={copyRotatedSecret}
                  className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-800"
                >
                  Copy
                </button>
              </div>
            </div>
          )}

          <fieldset>
            <legend className="text-sm font-medium text-zinc-900">
              Events subscribed
            </legend>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {EVENT_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex items-start gap-3 rounded-lg border border-zinc-200 px-3 py-3"
                >
                  <input
                    type="checkbox"
                    checked={events.includes(option.value)}
                    onChange={() => toggleEvent(option.value)}
                    className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-[#FF6B2C] focus:ring-[#FF6B2C]"
                  />
                  <span>
                    <span className="block text-sm font-medium text-zinc-900">
                      {option.label}
                    </span>
                    <span className="block text-xs text-zinc-500">
                      {option.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            This destination URL will receive every subscribed event in real time
            — make sure your endpoint can handle it.
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-lg bg-[#FF6B2C] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#E85A1E] disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              {isSaving ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={handleTestSend}
              disabled={isTesting || !hasSecret}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isTesting ? "Sending…" : "Send test"}
            </button>
          </div>

          {banner && <InlineBanner banner={banner} />}
          {testBanner && <InlineBanner banner={testBanner} />}
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Status</h2>
        <dl className="mt-4 grid gap-3 md:grid-cols-3">
          <StatusItem
            label="Last successful delivery"
            value={formatDateTime(status.lastSuccessfulDeliveryAt)}
          />
          <StatusItem label="Pending" value={String(status.pendingCount)} />
          <StatusItem label="Abandoned" value={String(status.abandonedCount)} />
        </dl>
      </section>
    </div>
  );
}

function InlineBanner({ banner }: { banner: Exclude<Banner, null> }) {
  const classes =
    banner.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-red-200 bg-red-50 text-red-700";
  return (
    <div role="status" className={`rounded-lg border px-4 py-3 text-sm ${classes}`}>
      {banner.message}
    </div>
  );
}

function StatusItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-zinc-900">{value}</dd>
    </div>
  );
}

function formatDateTime(value: string | null): string {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
