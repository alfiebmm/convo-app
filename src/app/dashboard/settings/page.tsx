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
    shopify?: {
      shopDomain: string;
      accessToken: string;
      blogId: string;
    };
    webflow?: {
      siteId: string;
      collectionId: string;
      accessToken: string;
    };
    generic?: {
      name: string;
      endpoint: string;
      method: "POST" | "PUT";
      headers: Record<string, string>;
      authType: "none" | "basic" | "bearer" | "custom";
      authValue?: string;
      bodyTemplate: string;
      responseUrlPath?: string;
      responseIdPath?: string;
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
            <ShopifyIntegration
              settings={settings}
              onUpdate={setSettings}
            />
            <WebflowIntegration
              settings={settings}
              onUpdate={setSettings}
            />
            <GenericIntegration
              settings={settings}
              onUpdate={setSettings}
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
        <BillingSection />
      </div>
    </div>
  );
}

// ─── Helper: Save CMS config ─────────────────────────────────

async function saveCMSConfig(
  cmsType: string,
  cmsKey: string,
  cmsData: Record<string, unknown>,
  onUpdate: (s: TenantSettings) => void
) {
  const res = await fetch("/api/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cms: {
        type: cmsType,
        [cmsKey]: cmsData,
      },
    }),
  });
  const data = await res.json();
  onUpdate(data.settings);
}

async function disconnectCMS(
  cmsKey: string,
  currentSettings: TenantSettings,
  onUpdate: (s: TenantSettings) => void
) {
  // Remove the specific CMS config, keep others
  const currentCms = currentSettings.cms ?? ({} as TenantSettings["cms"]);
  const updatedCms: Record<string, unknown> = { ...currentCms, [cmsKey]: undefined };
  // If the active type was this one, clear it
  if (currentCms?.type === cmsKey) {
    updatedCms.type = "";
  }
  const res = await fetch("/api/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cms: updatedCms }),
  });
  const data = await res.json();
  onUpdate(data.settings);
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
      await saveCMSConfig(
        "wordpress",
        "wordpress",
        { siteUrl, username, applicationPassword: appPassword },
        onUpdate
      );
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
      await disconnectCMS("wordpress", settings, onUpdate);
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
          {isConnected && <ConnectedBadge />}
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
          <FormField label="Site URL">
            <input
              type="url"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              placeholder="https://yoursite.com"
              className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </FormField>
          <FormField label="Username">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </FormField>
          <FormField label="Application Password" hint="Generate in WordPress → Users → Application Passwords">
            <input
              type="password"
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
              placeholder="xxxx xxxx xxxx xxxx"
              className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </FormField>
          <FormActions
            onSave={handleSave}
            onTest={handleTest}
            saving={saving}
            testing={testing}
            disabled={!siteUrl || !username || !appPassword}
          />
          <TestResultBanner result={testResult} />
        </div>
      )}
    </div>
  );
}

// ─── Shopify Integration Card ────────────────────────────────

function ShopifyIntegration({
  settings,
  onUpdate,
}: {
  settings: TenantSettings;
  onUpdate: (s: TenantSettings) => void;
}) {
  const isConnected = !!settings.cms?.shopify?.shopDomain;
  const [showForm, setShowForm] = useState(false);
  const [shopDomain, setShopDomain] = useState(
    settings.cms?.shopify?.shopDomain ?? ""
  );
  const [accessToken, setAccessToken] = useState(
    settings.cms?.shopify?.accessToken ?? ""
  );
  const [blogId, setBlogId] = useState(
    settings.cms?.shopify?.blogId ?? ""
  );
  const [blogs, setBlogs] = useState<Array<{ id: number; title: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);

  async function handleSave() {
    setSaving(true);
    try {
      await saveCMSConfig(
        "shopify",
        "shopify",
        { shopDomain, accessToken, blogId },
        onUpdate
      );
      setShowForm(false);
    } catch (err) {
      console.error("Failed to save Shopify settings:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    setSaving(true);
    try {
      await disconnectCMS("shopify", settings, onUpdate);
      setShopDomain("");
      setAccessToken("");
      setBlogId("");
      setBlogs([]);
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
      const res = await fetch("/api/settings/test-shopify", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopDomain, accessToken }),
      });
      const data = await res.json();
      setTestResult(data);
      if (data.success && data.blogs) {
        setBlogs(data.blogs);
        // Auto-select first blog if none selected
        if (!blogId && data.blogs.length > 0) {
          setBlogId(String(data.blogs[0].id));
        }
      }
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
          <p className="font-medium text-slate-900">Shopify</p>
          <p className="text-sm text-slate-500">
            Publish to Shopify blog
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isConnected && <ConnectedBadge />}
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
          <FormField label="Shop Domain" hint="e.g. your-store.myshopify.com">
            <input
              type="text"
              value={shopDomain}
              onChange={(e) => setShopDomain(e.target.value)}
              placeholder="your-store.myshopify.com"
              className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </FormField>
          <FormField label="Access Token" hint="Admin API access token from your Shopify app">
            <input
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="shpat_xxxxx"
              className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </FormField>
          <FormField label="Blog">
            {blogs.length > 0 ? (
              <select
                value={blogId}
                onChange={(e) => setBlogId(e.target.value)}
                className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Select a blog...</option>
                {blogs.map((blog) => (
                  <option key={blog.id} value={String(blog.id)}>
                    {blog.title}
                  </option>
                ))}
              </select>
            ) : (
              <div>
                <input
                  type="text"
                  value={blogId}
                  onChange={(e) => setBlogId(e.target.value)}
                  placeholder="Test connection to load blogs"
                  className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Click &quot;Test Connection&quot; to load available blogs
                </p>
              </div>
            )}
          </FormField>
          <FormActions
            onSave={handleSave}
            onTest={handleTest}
            saving={saving}
            testing={testing}
            disabled={!shopDomain || !accessToken}
          />
          <TestResultBanner result={testResult} />
        </div>
      )}
    </div>
  );
}

// ─── Webflow Integration Card ────────────────────────────────

function WebflowIntegration({
  settings,
  onUpdate,
}: {
  settings: TenantSettings;
  onUpdate: (s: TenantSettings) => void;
}) {
  const isConnected = !!settings.cms?.webflow?.siteId;
  const [showForm, setShowForm] = useState(false);
  const [siteId, setSiteId] = useState(
    settings.cms?.webflow?.siteId ?? ""
  );
  const [collectionId, setCollectionId] = useState(
    settings.cms?.webflow?.collectionId ?? ""
  );
  const [accessToken, setAccessToken] = useState(
    settings.cms?.webflow?.accessToken ?? ""
  );
  const [collections, setCollections] = useState<
    Array<{ id: string; displayName: string; slug: string }>
  >([]);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);

  async function handleSave() {
    setSaving(true);
    try {
      await saveCMSConfig(
        "webflow",
        "webflow",
        { siteId, collectionId, accessToken },
        onUpdate
      );
      setShowForm(false);
    } catch (err) {
      console.error("Failed to save Webflow settings:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    setSaving(true);
    try {
      await disconnectCMS("webflow", settings, onUpdate);
      setSiteId("");
      setCollectionId("");
      setAccessToken("");
      setCollections([]);
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
      const res = await fetch("/api/settings/test-webflow", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, accessToken }),
      });
      const data = await res.json();
      setTestResult(data);
      if (data.success && data.collections) {
        setCollections(data.collections);
        if (!collectionId && data.collections.length > 0) {
          setCollectionId(data.collections[0].id);
        }
      }
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
          <p className="font-medium text-slate-900">Webflow</p>
          <p className="text-sm text-slate-500">
            Publish to Webflow CMS
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isConnected && <ConnectedBadge />}
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
          <FormField label="Site ID" hint="Found in Webflow Project Settings → General">
            <input
              type="text"
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              placeholder="64abc..."
              className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </FormField>
          <FormField label="Access Token" hint="Generate in Webflow → Integrations → API Access">
            <input
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="Bearer token"
              className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </FormField>
          <FormField label="Collection">
            {collections.length > 0 ? (
              <select
                value={collectionId}
                onChange={(e) => setCollectionId(e.target.value)}
                className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Select a collection...</option>
                {collections.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.displayName} ({col.slug})
                  </option>
                ))}
              </select>
            ) : (
              <div>
                <input
                  type="text"
                  value={collectionId}
                  onChange={(e) => setCollectionId(e.target.value)}
                  placeholder="Test connection to load collections"
                  className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Click &quot;Test Connection&quot; to load available collections
                </p>
              </div>
            )}
          </FormField>
          <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            ℹ️ Webflow items are created as drafts. You&apos;ll need to publish them in the Webflow Designer.
          </div>
          <FormActions
            onSave={handleSave}
            onTest={handleTest}
            saving={saving}
            testing={testing}
            disabled={!siteId || !accessToken}
          />
          <TestResultBanner result={testResult} />
        </div>
      )}
    </div>
  );
}

// ─── Generic/Custom Integration Card ─────────────────────────

const DEFAULT_BODY_TEMPLATE = `{
  "title": "{{title}}",
  "slug": "{{slug}}",
  "content": "{{body_html}}",
  "excerpt": "{{meta_description}}"
}`;

function GenericIntegration({
  settings,
  onUpdate,
}: {
  settings: TenantSettings;
  onUpdate: (s: TenantSettings) => void;
}) {
  const genericConfig = settings.cms?.generic;
  const isConnected = !!genericConfig?.endpoint;
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState(genericConfig?.name ?? "");
  const [endpoint, setEndpoint] = useState(genericConfig?.endpoint ?? "");
  const [method, setMethod] = useState<"POST" | "PUT">(
    genericConfig?.method ?? "POST"
  );
  const [authType, setAuthType] = useState<"none" | "basic" | "bearer" | "custom">(
    genericConfig?.authType ?? "none"
  );
  const [authValue, setAuthValue] = useState(genericConfig?.authValue ?? "");
  const [bodyTemplate, setBodyTemplate] = useState(
    genericConfig?.bodyTemplate ?? DEFAULT_BODY_TEMPLATE
  );
  const [responseUrlPath, setResponseUrlPath] = useState(
    genericConfig?.responseUrlPath ?? ""
  );
  const [responseIdPath, setResponseIdPath] = useState(
    genericConfig?.responseIdPath ?? ""
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
      await saveCMSConfig(
        "generic",
        "generic",
        {
          name: name || "Custom API",
          endpoint,
          method,
          headers: {},
          authType,
          authValue: authValue || undefined,
          bodyTemplate,
          responseUrlPath: responseUrlPath || undefined,
          responseIdPath: responseIdPath || undefined,
        },
        onUpdate
      );
      setShowForm(false);
    } catch (err) {
      console.error("Failed to save Generic settings:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    setSaving(true);
    try {
      await disconnectCMS("generic", settings, onUpdate);
      setName("");
      setEndpoint("");
      setMethod("POST");
      setAuthType("none");
      setAuthValue("");
      setBodyTemplate(DEFAULT_BODY_TEMPLATE);
      setResponseUrlPath("");
      setResponseIdPath("");
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
      const res = await fetch("/api/settings/test-generic", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint,
          headers: {},
          authType,
          authValue: authValue || undefined,
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
          <p className="font-medium text-slate-900">
            {isConnected && genericConfig?.name
              ? genericConfig.name
              : "Custom / Generic API"}
          </p>
          <p className="text-sm text-slate-500">
            Publish via any REST API
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isConnected && <ConnectedBadge />}
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
          <FormField label="Display Name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Doggo Blog API"
              className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </FormField>
          <FormField label="Endpoint URL">
            <input
              type="url"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://example.com/api/v1/posts"
              className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </FormField>
          <div className="grid max-w-md grid-cols-2 gap-3">
            <FormField label="Method">
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as "POST" | "PUT")}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
              </select>
            </FormField>
            <FormField label="Auth Type">
              <select
                value={authType}
                onChange={(e) =>
                  setAuthType(
                    e.target.value as "none" | "basic" | "bearer" | "custom"
                  )
                }
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="none">None</option>
                <option value="basic">Basic Auth</option>
                <option value="bearer">Bearer Token</option>
                <option value="custom">Custom (via headers)</option>
              </select>
            </FormField>
          </div>
          {authType !== "none" && authType !== "custom" && (
            <FormField
              label={authType === "basic" ? "Credentials (user:pass)" : "Token"}
            >
              <input
                type="password"
                value={authValue}
                onChange={(e) => setAuthValue(e.target.value)}
                placeholder={
                  authType === "basic" ? "username:password" : "your-api-token"
                }
                className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </FormField>
          )}
          <FormField
            label="Body Template (JSON)"
            hint="Placeholders: {{title}}, {{slug}}, {{body_html}}, {{body_markdown}}, {{meta_description}}, {{excerpt}}"
          >
            <textarea
              value={bodyTemplate}
              onChange={(e) => setBodyTemplate(e.target.value)}
              rows={6}
              className="mt-1 w-full max-w-lg rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
            />
          </FormField>
          <div className="grid max-w-md grid-cols-2 gap-3">
            <FormField label="Response URL Path" hint='e.g. "data.url"'>
              <input
                type="text"
                value={responseUrlPath}
                onChange={(e) => setResponseUrlPath(e.target.value)}
                placeholder="data.url"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </FormField>
            <FormField label="Response ID Path" hint='e.g. "data.id"'>
              <input
                type="text"
                value={responseIdPath}
                onChange={(e) => setResponseIdPath(e.target.value)}
                placeholder="data.id"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </FormField>
          </div>
          <FormActions
            onSave={handleSave}
            onTest={handleTest}
            saving={saving}
            testing={testing}
            disabled={!endpoint}
          />
          <TestResultBanner result={testResult} />
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

// ─── Billing Section ─────────────────────────────────────────

function BillingSection() {
  const [billingData, setBillingData] = useState<{
    tenant?: { id: string; name: string; plan: string; stripeCustomerId: string | null };
  } | null>(null);
  const [usage, setUsage] = useState<{
    conversations: number;
    articles: number;
  } | null>(null);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => setBillingData(data))
      .catch(() => {});

    fetch("/api/usage")
      .then((r) => r.json())
      .then((data) => setUsage(data))
      .catch(() => {});
  }, []);

  const plan = billingData?.tenant?.plan ?? "starter";
  const tenantId = billingData?.tenant?.id;
  const limits = {
    starter: { conversations: 500, articles: 10 },
    growth: { conversations: 2000, articles: 50 },
    pro: { conversations: 10000, articles: 200 },
  }[plan] ?? { conversations: 500, articles: 10 };

  async function handleUpgrade(targetPlan: "growth" | "pro") {
    if (!tenantId) return;
    setUpgrading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, plan: targetPlan }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Checkout error:", err);
    } finally {
      setUpgrading(false);
    }
  }

  async function handleManageBilling() {
    if (!tenantId) return;
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Portal error:", err);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900">Billing</h2>

      {/* Current plan + usage */}
      <div className="mt-4 rounded-lg bg-slate-50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-slate-900 capitalize">
              {plan} Plan
            </p>
            <p className="text-sm text-slate-500">
              {limits.conversations.toLocaleString()} conversations / {limits.articles} articles per month
            </p>
          </div>
          {billingData?.tenant?.stripeCustomerId && (
            <button
              onClick={handleManageBilling}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-white transition-colors"
            >
              Manage Billing
            </button>
          )}
        </div>

        {usage && (
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase">
                Conversations this month
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {usage.conversations.toLocaleString()}{" "}
                <span className="text-sm font-normal text-slate-400">
                  / {limits.conversations.toLocaleString()}
                </span>
              </p>
              <div className="mt-1 h-2 w-full rounded-full bg-slate-200">
                <div
                  className="h-2 rounded-full bg-blue-500 transition-all"
                  style={{
                    width: `${Math.min(100, (usage.conversations / limits.conversations) * 100)}%`,
                  }}
                />
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase">
                Articles this month
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {usage.articles.toLocaleString()}{" "}
                <span className="text-sm font-normal text-slate-400">
                  / {limits.articles}
                </span>
              </p>
              <div className="mt-1 h-2 w-full rounded-full bg-slate-200">
                <div
                  className="h-2 rounded-full bg-emerald-500 transition-all"
                  style={{
                    width: `${Math.min(100, (usage.articles / limits.articles) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Plan comparison */}
      {plan === "starter" && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="font-medium text-slate-900">Growth</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">$49<span className="text-sm font-normal text-slate-500">/mo</span></p>
            <ul className="mt-3 space-y-1 text-sm text-slate-500">
              <li>✓ 2,000 conversations/mo</li>
              <li>✓ 50 articles/mo</li>
              <li>✓ Priority support</li>
            </ul>
            <button
              onClick={() => handleUpgrade("growth")}
              disabled={upgrading}
              className="mt-4 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {upgrading ? "Redirecting..." : "Upgrade to Growth"}
            </button>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="font-medium text-slate-900">Pro</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">$149<span className="text-sm font-normal text-slate-500">/mo</span></p>
            <ul className="mt-3 space-y-1 text-sm text-slate-500">
              <li>✓ 10,000 conversations/mo</li>
              <li>✓ 200 articles/mo</li>
              <li>✓ Custom branding</li>
              <li>✓ Priority support</li>
            </ul>
            <button
              onClick={() => handleUpgrade("pro")}
              disabled={upgrading}
              className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {upgrading ? "Redirecting..." : "Upgrade to Pro"}
            </button>
          </div>
        </div>
      )}

      {plan !== "starter" && plan !== "pro" && (
        <div className="mt-6">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">Pro</p>
                <p className="text-sm text-slate-500">$149/mo — 10,000 conversations, 200 articles</p>
              </div>
              <button
                onClick={() => handleUpgrade("pro")}
                disabled={upgrading}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {upgrading ? "Redirecting..." : "Upgrade to Pro"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Shared UI Components ────────────────────────────────────

function ConnectedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
      Connected
    </span>
  );
}

function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function FormActions({
  onSave,
  onTest,
  saving,
  testing,
  disabled,
}: {
  onSave: () => void;
  onTest: () => void;
  saving: boolean;
  testing: boolean;
  disabled: boolean;
}) {
  return (
    <div className="flex gap-2 pt-2">
      <button
        onClick={onSave}
        disabled={saving || disabled}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
      >
        {saving ? "Saving..." : "Save"}
      </button>
      <button
        onClick={onTest}
        disabled={testing || disabled}
        className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
      >
        {testing ? "Testing..." : "Test Connection"}
      </button>
    </div>
  );
}

function TestResultBanner({
  result,
}: {
  result: { success: boolean; error?: string } | null;
}) {
  if (!result) return null;
  return (
    <div
      className={`mt-2 rounded-lg p-3 text-sm ${
        result.success
          ? "bg-green-50 text-green-800"
          : "bg-red-50 text-red-800"
      }`}
    >
      {result.success
        ? "✓ Connection successful!"
        : `✗ ${result.error}`}
    </div>
  );
}
