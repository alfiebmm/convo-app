"use client";

import { useState, useEffect } from "react";
import { APP_CONFIG } from "@/config/app";

interface WidgetConfig {
  chatbotName: string;
  welcomeMessage: string;
  systemPrompt: string;
  primaryColor: string;
  allowedTopics: string;
}

interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
}

const DEFAULT_WIDGET: WidgetConfig = {
  chatbotName: APP_CONFIG.name,
  welcomeMessage: "Hi! How can I help you today?",
  systemPrompt:
    "You are a helpful assistant for this website. Answer questions based on the site content. Be friendly and concise.",
  primaryColor: APP_CONFIG.branding.primary,
  allowedTopics: "",
};

export default function WidgetPage() {
  const [config, setConfig] = useState<WidgetConfig>(DEFAULT_WIDGET);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.tenant) setTenant(data.tenant);
        const w = data.settings?.widget as Partial<WidgetConfig> | undefined;
        if (w) {
          setConfig({
            chatbotName: w.chatbotName ?? DEFAULT_WIDGET.chatbotName,
            welcomeMessage: w.welcomeMessage ?? DEFAULT_WIDGET.welcomeMessage,
            systemPrompt: w.systemPrompt ?? DEFAULT_WIDGET.systemPrompt,
            primaryColor: w.primaryColor ?? DEFAULT_WIDGET.primaryColor,
            allowedTopics: w.allowedTopics ?? DEFAULT_WIDGET.allowedTopics,
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ widget: config }),
      });
      const data = await res.json();
      if (data.tenant) setTenant(data.tenant);
      // Re-sync from response
      const w = data.settings?.widget as Partial<WidgetConfig> | undefined;
      if (w) {
        setConfig({
          chatbotName: w.chatbotName ?? DEFAULT_WIDGET.chatbotName,
          welcomeMessage: w.welcomeMessage ?? DEFAULT_WIDGET.welcomeMessage,
          systemPrompt: w.systemPrompt ?? DEFAULT_WIDGET.systemPrompt,
          primaryColor: w.primaryColor ?? DEFAULT_WIDGET.primaryColor,
          allowedTopics: w.allowedTopics ?? DEFAULT_WIDGET.allowedTopics,
        });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Failed to save widget config:", err);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
      </div>
    );
  }

  const tenantSlug = tenant?.slug ?? "YOUR_TENANT_SLUG";
  const tenantId = tenant?.id ?? "YOUR_TENANT_ID";
  const hubUrl = `${APP_CONFIG.url}/${tenantSlug}`;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Widget</h1>
      <p className="mt-1 text-sm text-slate-500">
        Configure and install your {APP_CONFIG.name} chatbot widget.
      </p>

      {/* Install snippet */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">Installation</h2>
        <p className="mt-2 text-sm text-slate-500">
          Add this snippet before the closing{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
            &lt;/body&gt;
          </code>{" "}
          tag on your website.
        </p>
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-900 p-4">
          <pre className="text-sm text-green-400 overflow-x-auto">
            {`<script
  src="${APP_CONFIG.url}/widget.js"
  data-tenant="${tenantId}"
  async
></script>`}
          </pre>
        </div>
      </div>

      {/* Content Hub */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">Content Hub</h2>
        <p className="mt-2 text-sm text-slate-500">
          Your published Q&amp;A content is publicly browsable at your hosted
          hub.
        </p>
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-6">
          <label className="block text-sm font-medium text-slate-700">
            Your content hub
          </label>
          <div className="mt-2 flex items-center gap-3">
            <code className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {hubUrl}
            </code>
            <a
              href={hubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
            >
              View Hub →
            </a>
          </div>
        </div>
      </div>

      {/* Widget Config */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">Configuration</h2>
        <div className="mt-4 space-y-6 rounded-lg border border-slate-200 bg-white p-6">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Chatbot Name
            </label>
            <input
              type="text"
              value={config.chatbotName}
              onChange={(e) =>
                setConfig((c) => ({ ...c, chatbotName: e.target.value }))
              }
              className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Welcome Message
            </label>
            <input
              type="text"
              value={config.welcomeMessage}
              onChange={(e) =>
                setConfig((c) => ({ ...c, welcomeMessage: e.target.value }))
              }
              className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Persona / System Prompt
            </label>
            <textarea
              rows={4}
              value={config.systemPrompt}
              onChange={(e) =>
                setConfig((c) => ({ ...c, systemPrompt: e.target.value }))
              }
              className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Primary Colour
            </label>
            <div className="mt-1 flex items-center gap-3">
              <input
                type="color"
                value={config.primaryColor}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, primaryColor: e.target.value }))
                }
                className="h-10 w-16 rounded border border-slate-200"
              />
              <span className="text-sm text-slate-500 font-mono">
                {config.primaryColor}
              </span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Allowed Topics
            </label>
            <input
              type="text"
              value={config.allowedTopics}
              onChange={(e) =>
                setConfig((c) => ({ ...c, allowedTopics: e.target.value }))
              }
              placeholder="e.g. breed info, pricing, care tips (comma-separated, leave empty for all)"
              className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-slate-400">
              Comma-separated list. Leave empty to allow all topics.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "Save Configuration"}
            </button>
            {saved && (
              <span className="text-sm text-green-600">✓ Saved</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
