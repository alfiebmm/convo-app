"use client";

import { useMemo, useState } from "react";

type BrandFormValues = {
  logoUrl: string;
  logoAlt: string;
  siteName: string;
  primaryColor: string;
};

export function BrandForm({
  tenantName,
  tenantDomain,
  initialValues,
}: {
  tenantName: string;
  tenantDomain: string;
  initialValues: BrandFormValues;
}) {
  const [values, setValues] = useState(initialValues);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const previewLogoUrl = useMemo(
    () => (logoFile ? URL.createObjectURL(logoFile) : values.logoUrl),
    [logoFile, values.logoUrl],
  );

  function updateValue(key: keyof BrandFormValues, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function refreshFromSite() {
    setRefreshing(true);
    setStatus(null);
    setError(null);
    try {
      const res = await fetch("/api/settings/brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refresh" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Refresh failed");
      const fetched = data.fetched;
      setValues((current) => ({
        ...current,
        logoUrl: fetched.logo?.url || current.logoUrl,
        logoAlt: fetched.logo?.alt || current.logoAlt || tenantName,
        siteName: fetched.siteName || current.siteName || tenantName,
        primaryColor: fetched.themeColor || current.primaryColor,
      }));
      setLogoFile(null);
      setStatus(
        fetched.logo
          ? `Fetched ${fetched.logo.source} from ${tenantDomain}. Save to apply it.`
          : "No logo was found. You can upload one manually.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  async function saveBrand(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("siteName", values.siteName);
      formData.set("logoUrl", values.logoUrl);
      formData.set("logoAlt", values.logoAlt);
      formData.set("primaryColor", values.primaryColor);
      if (logoFile) formData.set("logoFile", logoFile);

      const res = await fetch("/api/settings/brand", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      const saved = data.brandJson ?? {};
      const savedLogo = saved.logo ?? {};
      const savedColours = saved.colors ?? {};
      setValues({
        logoUrl: savedLogo.url || values.logoUrl,
        logoAlt: savedLogo.alt || values.logoAlt,
        siteName: saved.name || values.siteName,
        primaryColor: savedColours.primary || values.primaryColor,
      });
      setLogoFile(null);
      setStatus("Saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={saveBrand} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-lg border border-zinc-200 bg-white p-6">
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-zinc-700">
              Logo image
            </label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)}
              className="mt-2 block w-full text-sm text-zinc-700 file:mr-4 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-800"
            />
            <input
              type="url"
              value={values.logoUrl}
              onChange={(event) => updateValue("logoUrl", event.target.value)}
              placeholder="https://example.com/logo.png"
              className="mt-3 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700">
              Logo alt text
            </label>
            <input
              type="text"
              value={values.logoAlt}
              onChange={(event) => updateValue("logoAlt", event.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700">
              Site name
            </label>
            <input
              type="text"
              value={values.siteName}
              onChange={(event) => updateValue("siteName", event.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700">
              Primary brand colour
            </label>
            <div className="mt-1 flex items-center gap-3">
              <input
                type="color"
                value={normaliseColour(values.primaryColor)}
                onChange={(event) =>
                  updateValue("primaryColor", event.target.value)
                }
                className="h-10 w-12 rounded border border-zinc-200 bg-white"
              />
              <input
                type="text"
                value={values.primaryColor}
                onChange={(event) =>
                  updateValue("primaryColor", event.target.value)
                }
                className="w-36 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save brand"}
            </button>
            <button
              type="button"
              onClick={refreshFromSite}
              disabled={refreshing || !tenantDomain}
              className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
            >
              {refreshing ? "Refreshing..." : "Refresh from site"}
            </button>
            {status && <span className="text-sm text-green-700">{status}</span>}
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        </div>
      </section>

      <aside className="rounded-lg border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Preview
        </h2>
        <div className="mt-4 rounded-lg border border-zinc-200 p-4">
          <div className="flex h-10 items-center gap-3">
            {previewLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewLogoUrl}
                alt={values.logoAlt || tenantName}
                className="max-h-[30px] max-w-[180px] object-contain"
              />
            ) : (
              <div className="h-[30px] w-28 rounded bg-zinc-100" />
            )}
            <span className="text-sm font-semibold text-zinc-900">
              {values.siteName || tenantName}
            </span>
          </div>
          <div
            className="mt-4 h-1.5 rounded"
            style={{ backgroundColor: normaliseColour(values.primaryColor) }}
          />
          <pre className="mt-4 overflow-auto rounded bg-zinc-950 p-3 text-xs leading-5 text-zinc-100">
            {JSON.stringify(
              {
                "@type": "Organization",
                name: values.siteName || tenantName,
                logo: values.logoUrl || null,
              },
              null,
              2,
            )}
          </pre>
        </div>
      </aside>
    </form>
  );
}

function normaliseColour(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : "#FF6B2C";
}
