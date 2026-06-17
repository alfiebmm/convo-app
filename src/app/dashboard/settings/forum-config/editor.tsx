"use client";

import { useState, useCallback } from "react";
import { PersonaPanel } from "./panels/persona-panel";
import { QualifyingPanel } from "./panels/qualifying-panel";
import { AllowedTopicsPanel } from "./panels/allowed-topics-panel";
import { FollowUpPanel } from "./panels/follow-up-panel";
import type { AuthoringSliceKey, ForumConfigRaw } from "./types";

/**
 * CON-192 auto-copy notice — shown when page.tsx pre-filled the editor from
 * legacy widget/guardrails fields. The tenant has NOT engaged with the new
 * editor yet; we want them to review, tweak, and click Save to make the
 * pre-filled values the persisted source of truth.
 */
function AutoCopiedNotice({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      role="status"
      className="mb-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
    >
      <span aria-hidden className="mt-0.5">
        ✨
      </span>
      <div className="flex-1">
        <p className="font-medium">Pre-filled from your existing chatbot settings.</p>
        <p className="mt-1 text-amber-800">
          We&apos;ve copied your persona prompt and allowed topics from the
          legacy Settings page. Review each tab and click Save on the panels
          you want to keep — once saved, this becomes the source of truth and
          the legacy fields are ignored.
        </p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded-md p-1 text-amber-700 hover:bg-amber-100"
        aria-label="Dismiss notice"
      >
        ✕
      </button>
    </div>
  );
}

const TABS: { key: AuthoringSliceKey; label: string; description: string }[] = [
  {
    key: "ai_persona",
    label: "Persona",
    description: "Tone, voice, banned words.",
  },
  {
    key: "qualifying_questions",
    label: "Qualifying questions",
    description: "What the bot asks visitors up front.",
  },
  {
    key: "allowed_topics",
    label: "Allowed topics",
    description: "What the bot will and won't talk about.",
  },
  {
    key: "follow_up",
    label: "Follow-up",
    description: "Rules, capture policies, contact methods, destinations.",
  },
];

export function ForumConfigEditor({
  initialForumConfig,
  autoCopied = false,
}: {
  initialForumConfig: ForumConfigRaw;
  /**
   * CON-192: true when page.tsx pre-filled the initial form state from
   * legacy widget/guardrails fields because the tenant has no forumConfig
   * yet. Surfaces an inline review-and-save notice above the tabs.
   */
  autoCopied?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<AuthoringSliceKey>("ai_persona");
  const [forumConfig, setForumConfig] =
    useState<ForumConfigRaw>(initialForumConfig);
  const [showAutoCopiedNotice, setShowAutoCopiedNotice] = useState(autoCopied);

  const handleSliceSaved = useCallback(
    (slice: AuthoringSliceKey, value: unknown) => {
      setForumConfig((prev) => ({ ...prev, [slice]: value }));
      // First save closes the pre-fill notice — the tenant has now engaged.
      setShowAutoCopiedNotice(false);
    },
    [],
  );

  return (
    <div>
      {showAutoCopiedNotice && (
        <AutoCopiedNotice onDismiss={() => setShowAutoCopiedNotice(false)} />
      )}
      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Forum config sections"
        className="flex flex-wrap gap-2 border-b border-zinc-200"
      >
        {TABS.map((t) => {
          const active = t.key === activeTab;
          return (
            <button
              key={t.key}
              role="tab"
              type="button"
              aria-selected={active}
              aria-controls={`panel-${t.key}`}
              id={`tab-${t.key}`}
              onClick={() => setActiveTab(t.key)}
              className={
                "px-4 py-2 -mb-px text-sm font-medium border-b-2 transition-colors " +
                (active
                  ? "border-[#FF6B2C] text-zinc-900"
                  : "border-transparent text-zinc-500 hover:text-zinc-900")
              }
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-zinc-500">
        {TABS.find((t) => t.key === activeTab)?.description}
      </p>

      <div className="mt-6">
        {activeTab === "ai_persona" && (
          <div
            role="tabpanel"
            id="panel-ai_persona"
            aria-labelledby="tab-ai_persona"
          >
            <PersonaPanel
              initialValue={forumConfig.ai_persona}
              onSaved={(v) => handleSliceSaved("ai_persona", v)}
            />
          </div>
        )}
        {activeTab === "qualifying_questions" && (
          <div
            role="tabpanel"
            id="panel-qualifying_questions"
            aria-labelledby="tab-qualifying_questions"
          >
            <QualifyingPanel
              initialValue={forumConfig.qualifying_questions}
              onSaved={(v) => handleSliceSaved("qualifying_questions", v)}
            />
          </div>
        )}
        {activeTab === "allowed_topics" && (
          <div
            role="tabpanel"
            id="panel-allowed_topics"
            aria-labelledby="tab-allowed_topics"
          >
            <AllowedTopicsPanel
              initialValue={forumConfig.allowed_topics}
              onSaved={(v) => handleSliceSaved("allowed_topics", v)}
            />
          </div>
        )}
        {activeTab === "follow_up" && (
          <div
            role="tabpanel"
            id="panel-follow_up"
            aria-labelledby="tab-follow_up"
          >
            <FollowUpPanel
              initialValue={forumConfig.follow_up}
              onSaved={(v) => handleSliceSaved("follow_up", v)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
