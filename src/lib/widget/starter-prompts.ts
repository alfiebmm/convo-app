import { DEFAULT_STARTER_PROMPTS } from "@/lib/forum-config/defaults";
import { starterPromptsSchema } from "@/lib/forum-config/schema";
import type { StarterPrompt } from "@/lib/forum-config/schema";

export function resolveWidgetStarterPrompts(
  settings: Record<string, unknown>,
): StarterPrompt[] {
  const forumConfig =
    (settings.forumConfig as Record<string, unknown> | undefined) ?? {};
  const parsed = starterPromptsSchema.safeParse(
    forumConfig.starter_prompts,
  );

  if (parsed.success && parsed.data.length > 0) {
    return parsed.data;
  }

  return DEFAULT_STARTER_PROMPTS;
}
