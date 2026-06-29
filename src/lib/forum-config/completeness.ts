export const REQUIRED_FORUM_CONFIG_SLICES = [
  "follow_up",
  "ai_persona",
  "qualifying_questions",
  "allowed_topics",
] as const;

export type RequiredForumConfigSlice =
  (typeof REQUIRED_FORUM_CONFIG_SLICES)[number];

export type ForumConfigCompleteness =
  | { complete: true }
  | { complete: false; missing: RequiredForumConfigSlice[] };

type TenantLike = {
  settings?: unknown;
};

export function assertForumConfigCompleteness(
  tenant: TenantLike,
): ForumConfigCompleteness {
  const settings = isPlainObject(tenant.settings) ? tenant.settings : {};
  const forumConfig = isPlainObject(settings.forumConfig)
    ? settings.forumConfig
    : {};

  const missing = REQUIRED_FORUM_CONFIG_SLICES.filter(
    (slice) =>
      !Object.prototype.hasOwnProperty.call(forumConfig, slice) ||
      forumConfig[slice] === undefined ||
      forumConfig[slice] === null,
  );

  return missing.length === 0 ? { complete: true } : { complete: false, missing };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
