"use client";

import { useState, useCallback } from "react";
import { PersonaPanel } from "./panels/persona-panel";
import { QualifyingPanel } from "./panels/qualifying-panel";
import { AllowedTopicsPanel } from "./panels/allowed-topics-panel";
import { FollowUpPanel } from "./panels/follow-up-panel";
import { TopicBoundariesPanel } from "./panels/topic-boundaries-panel";
import { ConversationLimitsPanel } from "./panels/conversation-limits-panel";
import type { AuthoringSliceKey, EditorTabKey, ForumConfigRaw } from "./types";

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

/**
 * CON-200 tab order (Cam, 19 Jun): tenants flow Persona → what the bot can
 * talk about → what it asks visitors → conversation length → what happens
 * after. Allowed topics and Topic boundaries are stacked inside one
 * "Topic scope" tab to drop the count from six to five and put both
 * scope controls in one place.
 */
const TABS: { key: EditorTabKey; label: string; description: string }[] = [
  {
    key: "ai_persona",
    label: "Persona",
    description: "How your bot speaks — tone, voice, banned words.",
  },
  {
    key: "topic_scope",
    label: "Topic scope",
    description:
      "What your bot will and won't discuss — allowed topics and boundary rules.",
  },
  {
    key: "qualifying_questions",
    label: "Qualifying",
    description: "Multiple-choice questions the bot asks every new visitor.",
  },
  {
    key: "conversation_limits",
    label: "Limits",
    description: "Maximum turns before the bot offers a CTA, and idle timeout.",
  },
  {
    key: "follow_up",
    label: "Follow-up",
    description:
      "What happens when a visitor needs a human — capture, escalate, route.",
  },
];

export function ForumConfigEditor({
  initialForumConfig,
  initialConversationLimits = {
    maxTurnsBeforeCTA: 5,
    idleTimeoutMinutes: 10,
  },
  initialTopicBoundaries = {
    deflect: [],
    hardBlock: [],
  },
  autoCopied = false,
}: {
  initialForumConfig: ForumConfigRaw;
  initialConversationLimits?: {
    maxTurnsBeforeCTA: number;
    idleTimeoutMinutes: number;
  };
  initialTopicBoundaries?: {
    deflect: { topic: string; response: string }[];
    hardBlock: string[];
  };
  /**
   * CON-192: true when page.tsx pre-filled the initial form state from
   * legacy widget/guardrails fields because the tenant has no forumConfig
   * yet. Surfaces an inline review-and-save notice above the tabs.
   */
  autoCopied?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<EditorTabKey>("ai_persona");
  const [forumConfig, setForumConfig] =
    useState<ForumConfigRaw>(initialForumConfig);
  const [conversationLimits, setConversationLimits] = useState(
    initialConversationLimits,
  );
  const [topicBoundaries, setTopicBoundaries] = useState(initialTopicBoundaries);
  const [showAutoCopiedNotice, setShowAutoCopiedNotice] = useState(autoCopied);

  // CON-200: track per-slice dirty state so tabs can show an unsaved-changes
  // dot when a tenant edits one tab and clicks across to another.
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const setSliceDirty = useCallback((sliceKey: string, isDirty: boolean) => {
    setDirty((prev) => {
      if (prev[sliceKey] === isDirty) return prev;
      return { ...prev, [sliceKey]: isDirty };
    });
  }, []);

  const handleSliceSaved = useCallback(
    (slice: AuthoringSliceKey, value: unknown) => {
      setForumConfig((prev) => ({ ...prev, [slice]: value }));
      // First save closes the pre-fill notice — the tenant has now engaged.
      setShowAutoCopiedNotice(false);
    },
    [],
  );

  // A "topic_scope" tab is dirty if either of its two child slices are dirty.
  const tabDirty: Record<EditorTabKey, boolean> = {
    ai_persona: !!dirty.ai_persona,
    topic_scope: !!dirty.allowed_topics || !!dirty.topic_boundaries,
    qualifying_questions: !!dirty.qualifying_questions,
    conversation_limits: !!dirty.conversation_limits,
    follow_up: !!dirty.follow_up,
  };

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
          const isDirty = tabDirty[t.key];
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
                "inline-flex items-center gap-1.5 px-4 py-2 -mb-px text-sm font-medium border-b-2 transition-colors " +
                (active
                  ? "border-[#FF6B2C] text-zinc-900"
                  : "border-transparent text-zinc-500 hover:text-zinc-900")
              }
            >
              {t.label}
              {isDirty && (
                <span
                  aria-label="unsaved changes"
                  title="Unsaved changes"
                  className="inline-block h-2 w-2 rounded-full bg-[#FF6B2C]"
                />
              )}
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
              onDirtyChange={(d) => setSliceDirty("ai_persona", d)}
            />
          </div>
        )}
        {activeTab === "topic_scope" && (
          <div
            role="tabpanel"
            id="panel-topic_scope"
            aria-labelledby="tab-topic_scope"
            className="space-y-6"
          >
            <AllowedTopicsPanel
              initialValue={forumConfig.allowed_topics}
              onSaved={(v) => handleSliceSaved("allowed_topics", v)}
              onDirtyChange={(d) => setSliceDirty("allowed_topics", d)}
            />
            <TopicBoundariesPanel
              initialValue={topicBoundaries}
              onSaved={setTopicBoundaries}
              onDirtyChange={(d) => setSliceDirty("topic_boundaries", d)}
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
              onDirtyChange={(d) => setSliceDirty("qualifying_questions", d)}
            />
          </div>
        )}
        {activeTab === "conversation_limits" && (
          <div
            role="tabpanel"
            id="panel-conversation_limits"
            aria-labelledby="tab-conversation_limits"
          >
            <ConversationLimitsPanel
              initialValue={conversationLimits}
              onSaved={setConversationLimits}
              onDirtyChange={(d) => setSliceDirty("conversation_limits", d)}
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
              onDirtyChange={(d) => setSliceDirty("follow_up", d)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
