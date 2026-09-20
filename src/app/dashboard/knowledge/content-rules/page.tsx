import { redirect } from "next/navigation";
import { getCurrentTenant } from "@/lib/auth-context";
import { resolveContentRules } from "@/lib/forum-config/content-rules";
import { ContentRulesForm } from "./content-rules-form";

export default async function ContentRulesPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const contentRules = resolveContentRules(tenant.settings);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-900">Content rules</h2>
        <p className="mt-1 text-sm text-slate-500">
          Configure blog style, templates, personas, and topics Convo should not
          answer or turn into blog content.
        </p>
      </div>
      <ContentRulesForm initialValue={contentRules} />
    </div>
  );
}
