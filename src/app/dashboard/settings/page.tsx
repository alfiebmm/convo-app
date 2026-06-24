"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  MigrationConfirmationNote,
  anyForumConfigSlicePopulated,
} from "./legacy-deprecation-banner";

interface AudienceConfig {
  id: string;
  name: string;
  urlPatterns: string[];
  persona: string;
  ctaMessages: string[];
  ctaAfterTurns: number;
}

interface DeflectRule {
  topic: string;
  response: string;
}

interface GuardrailsConfig {
  audiences: AudienceConfig[];
  // CON-204: `topicBoundaries.allow` removed — forumConfig.allowed_topics
  // is the single structured source. Existing tenant JSON blobs may still
  // carry an `allow` field; it's harmlessly ignored by the runtime.
  topicBoundaries: {
    deflect: DeflectRule[];
    hardBlock: string[];
  };
  conversationLimits: {
    maxTurnsBeforeCTA: number;
    idleTimeoutMinutes: number;
  };
}

interface NotificationsConfig {
  enabled: boolean;
  telegram?: {
    botToken: string;
    chatId: string;
  };
  mode: "all" | "digest" | "off";
}

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
  guardrails?: GuardrailsConfig;
  notifications?: NotificationsConfig;
}

type ForumConfigPopulated = {
  ai_persona?: boolean;
  qualifying_questions?: boolean;
  allowed_topics?: boolean;
  follow_up?: boolean;
};

/**
 * CON-197 — server-persisted UI state slice for the settings page. Lives
 * under `settings.ui_state`. Other UI-state keys are tolerated and
 * preserved by PATCH callers via a shallow merge.
 */
type SettingsUiState = {
  migrate_banner_dismissed_at?: string | null;
  migration_confirmation_seen_at?: string | null;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<TenantSettings>({});
  const [forumConfigPopulated, setForumConfigPopulated] =
    useState<ForumConfigPopulated>({});
  const [uiState, setUiState] = useState<SettingsUiState>({});
  const [loading, setLoading] = useState(true);
  const [siteName, setSiteName] = useState("");
  const [domain, setDomain] = useState("");
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [generalSaved, setGeneralSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/settings/forum-config")
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ])
      .then(([data, forumConfigData]) => {
        setSettings(data.settings ?? {});
        setUiState(extractUiState(data.settings));
        if (data.tenant) {
          setSiteName(data.tenant.name ?? "");
          setDomain(data.tenant.domain ?? "");
        }
        setForumConfigPopulated(
          deriveForumConfigPopulated(forumConfigData?.forumConfigRaw),
        );
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSaveGeneral() {
    setSavingGeneral(true);
    setGeneralSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: siteName, domain }),
      });
      const data = await res.json();
      if (data.tenant) {
        setSiteName(data.tenant.name ?? "");
        setDomain(data.tenant.domain ?? "");
      }
      if (data.settings) setSettings(data.settings);
      setGeneralSaved(true);
      setTimeout(() => setGeneralSaved(false), 3000);
    } catch (err) {
      console.error("Failed to save general settings:", err);
    } finally {
      setSavingGeneral(false);
    }
  }

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
        <MigrationConfirmationNote
          show={
            anyForumConfigSlicePopulated(forumConfigPopulated) &&
            !uiState.migration_confirmation_seen_at
          }
          onDismiss={() => {
            const seenAt = new Date().toISOString();
            const next: SettingsUiState = {
              ...uiState,
              migration_confirmation_seen_at: seenAt,
            };
            setUiState(next);
            void patchUiState(next).catch(() => {
              // Optimistic UI — revert on failure so we offer the note again.
              setUiState((prev) => ({
                ...prev,
                migration_confirmation_seen_at: null,
              }));
            });
          }}
        />

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
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Domain
              </label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="example.com"
                className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveGeneral}
                disabled={savingGeneral}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                {savingGeneral ? "Saving..." : "Save"}
              </button>
              {generalSaved && (
                <span className="text-sm text-green-600">✓ Saved</span>
              )}
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

        {/* Forum config (persona, qualifying, allowed topics, follow-up) */}
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Chatbot behaviour
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Persona, qualifying questions, allowed topics, and follow-up policy.
          </p>
          <div className="mt-4">
            <Link
              href="/dashboard/settings/forum-config"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Open forum config editor
              <span aria-hidden>→</span>
            </Link>
          </div>
        </section>

        {/* Guardrails */}
        <GuardrailsSection
          settings={settings}
          onUpdate={setSettings}
        />

        {/* Notifications */}
        <NotificationsSection settings={settings} onUpdate={setSettings} />

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

function deriveForumConfigPopulated(raw: unknown): ForumConfigPopulated {
  const forumConfig =
    typeof raw === "object" && raw !== null && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const aiPersona =
    typeof forumConfig.ai_persona === "object" &&
    forumConfig.ai_persona !== null &&
    !Array.isArray(forumConfig.ai_persona)
      ? (forumConfig.ai_persona as Record<string, unknown>)
      : null;
  const qualifyingQuestions =
    typeof forumConfig.qualifying_questions === "object" &&
    forumConfig.qualifying_questions !== null &&
    !Array.isArray(forumConfig.qualifying_questions)
      ? (forumConfig.qualifying_questions as Record<string, unknown>)
      : null;
  const followUp =
    typeof forumConfig.follow_up === "object" &&
    forumConfig.follow_up !== null &&
    !Array.isArray(forumConfig.follow_up)
      ? (forumConfig.follow_up as Record<string, unknown>)
      : null;

  return {
    ai_persona:
      !!aiPersona &&
      (typeof aiPersona.voice_description === "string"
        ? aiPersona.voice_description.trim().length > 0
        : Object.keys(aiPersona).length > 0),
    qualifying_questions: hasQualifyingQuestionsPopulated(qualifyingQuestions),
    allowed_topics:
      Array.isArray(forumConfig.allowed_topics) &&
      forumConfig.allowed_topics.length > 0,
    follow_up: hasFollowUpPopulated(followUp),
  };
}

function hasQualifyingQuestionsPopulated(
  slice: Record<string, unknown> | null,
): boolean {
  if (!slice) return false;
  const questions = slice.questions;
  if (Array.isArray(questions) && questions.length > 0) return true;
  // Some tenants persist legacy shapes — treat any non-default key as populated.
  return Object.keys(slice).some((k) => k !== "questions");
}

function hasFollowUpPopulated(slice: Record<string, unknown> | null): boolean {
  if (!slice) return false;
  // Treat the slice as populated once any author-editable sub-key has a value.
  // The schema defaults are empty objects/arrays, so any non-empty content here
  // means the tenant has explicitly configured follow-up.
  return Object.entries(slice).some(([, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === "object") {
      return Object.keys(value as Record<string, unknown>).length > 0;
    }
    return value !== undefined && value !== null && value !== "";
  });
}

function extractUiState(rawSettings: unknown): SettingsUiState {
  if (!rawSettings || typeof rawSettings !== "object") return {};
  const ui = (rawSettings as Record<string, unknown>).ui_state;
  if (!ui || typeof ui !== "object" || Array.isArray(ui)) return {};
  const obj = ui as Record<string, unknown>;
  return {
    migrate_banner_dismissed_at:
      typeof obj.migrate_banner_dismissed_at === "string"
        ? obj.migrate_banner_dismissed_at
        : null,
    migration_confirmation_seen_at:
      typeof obj.migration_confirmation_seen_at === "string"
        ? obj.migration_confirmation_seen_at
        : null,
  };
}

async function patchUiState(next: SettingsUiState): Promise<void> {
  // Fetch current settings.ui_state first so we don't clobber other UI flags
  // owned by adjacent features. /api/settings PATCH does a shallow merge at
  // the top level, so ui_state itself needs to be merged client-side.
  let currentUiState: Record<string, unknown> = {};
  try {
    const res = await fetch("/api/settings");
    if (res.ok) {
      const data = await res.json();
      const settings = (data?.settings ?? {}) as Record<string, unknown>;
      const ui = settings.ui_state;
      if (ui && typeof ui === "object" && !Array.isArray(ui)) {
        currentUiState = ui as Record<string, unknown>;
      }
    }
  } catch {
    // Best-effort — fall through with empty current state.
  }
  const mergedUiState = { ...currentUiState, ...next };
  const res = await fetch("/api/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ui_state: mergedUiState }),
  });
  if (!res.ok) {
    throw new Error(`PATCH /api/settings failed (${res.status})`);
  }
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
    scale: { conversations: 10000, articles: 200 },
  }[plan] ?? { conversations: 500, articles: 10 };

  async function handleUpgrade(targetPlan: "growth" | "scale") {
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
            <p className="font-medium text-slate-900">Scale</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">$149<span className="text-sm font-normal text-slate-500">/mo</span></p>
            <ul className="mt-3 space-y-1 text-sm text-slate-500">
              <li>✓ 10,000 conversations/mo</li>
              <li>✓ 200 articles/mo</li>
              <li>✓ Custom branding</li>
              <li>✓ Priority support</li>
            </ul>
            <button
              onClick={() => handleUpgrade("scale")}
              disabled={upgrading}
              className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {upgrading ? "Redirecting..." : "Upgrade to Scale"}
            </button>
          </div>
        </div>
      )}

      {plan !== "starter" && plan !== "scale" && (
        <div className="mt-6">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">Scale</p>
                <p className="text-sm text-slate-500">$149/mo — 10,000 conversations, 200 articles</p>
              </div>
              <button
                onClick={() => handleUpgrade("scale")}
                disabled={upgrading}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {upgrading ? "Redirecting..." : "Upgrade to Scale"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Guardrails Section ──────────────────────────────────────

function GuardrailsSection({
  settings,
  onUpdate,
}: {
  settings: TenantSettings;
  onUpdate: (s: TenantSettings) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [guardrails, setGuardrails] = useState<GuardrailsConfig>(
    settings.guardrails ?? {
      audiences: [],
      topicBoundaries: { deflect: [], hardBlock: [] },
      conversationLimits: { maxTurnsBeforeCTA: 5, idleTimeoutMinutes: 10 },
    }
  );
  const [editingAudience, setEditingAudience] = useState<number | null>(null);

  async function saveGuardrails(updated: GuardrailsConfig) {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guardrails: updated }),
      });
      const data = await res.json();
      onUpdate(data.settings);
    } catch (err) {
      console.error("Failed to save guardrails:", err);
    } finally {
      setSaving(false);
    }
  }

  function addAudience() {
    const newAudience: AudienceConfig = {
      id: `audience-${Date.now()}`,
      name: "",
      urlPatterns: ["*"],
      persona: "",
      ctaMessages: [],
      ctaAfterTurns: 5,
    };
    const updated = {
      ...guardrails,
      audiences: [...guardrails.audiences, newAudience],
    };
    setGuardrails(updated);
    setEditingAudience(updated.audiences.length - 1);
  }

  function updateAudience(index: number, audience: AudienceConfig) {
    const audiences = [...guardrails.audiences];
    audiences[index] = audience;
    const updated = { ...guardrails, audiences };
    setGuardrails(updated);
  }

  function removeAudience(index: number) {
    const audiences = guardrails.audiences.filter((_, i) => i !== index);
    const updated = { ...guardrails, audiences };
    setGuardrails(updated);
    setEditingAudience(null);
    saveGuardrails(updated);
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900">Audiences</h2>
      <p className="mt-1 text-sm text-slate-500">
        URL-routed audience targeting. Each audience matches one or more page
        URL patterns and is consumed by chat (and future surfaces like blog)
        for per-audience CTAs and tone.
      </p>

      {/* Audiences */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Audiences</h3>
          <button
            onClick={addAudience}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            + Add Audience
          </button>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Audiences are URL-pattern-routed targeting and apply across chat and
          future surfaces (for example, blogs). Chat config references the
          matched audience persona when forumConfig voice is empty.
        </p>

        <div className="mt-3 space-y-3">
          {guardrails.audiences.map((audience, idx) => (
            <div
              key={audience.id}
              className="rounded-lg border border-slate-200 p-4"
            >
              <div className="flex items-center justify-between">
                <p className="font-medium text-slate-900">
                  {audience.name || "Unnamed Audience"}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setEditingAudience(editingAudience === idx ? null : idx)
                    }
                    className="text-sm text-slate-500 hover:text-slate-700"
                  >
                    {editingAudience === idx ? "Collapse" : "Edit"}
                  </button>
                  <button
                    onClick={() => removeAudience(idx)}
                    className="text-sm text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              </div>

              {editingAudience === idx && (
                <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                  <FormField label="Audience Name">
                    <input
                      type="text"
                      value={audience.name}
                      onChange={(e) =>
                        updateAudience(idx, {
                          ...audience,
                          name: e.target.value,
                        })
                      }
                      placeholder="e.g. Buyer, Breeder"
                      className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </FormField>
                  <FormField
                    label="URL Patterns"
                    hint='Comma-separated. Use * as wildcard. e.g. "/breeders*,/list-your-puppies*"'
                  >
                    <input
                      type="text"
                      value={audience.urlPatterns.join(",")}
                      onChange={(e) =>
                        updateAudience(idx, {
                          ...audience,
                          urlPatterns: e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="*"
                      className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </FormField>
                  <FormField
                    label="CTA Messages"
                    hint="One per line. These will be naturally inserted after the turn threshold."
                  >
                    <textarea
                      value={audience.ctaMessages.join("\n")}
                      onChange={(e) =>
                        updateAudience(idx, {
                          ...audience,
                          ctaMessages: e.target.value
                            .split("\n")
                            .filter(Boolean),
                        })
                      }
                      rows={3}
                      placeholder="Browse breeders →&#10;Join waitlist"
                      className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </FormField>
                  <FormField label="CTA After Turns">
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={audience.ctaAfterTurns}
                      onChange={(e) =>
                        updateAudience(idx, {
                          ...audience,
                          ctaAfterTurns: parseInt(e.target.value) || 5,
                        })
                      }
                      className="mt-1 w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </FormField>
                </div>
              )}
            </div>
          ))}

          {guardrails.audiences.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
              No audiences configured. Add one to enable URL-routed targeting.
            </div>
          )}
        </div>
      </div>

      {/* CON-202 — Topic Boundaries section removed; allowed_topics is now
          managed in Chat Config > Topic scope (forumConfig). CON-204 — the
          buildSystemPrompt legacy union over settings.guardrails.topicBoundaries.allow
          was also removed; forumConfig.allowed_topics (plus the still-live
          widget.allowedTopics embed path) are the only sources now. Any
          residual `allow` data in tenant JSON blobs is harmlessly ignored. */}

      {/* Save */}
      <div className="mt-6 flex gap-2">
        <button
          onClick={() => saveGuardrails(guardrails)}
          disabled={saving}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : "Save Audiences"}
        </button>
      </div>
    </section>
  );
}

// ─── Notifications Section ───────────────────────────────────

function NotificationsSection({
  settings,
  onUpdate,
}: {
  settings: TenantSettings;
  onUpdate: (s: TenantSettings) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);

  const [notifications, setNotifications] = useState<NotificationsConfig>(
    settings.notifications ?? {
      enabled: false,
      telegram: { botToken: "", chatId: "" },
      mode: "all",
    }
  );

  async function saveNotifications(updated: NotificationsConfig) {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifications: updated }),
      });
      const data = await res.json();
      onUpdate(data.settings);
    } catch (err) {
      console.error("Failed to save notifications:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/test-notification", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botToken: notifications.telegram?.botToken,
          chatId: notifications.telegram?.chatId,
          tenantName: "Your Site",
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
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900">Notifications</h2>
      <p className="mt-1 text-sm text-slate-500">
        Get notified when new conversations start.
      </p>

      <div className="mt-4 space-y-4">
        {/* Enable toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700">
              Enable notifications
            </p>
            <p className="text-xs text-slate-400">
              Receive alerts when visitors start chatting.
            </p>
          </div>
          <button
            onClick={() => {
              const updated = {
                ...notifications,
                enabled: !notifications.enabled,
              };
              setNotifications(updated);
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              notifications.enabled ? "bg-green-600" : "bg-slate-200"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                notifications.enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {notifications.enabled && (
          <>
            {/* Mode */}
            <FormField label="Mode">
              <select
                value={notifications.mode}
                onChange={(e) => {
                  const updated = {
                    ...notifications,
                    mode: e.target.value as "all" | "digest" | "off",
                  };
                  setNotifications(updated);
                }}
                className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="all">All — notify on every conversation</option>
                <option value="digest">
                  Digest — periodic summary (coming soon)
                </option>
                <option value="off">Off</option>
              </select>
            </FormField>

            {/* Telegram */}
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="font-medium text-slate-900">Telegram</p>
              <div className="mt-3 space-y-3">
                <FormField
                  label="Bot Token"
                  hint="Create a bot via @BotFather on Telegram"
                >
                  <input
                    type="password"
                    value={notifications.telegram?.botToken ?? ""}
                    onChange={(e) => {
                      const updated = {
                        ...notifications,
                        telegram: {
                          ...notifications.telegram,
                          botToken: e.target.value,
                          chatId: notifications.telegram?.chatId ?? "",
                        },
                      };
                      setNotifications(updated);
                    }}
                    placeholder="123456:ABC-DEF..."
                    className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </FormField>
                <FormField
                  label="Chat ID"
                  hint="Your Telegram user or group chat ID"
                >
                  <input
                    type="text"
                    value={notifications.telegram?.chatId ?? ""}
                    onChange={(e) => {
                      const updated = {
                        ...notifications,
                        telegram: {
                          ...notifications.telegram,
                          botToken: notifications.telegram?.botToken ?? "",
                          chatId: e.target.value,
                        },
                      };
                      setNotifications(updated);
                    }}
                    placeholder="-1001234567890"
                    className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </FormField>
                <div className="flex gap-2">
                  <button
                    onClick={handleTest}
                    disabled={
                      testing ||
                      !notifications.telegram?.botToken ||
                      !notifications.telegram?.chatId
                    }
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                  >
                    {testing ? "Sending..." : "Test Notification"}
                  </button>
                </div>
                <TestResultBanner result={testResult} />
              </div>
            </div>
          </>
        )}

        {/* Save */}
        <div className="flex gap-2">
          <button
            onClick={() => saveNotifications(notifications)}
            disabled={saving}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save Notifications"}
          </button>
        </div>
      </div>
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
