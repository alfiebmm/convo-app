import { redirect } from "next/navigation";
import { getCurrentTenant } from "@/lib/auth-context";
import { ForumConfigEditor } from "./editor";
import {
  buildLegacyDraft,
  hasLegacySignal,
  isForumConfigEmpty,
} from "@/lib/forum-config/transform-legacy";

/**
 * Settings → Forum config (four-slice authoring UI).
 *
 * CON-191 — surfaces what was previously DB-paste-only:
 *   - ai_persona
 *   - qualifying_questions
 *   - allowed_topics
 *   - follow_up (contact methods + capture policies + rules + destinations)
 *
 * CON-192 add-on (Cam, 17 Jun) — auto-copy from legacy: when the tenant
 * has NOT yet engaged with forumConfig but DOES have legacy values in
 * `widget.systemPrompt` / `guardrails.audiences[].persona` /
 * `guardrails.topicBoundaries.allow` / `widget.allowedTopics`, we
 * pre-fill the editor's initial form state from those legacy sources
 * and surface an inline notice so the tenant can review and save without
 * re-typing. Clicking Save persists the pre-filled values as the
 * forumConfig source of truth.
 *
 * Persistence: PATCH /api/settings/forum-config (per-slice atomic write).
 * Read-only follow-up overview remains under Knowledge → Follow-up.
 */
export default async function ForumConfigPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const settings = (tenant.settings ?? {}) as Record<string, unknown>;
  const guardrails = (settings.guardrails ?? {}) as Record<string, unknown>;
  const rawTopicBoundaries = (guardrails.topicBoundaries ?? {}) as Record<
    string,
    unknown
  >;
  const existingForumConfig = (settings.forumConfig ?? {}) as Record<
    string,
    unknown
  >;
  const initialConversationLimits = normaliseConversationLimits(
    guardrails.conversationLimits,
  );
  const initialTopicBoundaries = normaliseTopicBoundaries(rawTopicBoundaries);

  // CON-192 auto-copy gate:
  //   - forumConfig totally empty → safe to pre-fill
  //   - at least one legacy signal worth copying
  // If either fails, render the existing forumConfig as-is.
  const shouldAutoCopy =
    isForumConfigEmpty(existingForumConfig) && hasLegacySignal(settings);

  let initialForumConfig: Record<string, unknown> = existingForumConfig;
  let autoCopied = false;
  if (shouldAutoCopy) {
    const draft = buildLegacyDraft(settings);
    initialForumConfig = {
      ai_persona: draft.ai_persona,
      allowed_topics: draft.allowed_topics,
    };
    autoCopied = true;
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Forum config</h1>
        <p className="mt-1 text-sm text-zinc-500">
          How your chatbot speaks, what it qualifies on, what topics it covers,
          and how it follows up on leads or escalations.
        </p>
      </header>

      <ForumConfigEditor
        initialForumConfig={initialForumConfig}
        initialConversationLimits={initialConversationLimits}
        initialTopicBoundaries={initialTopicBoundaries}
        autoCopied={autoCopied}
      />
    </div>
  );
}

function normaliseConversationLimits(raw: unknown) {
  const value =
    typeof raw === "object" && raw !== null && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  return {
    maxTurnsBeforeCTA:
      typeof value.maxTurnsBeforeCTA === "number"
        ? value.maxTurnsBeforeCTA
        : 5,
    idleTimeoutMinutes:
      typeof value.idleTimeoutMinutes === "number"
        ? value.idleTimeoutMinutes
        : 10,
  };
}

function normaliseTopicBoundaries(raw: Record<string, unknown>) {
  return {
    deflect: Array.isArray(raw.deflect)
      ? raw.deflect
          .filter(
            (rule): rule is { topic: string; response: string } =>
              typeof rule === "object" &&
              rule !== null &&
              typeof (rule as Record<string, unknown>).topic === "string" &&
              typeof (rule as Record<string, unknown>).response === "string",
          )
          .map((rule) => ({ topic: rule.topic, response: rule.response }))
      : [],
    hardBlock: Array.isArray(raw.hardBlock)
      ? raw.hardBlock.filter((topic): topic is string => typeof topic === "string")
      : [],
  };
}
