"use client";

import { useState, useCallback } from "react";
import { PersonaPanel } from "./panels/persona-panel";
import { QualifyingPanel } from "./panels/qualifying-panel";
import { AllowedTopicsPanel } from "./panels/allowed-topics-panel";
import { FollowUpPanel } from "./panels/follow-up-panel";
import type { AuthoringSliceKey, ForumConfigRaw } from "./types";

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
}: {
  initialForumConfig: ForumConfigRaw;
}) {
  const [activeTab, setActiveTab] = useState<AuthoringSliceKey>("ai_persona");
  const [forumConfig, setForumConfig] =
    useState<ForumConfigRaw>(initialForumConfig);

  const handleSliceSaved = useCallback(
    (slice: AuthoringSliceKey, value: unknown) => {
      setForumConfig((prev) => ({ ...prev, [slice]: value }));
    },
    [],
  );

  return (
    <div>
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
