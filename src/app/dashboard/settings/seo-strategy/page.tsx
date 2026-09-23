import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { getCurrentTenant } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { tenantSeoStrategy } from "@/lib/db/schema";
import { withDashboardErrorLogging } from "@/lib/errors/wrap";

import { emptySeoStrategy, type SeoStrategyRecord } from "@/app/api/settings/seo-strategy/handler";
import { SeoStrategyForm } from "./seo-strategy-form";

async function SeoStrategySettingsPageImpl() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const [row] = await db
    .select()
    .from(tenantSeoStrategy)
    .where(eq(tenantSeoStrategy.tenantId, tenant.id))
    .limit(1);

  const initial: SeoStrategyRecord = row
    ? {
        id: row.id,
        tenantId: row.tenantId,
        targetKeywords: row.targetKeywords,
        priorityServices: row.priorityServices,
        priorityLocations: row.priorityLocations,
        targetAudiences: row.targetAudiences,
        approvedInternalUrls: row.approvedInternalUrls,
        preferredCtas: row.preferredCtas,
        avoidTopics: row.avoidTopics,
        avoidClaims: row.avoidClaims,
        avoidKeywords: row.avoidKeywords,
        revision: row.revision,
      }
    : emptySeoStrategy(tenant.id);

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">SEO Strategy</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Set the search targets, audiences, links, and CTAs that guide article generation.
        </p>
      </header>

      <SeoStrategyForm initialStrategy={initial} />
    </div>
  );
}

export default withDashboardErrorLogging(SeoStrategySettingsPageImpl, {
  route: "/dashboard/settings/seo-strategy",
});
