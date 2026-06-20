import { welcomeSchema } from "@/lib/forum-config/schema";

export interface PublicWelcomeConfig {
  copy: string;
  enabled: boolean;
  show_with_questions: boolean;
}

export function resolvePublicWelcomeConfig(
  settings: Record<string, unknown>,
  widget: Record<string, unknown>,
): PublicWelcomeConfig {
  const forumConfig = isPlainObject(settings.forumConfig)
    ? (settings.forumConfig as Record<string, unknown>)
    : {};
  const rawWelcome = forumConfig.welcome;
  const parsed = welcomeSchema.safeParse(rawWelcome);
  const widgetWelcome =
    (typeof widget.welcomeMessage === "string" && widget.welcomeMessage.trim()) ||
    "";

  if (parsed.success && Object.prototype.hasOwnProperty.call(forumConfig, "welcome")) {
    return {
      ...parsed.data,
      copy: parsed.data.copy.trim() || widgetWelcome,
    };
  }

  return {
    copy: widgetWelcome,
    enabled: true,
    show_with_questions: false,
  };
}

export function hasStoredQualifyingQuestions(
  settings: Record<string, unknown>,
): boolean {
  const forumConfig = isPlainObject(settings.forumConfig)
    ? (settings.forumConfig as Record<string, unknown>)
    : {};
  const qualifying = isPlainObject(forumConfig.qualifying_questions)
    ? (forumConfig.qualifying_questions as Record<string, unknown>)
    : {};
  if (isPlainObject(qualifying.preset)) return true;
  return Array.isArray(qualifying.additional) && qualifying.additional.length > 0;
}

export function shouldShowWelcomeOnOpen(
  welcome: PublicWelcomeConfig,
  qualifyingQuestionsPopulated: boolean,
): boolean {
  return (
    welcome.enabled &&
    welcome.copy.length > 0 &&
    (!qualifyingQuestionsPopulated || welcome.show_with_questions)
  );
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
