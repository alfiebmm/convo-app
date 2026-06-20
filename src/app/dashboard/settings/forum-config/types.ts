/**
 * Shared types for the forum-config dashboard authoring UI (CON-191).
 */
export type AuthoringSliceKey =
  | "ai_persona"
  | "qualifying_questions"
  | "welcome"
  | "allowed_topics"
  | "follow_up";

/**
 * CON-200 tab grouping: "Allowed topics" + "Topic boundaries" share a single
 * "Topic scope" tab so tenants see one place for "what the bot will and
 * won't talk about". The underlying slices stay split (different APIs).
 */
export type EditorTabKey =
  | "ai_persona"
  | "welcome"
  | "topic_scope"
  | "qualifying_questions"
  | "conversation_limits"
  | "follow_up";

/** Raw forumConfig as it comes off the jsonb column — fully unknown-typed. */
export type ForumConfigRaw = Record<string, unknown>;

export type SaveResult =
  | { ok: true; forumConfig: ForumConfigRaw }
  | { ok: false; error: string; issues?: Record<string, unknown> };

/**
 * Posts a single slice to the API. Returns a normalised result. The pure
 * fetch is split out so panels can share consistent error handling.
 */
export async function saveSlice(
  slice: AuthoringSliceKey,
  value: unknown,
): Promise<SaveResult> {
  try {
    const res = await fetch("/api/settings/forum-config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [slice]: value }),
    });
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      return {
        ok: false,
        error:
          typeof data.error === "string"
            ? data.error
            : `Save failed (${res.status})`,
        issues: data.issues as Record<string, unknown> | undefined,
      };
    }
    return {
      ok: true,
      forumConfig:
        (data.forumConfigRaw as ForumConfigRaw | undefined) ??
        (data.forumConfig as ForumConfigRaw) ??
        {},
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}
