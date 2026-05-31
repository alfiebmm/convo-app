import { redirect } from "next/navigation";
import { getCurrentTenant } from "@/lib/auth-context";
import { APP_CONFIG } from "@/config/app";
import {
  followUpSchema,
  type FollowUp,
} from "@/lib/forum-config/schema";

import { FollowUpHeader } from "./header";
import { ContactMethodsSection } from "./contact-methods";
import { CapturePoliciesSection } from "./capture-policies";
import { RulesSection } from "./rules-table";
import { DestinationsSection } from "./destinations";
import { HowToEditCallout } from "./how-to-edit";
import { FollowUpEmptyState } from "./empty-state";

/**
 * Knowledge → Follow-up tab (read-only V1).
 *
 * Pulls `settings.forumConfig.follow_up` off the authenticated tenant and
 * renders the configured contact methods, capture policies, rules, and
 * destinations. Edit-in-place is tracked separately for V1.1.
 *
 * CON-158 (Epic A2). Builds on the CON-157 schema (`@/lib/forum-config/schema`).
 *
 * Tenant settings is a `jsonb` column with no formal type, so the raw
 * follow-up value is parsed through `followUpSchema.safeParse` here. That
 * gives us:
 *
 *   - runtime safety against malformed JSON, and
 *   - schema-default population (so a tenant with `follow_up: {}` still
 *     gets `enabled: true`, `default_sensitivity: "balanced"`, etc.).
 */
export default async function FollowUpTabPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  // Tenant settings shape: `{ widget?: { primaryColor?: string }, forumConfig?: { follow_up?: ... } }`.
  // The jsonb column is typed as `unknown`-friendly elsewhere; narrow safely.
  const settings = (tenant.settings ?? {}) as Record<string, unknown>;

  const widget = (settings.widget ?? {}) as { primaryColor?: string };
  const primaryColor = widget.primaryColor ?? APP_CONFIG.branding.primary;

  const forumConfig = (settings.forumConfig ?? {}) as Record<string, unknown>;
  const rawFollowUp = forumConfig.follow_up;

  // Parse through the schema so defaults are applied and bad shapes can't
  // crash the page. If parsing fails we treat the block as absent.
  let followUp: FollowUp | null = null;
  if (rawFollowUp !== undefined) {
    const parsed = followUpSchema.safeParse(rawFollowUp);
    if (parsed.success) {
      followUp = parsed.data;
    }
  }

  const hasContent =
    !!followUp &&
    (followUp.contact_methods.length > 0 ||
      followUp.capture_policies.length > 0 ||
      followUp.rules.length > 0 ||
      followUp.destinations.length > 0);

  if (!followUp || !hasContent) {
    return <FollowUpEmptyState primaryColor={primaryColor} />;
  }

  return (
    <div className="space-y-6">
      <FollowUpHeader config={followUp} primaryColor={primaryColor} />

      <ContactMethodsSection
        methods={followUp.contact_methods}
        primaryColor={primaryColor}
      />

      <CapturePoliciesSection
        policies={followUp.capture_policies}
        primaryColor={primaryColor}
      />

      <RulesSection
        rules={followUp.rules}
        contactMethods={followUp.contact_methods}
        capturePolicies={followUp.capture_policies}
        primaryColor={primaryColor}
      />

      <DestinationsSection
        destinations={followUp.destinations}
        primaryColor={primaryColor}
      />

      <HowToEditCallout primaryColor={primaryColor} />
    </div>
  );
}
