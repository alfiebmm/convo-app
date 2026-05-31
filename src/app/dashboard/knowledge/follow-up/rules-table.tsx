import type {
  FollowUpRule,
  RuleCondition,
  ContactMethod,
  CapturePolicy,
} from "@/lib/forum-config/schema";
import { Chip } from "./chip";
import { SectionHeading, EmptyHint } from "./section";

const ACTION_LABEL: Record<FollowUpRule["action"], string> = {
  continue_helping: "Continue helping",
  clarify_then_recheck: "Clarify, then recheck",
  offer_follow_up: "Offer follow-up",
  refer_to_approved_contact_method: "Refer to contact method",
  capture_details_then_flag: "Capture details, then flag",
  flag_for_staff_review_without_interrupting_visitor:
    "Flag for staff review (silent)",
  immediate_escalation: "Immediate escalation",
};

const PRIORITY_TONE: Record<
  FollowUpRule["priority"],
  "neutral" | "info" | "warning"
> = {
  low: "neutral",
  normal: "info",
  high: "warning",
};

const CASE_LABEL: Record<string, string> = {
  cx_support: "CX support",
  lead: "Lead",
};

/**
 * Rules — desktop table + mobile stacked cards. Read-only.
 *
 * CON-158.
 */
export function RulesSection({
  rules,
  contactMethods,
  capturePolicies,
  primaryColor,
}: {
  rules: FollowUpRule[];
  contactMethods: ContactMethod[];
  capturePolicies: CapturePolicy[];
  primaryColor: string;
}) {
  const cmById = new Map(contactMethods.map((c) => [c.id, c] as const));
  const cpById = new Map(capturePolicies.map((p) => [p.id, p] as const));

  // Stable order: priority desc (high > normal > low), then array index.
  const PRIORITY_RANK: Record<FollowUpRule["priority"], number> = {
    high: 0,
    normal: 1,
    low: 2,
  };
  const ordered = [...rules]
    .map((r, i) => ({ rule: r, i }))
    .sort(
      (a, b) =>
        PRIORITY_RANK[a.rule.priority] - PRIORITY_RANK[b.rule.priority] ||
        a.i - b.i,
    )
    .map(({ rule }) => rule);

  return (
    <section aria-labelledby="rules-heading">
      <SectionHeading
        id="rules-heading"
        primaryColor={primaryColor}
        title="Rules"
        description="Ordered by priority. The first matching enabled rule wins at runtime."
        count={rules.length}
      />

      {rules.length === 0 ? (
        <EmptyHint>No rules configured.</EmptyHint>
      ) : (
        <>
          {/* Desktop / tablet table */}
          <div className="mt-4 hidden overflow-x-auto rounded-lg border border-slate-200 md:block">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-2">Priority</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Case</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Threshold</th>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Linked</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {ordered.map((rule) => (
                  <tr key={rule.id} className="align-top">
                    <td className="px-3 py-2">
                      <Chip tone={PRIORITY_TONE[rule.priority]}>
                        {rule.priority}
                      </Chip>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-900">
                        {rule.name}
                      </div>
                      <div className="font-mono text-xs text-slate-500">
                        {rule.id}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {CASE_LABEL[rule.case_type] ?? rule.case_type}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {ACTION_LABEL[rule.action]}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-600">
                      {rule.confidence_threshold.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600 max-w-xs">
                      <span title={fullConditionSummary(rule.when)}>
                        {truncateConditionSummary(rule.when)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      <LinkedRefs
                        rule={rule}
                        contactMethod={
                          rule.contact_method_id
                            ? cmById.get(rule.contact_method_id)
                            : undefined
                        }
                        capturePolicy={
                          rule.capture_policy_id
                            ? cpById.get(rule.capture_policy_id)
                            : undefined
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Chip tone={rule.enabled ? "success" : "neutral"}>
                        {rule.enabled ? "Enabled" : "Disabled"}
                      </Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile stacked cards */}
          <ul className="mt-4 grid grid-cols-1 gap-3 md:hidden">
            {ordered.map((rule) => (
              <li
                key={rule.id}
                className="rounded-lg border border-slate-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {rule.name}
                    </p>
                    <p className="font-mono text-xs text-slate-500 truncate">
                      {rule.id}
                    </p>
                  </div>
                  <Chip tone={rule.enabled ? "success" : "neutral"}>
                    {rule.enabled ? "Enabled" : "Disabled"}
                  </Chip>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Chip tone={PRIORITY_TONE[rule.priority]}>
                    {rule.priority}
                  </Chip>
                  <Chip tone="info">
                    {CASE_LABEL[rule.case_type] ?? rule.case_type}
                  </Chip>
                  <Chip tone="neutral">{ACTION_LABEL[rule.action]}</Chip>
                  <Chip tone="neutral" title="Confidence threshold">
                    ≥ {rule.confidence_threshold.toFixed(2)}
                  </Chip>
                </div>
                <p className="mt-2 text-xs text-slate-600">
                  <span className="font-medium text-slate-500">When: </span>
                  {fullConditionSummary(rule.when) || "any conversation"}
                </p>
                <div className="mt-2">
                  <LinkedRefs
                    rule={rule}
                    contactMethod={
                      rule.contact_method_id
                        ? cmById.get(rule.contact_method_id)
                        : undefined
                    }
                    capturePolicy={
                      rule.capture_policy_id
                        ? cpById.get(rule.capture_policy_id)
                        : undefined
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function LinkedRefs({
  rule,
  contactMethod,
  capturePolicy,
}: {
  rule: FollowUpRule;
  contactMethod?: ContactMethod;
  capturePolicy?: CapturePolicy;
}) {
  const hasAny =
    rule.contact_method_id ||
    rule.capture_policy_id ||
    rule.routing_key;

  if (!hasAny) return <span className="text-slate-400">—</span>;

  return (
    <div className="flex flex-col gap-1">
      {rule.capture_policy_id && (
        <span>
          <span className="text-slate-500">policy:</span>{" "}
          <span className="font-mono">
            {capturePolicy ? capturePolicy.id : `${rule.capture_policy_id}⚠`}
          </span>
        </span>
      )}
      {rule.contact_method_id && (
        <span>
          <span className="text-slate-500">contact:</span>{" "}
          <span className="font-mono">
            {contactMethod
              ? contactMethod.label
              : `${rule.contact_method_id}⚠`}
          </span>
        </span>
      )}
      <span>
        <span className="text-slate-500">routing:</span>{" "}
        <span className="font-mono">{rule.routing_key}</span>
      </span>
    </div>
  );
}

/**
 * Build a short human-readable summary of a rule's `when` clause.
 *
 * Empty `when: {}` matches every conversation — return empty string and let
 * the caller render "any conversation" (or just nothing in the dense table).
 */
function fullConditionSummary(when: RuleCondition): string {
  const parts: string[] = [];

  if (when.persona_in?.length) parts.push(`persona ∈ ${when.persona_in.join("|")}`);
  if (when.intent_in?.length) parts.push(`intent ∈ ${when.intent_in.join("|")}`);
  if (when.topic_in?.length) parts.push(`topic ∈ ${when.topic_in.join("|")}`);
  if (when.exclude_topics?.length)
    parts.push(`exclude topics ${when.exclude_topics.join("|")}`);
  if (when.sentiment_in?.length)
    parts.push(`sentiment ∈ ${when.sentiment_in.join("|")}`);
  if (when.urgency_in?.length)
    parts.push(`urgency ∈ ${when.urgency_in.join("|")}`);
  if (when.marketplace_side_in?.length)
    parts.push(`side ∈ ${when.marketplace_side_in.join("|")}`);
  if (when.page_url_pattern) parts.push(`url ~ ${when.page_url_pattern}`);
  if (when.repeated_loop_count_gte !== undefined)
    parts.push(`loops ≥ ${when.repeated_loop_count_gte}`);
  if (when.unanswered_confidence_lte !== undefined)
    parts.push(`confidence ≤ ${when.unanswered_confidence_lte}`);
  if (when.direct_human_request) parts.push("direct human request");
  if (when.location_in?.length)
    parts.push(`location ∈ ${when.location_in.join("|")}`);
  if (when.product_or_service_in?.length)
    parts.push(`product ∈ ${when.product_or_service_in.join("|")}`);

  return parts.join("; ");
}

function truncateConditionSummary(when: RuleCondition): string {
  const full = fullConditionSummary(when);
  if (!full) return "any";
  if (full.length <= 60) return full;
  return full.slice(0, 57) + "…";
}
