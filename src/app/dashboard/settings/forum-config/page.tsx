import { redirect } from "next/navigation";
import { getCurrentTenant } from "@/lib/auth-context";
import { APP_CONFIG } from "@/config/app";
import { ForumConfigEditor } from "./editor";
import type { EditorTabKey } from "./types";
import type { FollowUpMode } from "./follow-up/mode-detection";
import {
  buildLegacyDraft,
  hasLegacySignal,
  isForumConfigEmpty,
  mergeLegacyIntoForumConfig,
} from "@/lib/forum-config/transform-legacy";
import { withDashboardErrorLogging } from "@/lib/errors/wrap";

/**
 * CON-238: map the URL-friendly `?tab=` slug onto the editor's internal
 * tab key. Hyphens in the URL, underscores in the type. Unknown values
 * fall back to `undefined` so the editor uses its own default.
 */
function resolveInitialTab(
  raw: string | string[] | undefined,
): EditorTabKey | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return undefined;
  const normalised = value.replace(/-/g, "_");
  const allowed: EditorTabKey[] = [
    "ai_persona",
    "welcome",
    "topic_scope",
    "qualifying_questions",
    "conversation_limits",
    "follow_up",
  ];
  return (allowed as string[]).includes(normalised)
    ? (normalised as EditorTabKey)
    : undefined;
}

function resolveInitialFollowUpMode(
  raw: string | string[] | undefined,
): FollowUpMode | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "quick" || value === "advanced") return value;
  return undefined;
}

/**
 * Settings → Forum config (tabbed authoring UI).
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
 * `guardrails.topicBoundaries.allow` / `widget.allowedTopics` /
 * `widget.welcomeMessage`, we
 * pre-fill the editor's initial form state from those legacy sources
 * and surface an inline notice so the tenant can review and save without
 * re-typing. Clicking Save persists the pre-filled values as the
 * forumConfig source of truth.
 *
 * Persistence: PATCH /api/settings/forum-config (per-slice atomic write).
 * Read-only follow-up overview remains under Knowledge → Follow-up.
 */
async function ForumConfigPageImpl({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
} = {}) {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const params = (await searchParams) ?? {};
  const initialActiveTab = resolveInitialTab(params.tab);
  const initialFollowUpMode = resolveInitialFollowUpMode(params.mode);

  const settings = (tenant.settings ?? {}) as Record<string, unknown>;
  const widget = (settings.widget ?? {}) as { primaryColor?: string };
  const primaryColor = widget.primaryColor ?? APP_CONFIG.branding.primary;
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
  const legacyDraft = buildLegacyDraft(settings);
  if (shouldAutoCopy) {
    initialForumConfig = mergeLegacyIntoForumConfig({}, legacyDraft);
    autoCopied = true;
  } else if (!hasWelcomeSlice(existingForumConfig) && legacyDraft.welcome.copy) {
    initialForumConfig = mergeLegacyIntoForumConfig(existingForumConfig, legacyDraft);
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
        initialActiveTab={initialActiveTab}
        initialFollowUpMode={initialFollowUpMode}
        primaryColor={primaryColor}
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

function hasWelcomeSlice(forumConfig: Record<string, unknown>): boolean {
  const welcome = forumConfig.welcome;
  return typeof welcome === "object" && welcome !== null && !Array.isArray(welcome);
}

// CON-error-logging: capture any throw from the forum-config render path.
export default withDashboardErrorLogging(ForumConfigPageImpl, {
  route: "/dashboard/settings/forum-config",
});
