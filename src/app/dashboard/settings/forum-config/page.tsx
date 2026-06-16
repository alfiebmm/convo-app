import { redirect } from "next/navigation";
import { getCurrentTenant } from "@/lib/auth-context";
import { ForumConfigEditor } from "./editor";

/**
 * Settings → Forum config (four-slice authoring UI).
 *
 * CON-191 — surfaces what was previously DB-paste-only:
 *   - ai_persona
 *   - qualifying_questions
 *   - allowed_topics
 *   - follow_up (contact methods + capture policies + rules + destinations)
 *
 * Persistence: PATCH /api/settings/forum-config (per-slice atomic write).
 * Read-only follow-up overview remains under Knowledge → Follow-up.
 */
export default async function ForumConfigPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const settings = (tenant.settings ?? {}) as Record<string, unknown>;
  const initialForumConfig = (settings.forumConfig ?? {}) as Record<
    string,
    unknown
  >;

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Forum config</h1>
        <p className="mt-1 text-sm text-zinc-500">
          How your chatbot speaks, what it qualifies on, what topics it covers,
          and how it follows up on leads or escalations.
        </p>
      </header>

      <ForumConfigEditor initialForumConfig={initialForumConfig} />
    </div>
  );
}
