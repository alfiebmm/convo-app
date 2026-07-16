import type { ForumConfig } from "@/lib/forum-config/types";

const DEFAULT_IDLE_MINUTES = 60;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readPositiveMinutes(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value <= 0) return null;
  return Math.floor(value);
}

export function resolveBlogIdleMinutes(
  settings: Record<string, unknown> | null | undefined
): number {
  const forumConfig = isRecord(settings?.forumConfig)
    ? (settings.forumConfig as Partial<ForumConfig> & Record<string, unknown>)
    : {};
  const blog: Record<string, unknown> = isRecord(forumConfig.blog)
    ? forumConfig.blog
    : {};

  return (
    readPositiveMinutes(blog.idleMinutes) ??
    readPositiveMinutes(blog.idle_minutes) ??
    DEFAULT_IDLE_MINUTES
  );
}
