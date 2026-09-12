import { redirect } from "next/navigation";

import { getCurrentTenant } from "@/lib/auth-context";
import { readContentRules } from "@/lib/forum-config/content-rules";
import { ContentRulesPanel } from "./content-rules-panel";

export default async function KnowledgeContentRulesPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  return (
    <div>
      <ContentRulesPanel initialValue={readContentRules(tenant.settings)} />
    </div>
  );
}
