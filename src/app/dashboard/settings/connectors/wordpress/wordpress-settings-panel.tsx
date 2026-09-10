"use client";

import { useEffect, useMemo, useState } from "react";

import type { MaskedWordPressConnector } from "@/lib/blog/connectors/wordpress-settings";
import {
  canSaveWordPressForm,
  wordpressFormKey,
  wordpressFormValidationError,
  type WordPressFormValues,
} from "./form-state";

type Banner =
  | { tone: "success"; message: string }
  | { tone: "error"; message: string }
  | null;

type ApiConfigResponse =
  | { ok: true; config: MaskedWordPressConnector | null }
  | { ok: false; error: string };

type ApiTestResponse =
  | { ok: true; siteUrl: string }
  | { ok: false; error: string };

type ApiSaveResponse =
  | { ok: true; config: MaskedWordPressConnector }
  | { ok: false; error: string };

const emptyValues: WordPressFormValues = {
  siteUrl: "",
  username: "",
  applicationPassword: "",
};

export function WordPressSettingsPanel({ tenantId }: { tenantId: string }) {
  const [values, setValues] = useState<WordPressFormValues>(emptyValues);
  const [maskedPassword, setMaskedPassword] = useState<string | null>(null);
  const [connectedAt, setConnectedAt] = useState<string | null>(null);
  const [successfulTestKey, setSuccessfulTestKey] = useState<string | null>(null);
  const [banner, setBanner] = useState<Banner>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const endpoint = `/api/tenants/${tenantId}/connectors/wordpress`;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(endpoint)
      .then((response) => response.json() as Promise<ApiConfigResponse>)
      .then((data) => {
        if (cancelled) return;
        if (!data.ok) {
          setBanner({ tone: "error", message: data.error });
          return;
        }
        hydrateConfig(data.config);
      })
      .catch(() => {
        if (!cancelled) {
          setBanner({ tone: "error", message: "Could not load WordPress settings." });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  const validationError = useMemo(
    () => wordpressFormValidationError(values, maskedPassword),
    [values, maskedPassword],
  );
  const saveEnabled = canSaveWordPressForm(
    values,
    successfulTestKey,
    maskedPassword,
  );

  function updateField(field: keyof WordPressFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setSuccessfulTestKey(null);
    setBanner(null);
  }

  async function handleTest() {
    setBanner(null);
    if (validationError) {
      setBanner({ tone: "error", message: validationError });
      return;
    }

    setTesting(true);
    try {
      const response = await fetch(`${endpoint}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await response.json()) as ApiTestResponse;
      if (data.ok) {
        const testedValues = { ...values, siteUrl: data.siteUrl };
        setValues(testedValues);
        setSuccessfulTestKey(wordpressFormKey(testedValues));
        setBanner({
          tone: "success",
          message: `Connected to ${data.siteUrl}`,
        });
      } else {
        setSuccessfulTestKey(null);
        setBanner({ tone: "error", message: data.error });
      }
    } catch {
      setSuccessfulTestKey(null);
      setBanner({ tone: "error", message: "Could not test the WordPress connection." });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setBanner(null);
    if (!saveEnabled) return;

    setSaving(true);
    try {
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await response.json()) as ApiSaveResponse;
      if (data.ok) {
        hydrateConfig(data.config);
        setBanner({ tone: "success", message: "WordPress connection saved." });
      } else {
        setBanner({ tone: "error", message: data.error });
      }
    } catch {
      setBanner({ tone: "error", message: "Could not save the WordPress connection." });
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    const confirmed = window.confirm(
      "Disconnect WordPress for this tenant? This removes the stored application password.",
    );
    if (!confirmed) return;

    setBanner(null);
    setDisconnecting(true);
    try {
      const response = await fetch(endpoint, { method: "DELETE" });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (data.ok) {
        setValues(emptyValues);
        setMaskedPassword(null);
        setConnectedAt(null);
        setSuccessfulTestKey(null);
        setBanner({ tone: "success", message: "WordPress disconnected." });
      } else {
        setBanner({
          tone: "error",
          message: data.error ?? "Could not disconnect WordPress.",
        });
      }
    } catch {
      setBanner({ tone: "error", message: "Could not disconnect WordPress." });
    } finally {
      setDisconnecting(false);
    }
  }

  function hydrateConfig(config: MaskedWordPressConnector | null) {
    if (!config) {
      setValues(emptyValues);
      setMaskedPassword(null);
      setConnectedAt(null);
      setSuccessfulTestKey(null);
      return;
    }
    setValues({
      siteUrl: config.siteUrl,
      username: config.username,
      applicationPassword: config.applicationPassword,
    });
    setMaskedPassword(config.applicationPassword);
    setConnectedAt(config.connectedAt);
    setSuccessfulTestKey(null);
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="grid gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Connection</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Connect the tenant to WordPress using a WordPress Application Password.
            </p>
          </div>
          {connectedAt && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
              Connected {formatDate(connectedAt)}
            </div>
          )}
        </div>

        <div className="grid gap-4">
          <Field label="Site URL" htmlFor="wordpress-site-url">
            <input
              id="wordpress-site-url"
              type="url"
              value={values.siteUrl}
              onChange={(event) => updateField("siteUrl", event.target.value)}
              placeholder="https://example.com"
              className="mt-1.5 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-[#FF6B2C] focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30"
            />
          </Field>

          <Field label="Username" htmlFor="wordpress-username">
            <input
              id="wordpress-username"
              type="text"
              value={values.username}
              onChange={(event) => updateField("username", event.target.value)}
              autoComplete="username"
              className="mt-1.5 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-[#FF6B2C] focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30"
            />
          </Field>

          <Field
            label="Application Password"
            htmlFor="wordpress-application-password"
            hint="WordPress formats these with spaces; paste it exactly as shown."
          >
            <input
              id="wordpress-application-password"
              type="password"
              value={values.applicationPassword}
              onChange={(event) =>
                updateField("applicationPassword", event.target.value)
              }
              autoComplete="new-password"
              placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
              className="mt-1.5 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-[#FF6B2C] focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30"
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || Boolean(validationError)}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {testing ? "Testing..." : "Test connection"}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !saveEnabled}
            className="rounded-lg bg-[#FF6B2C] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#E85A1E] disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={disconnecting || !connectedAt}
            className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {disconnecting ? "Disconnecting..." : "Disconnect"}
          </button>
        </div>

        {banner && <WordPressInlineBanner banner={banner} />}
      </div>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-zinc-900">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

export function WordPressInlineBanner({
  banner,
}: {
  banner: Exclude<Banner, null>;
}) {
  const classes =
    banner.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-red-200 bg-red-50 text-red-700";
  const role = banner.tone === "success" ? "status" : "alert";
  return (
    <div role={role} className={`rounded-lg border px-4 py-3 text-sm ${classes}`}>
      {banner.message}
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
