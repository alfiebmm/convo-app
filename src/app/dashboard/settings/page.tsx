"use client";

import { useState, useEffect } from "react";

interface TenantSettings {
  cms?: {
    type: string;
    wordpress?: {
      siteUrl: string;
      username: string;
      applicationPassword: string;
    };
  };
  autoPublish?: boolean;
  autoPublishThreshold?: number;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<TenantSettings>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setSettings(data.settings ?? {});
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
      <p className="mt-1 text-sm text-slate-500">
        Manage your site, team, and integrations.
      </p>

      <div className="mt-8 space-y-8">
        {/* General */}
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">General</h2>
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Site Name
              </label>
              <input
                type="text"
                defaultValue="My Website"
                className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Domain
              </label>
              <input
                type="text"
                placeholder="example.com"
                className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </section>

        {/* CMS Integration */}
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            CMS Integration
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Connect to your CMS to publish content directly.
          </p>
          <div className="mt-4 space-y-3">
            <WordPressIntegration
              settings={settings}
              onUpdate={setSettings}
            />
            <IntegrationCard
              name="Shopify"
              description="Publish to Shopify blog"
              connected={false}
              comingSoon
            />
            <IntegrationCard
              name="Webflow"
              description="Publish to Webflow CMS"
              connected={false}
              comingSoon
            />
          </div>
        </section>

        {/* Auto-publish */}
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Auto-publish
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Automatically approve and publish high-scoring content.
          </p>
          <AutoPublishSettings settings={settings} onUpdate={setSettings} />
        </section>

        {/* Team */}
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Team</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage who has access to this site.
          </p>
          <div className="mt-4 rounded-lg border border-slate-200 p-8 text-center text-sm text-slate-400">
            Team management coming soon.
          </div>
        </section>

        {/* Billing */}
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Billing</h2>
          <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 p-4">
            <div>
              <p className="font-medium text-slate-900">Starter Plan</p>
              <p className="text-sm text-slate-500">
                500 conversations / 10 articles per month
              </p>
            </div>
            <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors">
              Upgrade
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── WordPress Integration Card ──────────────────────────────

function WordPressIntegration({
  settings,
  onUpdate,
}: {
  settings: TenantSettings;
  onUpdate: (s: TenantSettings) => void;
}) {
  const isConnected = !!settings.cms?.wordpress?.siteUrl;
  const [showForm, setShowForm] = useState(false);
  const [siteUrl, setSiteUrl] = useState(
    settings.cms?.wordpress?.siteUrl ?? ""
  );
  const [username, setUsername] = useState(
    settings.cms?.wordpress?.username ?? ""
  );
  const [appPassword, setAppPassword] = useState(
    settings.cms?.wordpress?.applicationPassword ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cms: {
            type: "wordpress",
            wordpress: {
              siteUrl,
              username,
              applicationPassword: appPassword,
            },
          },
        }),
      });
      const data = await res.json();
      onUpdate(data.settings);
      setShowForm(false);
    } catch (err) {
      console.error("Failed to save WordPress settings:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cms: {} }),
      });
      const data = await res.json();
      onUpdate(data.settings);
      setSiteUrl("");
      setUsername("");
      setAppPassword("");
    } catch (err) {
      console.error("Failed to disconnect:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/test-wordpress", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteUrl,
          username,
          applicationPassword: appPassword,
        }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ success: false, error: "Network error" });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-slate-900">WordPress</p>
          <p className="text-sm text-slate-500">
            Publish articles via WP REST API
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isConnected && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Connected
            </span>
          )}
          {isConnected ? (
            <div className="flex gap-2">
              <button
                onClick={() => setShowForm(!showForm)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={handleDisconnect}
                disabled={saving}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowForm(!showForm)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Connect
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Site URL
            </label>
            <input
              type="url"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              placeholder="https://yoursite.com"
              className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Application Password
            </label>
            <input
              type="password"
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
              placeholder="xxxx xxxx xxxx xxxx"
              className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-slate-400">
              Generate in WordPress → Users → Application Passwords
            </p>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={saving || !siteUrl || !username || !appPassword}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={handleTest}
              disabled={testing || !siteUrl || !username || !appPassword}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              {testing ? "Testing..." : "Test Connection"}
            </button>
          </div>
          {testResult && (
            <div
              className={`mt-2 rounded-lg p-3 text-sm ${
                testResult.success
                  ? "bg-green-50 text-green-800"
                  : "bg-red-50 text-red-800"
              }`}
            >
              {testResult.success
                ? "✓ Connection successful!"
                : `✗ ${testResult.error}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Auto-publish Settings ───────────────────────────────────

function AutoPublishSettings({
  settings,
  onUpdate,
}: {
  settings: TenantSettings;
  onUpdate: (s: TenantSettings) => void;
}) {
  const [enabled, setEnabled] = useState(settings.autoPublish ?? false);
  const [threshold, setThreshold] = useState(
    settings.autoPublishThreshold ?? 0.8
  );
  const [saving, setSaving] = useState(false);

  async function save(autoPublish: boolean, autoPublishThreshold: number) {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoPublish, autoPublishThreshold }),
      });
      const data = await res.json();
      onUpdate(data.settings);
    } catch (err) {
      console.error("Failed to save auto-publish settings:", err);
    } finally {
      setSaving(false);
    }
  }

  function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    save(next, threshold);
  }

  function handleThresholdChange(val: number) {
    setThreshold(val);
    save(enabled, val);
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-700">
            Enable auto-publish
          </p>
          <p className="text-xs text-slate-400">
            Articles meeting the SEO threshold will be automatically approved
            {settings.cms?.type ? " and published" : ""}.
          </p>
        </div>
        <button
          onClick={handleToggle}
          disabled={saving}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            enabled ? "bg-green-600" : "bg-slate-200"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {enabled && (
        <div>
          <label className="block text-sm font-medium text-slate-700">
            SEO Score Threshold:{" "}
            <span className="font-bold">{Math.round(threshold * 100)}%</span>
          </label>
          <input
            type="range"
            min={0.5}
            max={1.0}
            step={0.05}
            value={threshold}
            onChange={(e) =>
              handleThresholdChange(parseFloat(e.target.value))
            }
            className="mt-2 w-full max-w-md"
          />
          <div className="mt-1 flex justify-between text-xs text-slate-400 max-w-md">
            <span>50%</span>
            <span>75%</span>
            <span>100%</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Generic Integration Card (Shopify, Webflow, etc.) ──────

function IntegrationCard({
  name,
  description,
  connected,
  comingSoon,
}: {
  name: string;
  description: string;
  connected: boolean;
  comingSoon?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
      <div>
        <p className="font-medium text-slate-900">{name}</p>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      {comingSoon ? (
        <span className="text-xs font-medium text-slate-400">Coming soon</span>
      ) : (
        <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
          {connected ? "Connected" : "Connect"}
        </button>
      )}
    </div>
  );
}
