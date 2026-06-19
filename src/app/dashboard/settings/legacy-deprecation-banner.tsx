"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export type LegacyBannerSurface =
  | "widget-prompt"
  | "audience-persona"
  | "allowed-topics";

/**
 * Slice population flags consumed by the auto-hide logic.
 *
 * CON-197 extends this beyond `ai_persona` / `allowed_topics` so the banner
 * disappears on the Settings page as soon as a tenant has any forum-config
 * authoring slice populated — at that point there's nothing left to migrate
 * and the banner is just noise.
 */
export type ForumConfigPopulated = {
  ai_persona?: boolean;
  qualifying_questions?: boolean;
  allowed_topics?: boolean;
  follow_up?: boolean;
};

export function getLegacyBannerDismissalKey(
  tenantId: string,
  surface: LegacyBannerSurface,
) {
  return `convo:legacy-banner-dismissed:${tenantId}:${surface}`;
}

/**
 * CON-197 — once any forum-config authoring slice is populated, the tenant
 * is on the new system and there is nothing to migrate. Hide every legacy
 * deprecation banner surface in that case. The original per-surface checks
 * are kept for back-compat in case a partial migration leaves only the
 * surface-specific slice populated.
 */
export function shouldAutoHideLegacyBanner(
  surface: LegacyBannerSurface,
  forumConfigPopulated?: ForumConfigPopulated,
) {
  if (!forumConfigPopulated) return false;
  if (anyForumConfigSlicePopulated(forumConfigPopulated)) {
    return true;
  }
  if (
    (surface === "widget-prompt" || surface === "audience-persona") &&
    forumConfigPopulated.ai_persona
  ) {
    return true;
  }
  return surface === "allowed-topics" && !!forumConfigPopulated.allowed_topics;
}

/**
 * True if any of the four authoring slices report as populated. Used by both
 * the auto-hide check and the "you're on the new chat config" confirmation
 * toast.
 */
export function anyForumConfigSlicePopulated(
  forumConfigPopulated?: ForumConfigPopulated,
) {
  if (!forumConfigPopulated) return false;
  return (
    !!forumConfigPopulated.ai_persona ||
    !!forumConfigPopulated.qualifying_questions ||
    !!forumConfigPopulated.allowed_topics ||
    !!forumConfigPopulated.follow_up
  );
}

export function isLegacyBannerDismissed(
  storage: Pick<Storage, "getItem">,
  tenantId: string,
  surface: LegacyBannerSurface,
) {
  return storage.getItem(getLegacyBannerDismissalKey(tenantId, surface)) === "1";
}

export function persistLegacyBannerDismissal(
  storage: Pick<Storage, "setItem">,
  tenantId: string,
  surface: LegacyBannerSurface,
) {
  storage.setItem(getLegacyBannerDismissalKey(tenantId, surface), "1");
}

/**
 * CON-192 / CON-197 — Deprecation banner for the three legacy persona/topic
 * surfaces:
 *
 *   1. Widget page → Persona / System Prompt textarea (settings.widget.systemPrompt)
 *   2. Settings page → Audience persona textarea (settings.guardrails.audiences[].persona)
 *   3. Settings page → Allowed Topics input (settings.guardrails.topicBoundaries.allow)
 *
 * Behaviour:
 *   - Auto-hides when ANY forum-config authoring slice is populated.
 *   - "Migrate now" button POSTs the current page's settings to the same
 *     legacy→forumConfig transform used by the editor pre-fill, then PATCHes
 *     /api/settings/forum-config to persist the result. On success, the
 *     banner switches to a "✓ Migrated" state and links the tenant to the
 *     forum-config editor to review.
 *   - Manual dismiss persists across reloads. Persistence is primarily
 *     server-side (settings.ui_state.migrate_banner_dismissed_at via an
 *     onDismissPersist callback supplied by the parent) and falls back to
 *     localStorage for resilience when the parent has not wired persistence.
 *
 * The banner does not delete the legacy field — that's a separate cleanup
 * (CON-???) once we're confident every tenant has migrated.
 */
export function LegacyDeprecationBanner({
  surface,
  tenantId,
  forumConfigPopulated,
  dismissedAtFromServer,
  onDismissPersist,
  className = "",
}: {
  surface: LegacyBannerSurface;
  tenantId?: string;
  forumConfigPopulated?: ForumConfigPopulated;
  /**
   * ISO timestamp of the server-side dismissal, if known. Truthy values are
   * treated as "already dismissed" and the banner stays hidden across
   * reloads. Optional — falls back to localStorage when undefined.
   */
  dismissedAtFromServer?: string | null;
  /**
   * Optional persist hook called when the operator clicks dismiss. Receives
   * the surface so the parent can keep per-surface state if it wants. The
   * banner still updates local state and localStorage regardless of whether
   * a persist hook is supplied, so the UI never feels broken if the network
   * call fails.
   */
  onDismissPersist?: (surface: LegacyBannerSurface) => void;
  className?: string;
}) {
  const [migrating, setMigrating] = useState(false);
  const [migrated, setMigrated] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (dismissedAtFromServer) {
      setHidden(true);
      return;
    }
    if (!tenantId) return;
    try {
      if (isLegacyBannerDismissed(window.localStorage, tenantId, surface)) {
        setHidden(true);
      }
    } catch {
      // localStorage can be unavailable in private contexts. Keep the banner usable.
    }
  }, [surface, tenantId, dismissedAtFromServer]);

  if (
    !tenantId ||
    hidden ||
    shouldAutoHideLegacyBanner(surface, forumConfigPopulated)
  ) {
    return null;
  }
  const resolvedTenantId = tenantId;

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
      try {
        persistLegacyBannerDismissal(
          window.localStorage,
          resolvedTenantId,
          surface,
        );
      } catch {
        // Non-fatal: the inline confirmation still tells the operator it worked.
      }
      onDismissPersist?.(surface);
      setMigrated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setMigrating(false);
    }
  }

  function handleDismiss() {
    try {
      persistLegacyBannerDismissal(window.localStorage, resolvedTenantId, surface);
    } catch {
      // Non-fatal: hiding for this render is still useful.
    }
    onDismissPersist?.(surface);
    setHidden(true);
  }

  if (migrated) {
    return (
      <div
        className={
          "inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 " +
          className
        }
        role="status"
      >
        <span>✓ Migrated to Chatbot Behaviour</span>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded p-0.5 text-emerald-700 hover:bg-emerald-100"
          aria-label="Dismiss migrated confirmation"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div
      className={
        "relative rounded-lg border border-amber-200 bg-amber-50 p-3 pr-10 text-sm text-amber-900 " +
        className
      }
      role="note"
    >
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute right-2 top-2 rounded p-1 text-amber-700 hover:bg-amber-100"
        aria-label="Dismiss legacy migration banner"
      >
        ✕
      </button>
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
        <button
          type="button"
          onClick={handleMigrate}
          disabled={migrating}
          className="rounded-md bg-amber-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-800 disabled:opacity-50 transition-colors"
        >
          {migrating ? "Migrating…" : "Migrate now"}
        </button>
        {error && <span className="text-xs text-red-700">{error}</span>}
      </div>
    </div>
  );
}

/**
 * CON-197 — one-time confirmation note shown on the Settings page when the
 * tenant is already on the new forum-config (any authoring slice populated)
 * AND the `settings.ui_state.migration_confirmation_seen_at` flag is not yet
 * set. Dismissing it calls `onDismiss`, which the parent wires up to a PATCH
 * that persists the seen-at timestamp.
 */
export function MigrationConfirmationNote({
  show,
  onDismiss,
  className = "",
}: {
  show: boolean;
  onDismiss: () => void;
  className?: string;
}) {
  if (!show) return null;
  return (
    <div
      className={
        "relative rounded-lg border border-emerald-200 bg-emerald-50 p-3 pr-10 text-sm text-emerald-800 " +
        className
      }
      role="status"
    >
      <button
        type="button"
        onClick={onDismiss}
        className="absolute right-2 top-2 rounded p-1 text-emerald-700 hover:bg-emerald-100"
        aria-label="Dismiss migration confirmation"
      >
        ✕
      </button>
      <p className="font-medium">✓ You&apos;re on the new chat config.</p>
      <p className="mt-1 text-emerald-700">
        Persona, qualifying questions, allowed topics, and follow-up now live
        under Chatbot Behaviour. The legacy fields below are kept for
        reference and are no longer authoritative.
      </p>
    </div>
  );
}
