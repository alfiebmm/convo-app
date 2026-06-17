"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * CON-192 — Deprecation banner for the three legacy persona/topic surfaces:
 *
 *   1. Widget page → Persona / System Prompt textarea (settings.widget.systemPrompt)
 *   2. Settings page → Audience persona textarea (settings.guardrails.audiences[].persona)
 *   3. Settings page → Allowed Topics input (settings.guardrails.topicBoundaries.allow)
 *
 * Behaviour:
 *   - Always shows the deprecation copy and a link to /dashboard/settings/forum-config.
 *   - "Migrate now" button POSTs the current page's settings to the same
 *     legacy→forumConfig transform used by the editor pre-fill, then PATCHes
 *     /api/settings/forum-config to persist the result. On success, the
 *     banner switches to a "✓ Migrated" state and links the tenant to the
 *     forum-config editor to review.
 *
 * The banner does not delete the legacy field — that's a separate cleanup
 * (CON-???) once we're confident every tenant has migrated.
 */
export function LegacyDeprecationBanner({
  surface,
  className = "",
}: {
  surface: "widget-prompt" | "audience-persona" | "allowed-topics";
  className?: string;
}) {
  const [migrating, setMigrating] = useState(false);
  const [migrated, setMigrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = {
    "widget-prompt": {
      label: "Persona prompt",
      detail:
        "This Widget persona prompt is superseded by the new Chatbot Behaviour → Persona tab. Settings there override this field at runtime.",
    },
    "audience-persona": {
      label: "Audience persona",
      detail:
        "Per-audience personas are superseded by the new Chatbot Behaviour → Persona tab. The forum-config voice description overrides any per-audience persona at runtime.",
    },
    "allowed-topics": {
      label: "Allowed topics",
      detail:
        "Allowed topics now live under Chatbot Behaviour → Allowed topics. Values here are still honoured (merged with the new list) but new edits should go in the new editor.",
    },
  }[surface];

  async function handleMigrate() {
    setMigrating(true);
    setError(null);
    try {
      // 1. Read current settings.
      const settingsRes = await fetch("/api/settings");
      const settingsData = await settingsRes.json();
      const settings = (settingsData?.settings ?? {}) as Record<string, unknown>;

      // 2. Build the legacy draft client-side via the same pure transform.
      const { buildLegacyDraft, mergeLegacyIntoForumConfig } = await import(
        "@/lib/forum-config/transform-legacy"
      );
      const draft = buildLegacyDraft(settings);
      const existing = (settings.forumConfig ?? {}) as Record<string, unknown>;
      const merged = mergeLegacyIntoForumConfig(existing, draft);

      // 3. Persist only the slices that the forum-config API accepts.
      const body: Record<string, unknown> = {};
      const mergedPersona = merged.ai_persona;
      if (mergedPersona && typeof mergedPersona === "object") {
        body.ai_persona = mergedPersona;
      }
      if (Array.isArray(merged.allowed_topics) && merged.allowed_topics.length > 0) {
        body.allowed_topics = merged.allowed_topics;
      }

      if (Object.keys(body).length === 0) {
        setError("Nothing to migrate — no legacy values found on this tenant.");
        setMigrating(false);
        return;
      }

      const res = await fetch("/api/settings/forum-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : `Migration failed (${res.status})`,
        );
        setMigrating(false);
        return;
      }
      setMigrated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setMigrating(false);
    }
  }

  return (
    <div
      className={
        "rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 " +
        className
      }
      role="note"
    >
      <p className="font-medium">
        Deprecated — {copy.label} has moved to Chatbot Behaviour.
      </p>
      <p className="mt-1 text-amber-800">{copy.detail}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Link
          href="/dashboard/settings/forum-config"
          className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 transition-colors"
        >
          Open Chatbot Behaviour →
        </Link>
        {!migrated ? (
          <button
            type="button"
            onClick={handleMigrate}
            disabled={migrating}
            className="rounded-md bg-amber-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-800 disabled:opacity-50 transition-colors"
          >
            {migrating ? "Migrating…" : "Migrate now"}
          </button>
        ) : (
          <span className="text-xs font-medium text-emerald-700">
            ✓ Migrated to Chatbot Behaviour
          </span>
        )}
        {error && <span className="text-xs text-red-700">{error}</span>}
      </div>
    </div>
  );
}
