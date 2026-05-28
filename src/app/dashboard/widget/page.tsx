"use client";

import { useState, useEffect } from "react";
import { APP_CONFIG } from "@/config/app";

type WidgetPosition = "bottom-left" | "bottom-right";
type WidgetSize = "sm" | "md" | "lg";

const WIDGET_POSITIONS: ReadonlyArray<{
  value: WidgetPosition;
  label: string;
}> = [
  { value: "bottom-right", label: "Bottom right" },
  { value: "bottom-left", label: "Bottom left" },
];

const WIDGET_SIZES: ReadonlyArray<{ value: WidgetSize; label: string }> = [
  { value: "sm", label: "Small" },
  { value: "md", label: "Medium" },
  { value: "lg", label: "Large" },
];

const HEX_COLOUR_RE = /^#[0-9a-fA-F]{6}$/;

interface WidgetConfig {
  chatbotName: string;
  welcomeMessage: string;
  systemPrompt: string;
  primaryColor: string;
  position: WidgetPosition;
  size: WidgetSize;
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
  position: "bottom-right",
  size: "md",
};

function normalisePosition(v: unknown): WidgetPosition {
  return v === "bottom-left" || v === "bottom-right"
    ? v
    : DEFAULT_WIDGET.position;
}

function normaliseSize(v: unknown): WidgetSize {
  return v === "sm" || v === "md" || v === "lg" ? v : DEFAULT_WIDGET.size;
}

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
            position: normalisePosition(w.position),
            size: normaliseSize(w.size),
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
          position: normalisePosition(w.position),
          size: normaliseSize(w.size),
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
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <input
                type="color"
                value={
                  HEX_COLOUR_RE.test(config.primaryColor)
                    ? config.primaryColor
                    : DEFAULT_WIDGET.primaryColor
                }
                onChange={(e) =>
                  setConfig((c) => ({ ...c, primaryColor: e.target.value }))
                }
                aria-label="Pick widget primary colour"
                className="h-10 w-16 rounded border border-slate-200"
              />
              <input
                type="text"
                value={config.primaryColor}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, primaryColor: e.target.value }))
                }
                placeholder="#FF6B2C"
                aria-label="Widget primary colour hex value"
                className="w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
              />
              {!HEX_COLOUR_RE.test(config.primaryColor) && (
                <span className="text-xs text-amber-600">
                  Use a 6-digit hex like #FF6B2C
                </span>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Position
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {WIDGET_POSITIONS.map((opt) => {
                const active = config.position === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setConfig((c) => ({ ...c, position: opt.value }))
                    }
                    aria-pressed={active}
                    className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                      active
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Where the chat bubble sits on the visitor’s screen.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Size
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {WIDGET_SIZES.map((opt) => {
                const active = config.size === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setConfig((c) => ({ ...c, size: opt.value }))
                    }
                    aria-pressed={active}
                    className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                      active
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Controls the bubble dimensions. Medium suits most sites.
            </p>
          </div>
          <p className="text-xs text-slate-400">
            Looking for topic restrictions, deflect rules, or audience
            personas? Those live under{" "}
            <a
              href="/dashboard/settings"
              className="text-blue-600 underline hover:text-blue-700"
            >
              Settings → Topic Boundaries
            </a>
            .
          </p>
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
