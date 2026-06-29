import type { FollowUp } from "@/lib/forum-config/schema";
import { Chip } from "./chip";

const SENSITIVITY_LABEL: Record<FollowUp["default_sensitivity"], string> = {
  conservative: "Conservative",
  balanced: "Balanced",
  proactive: "Proactive",
};

const SENSITIVITY_DESCRIPTION: Record<FollowUp["default_sensitivity"], string> =
  {
    conservative:
      "Bias toward continuing to help. Only escalate or capture when intent is clear.",
    balanced: "Balance helpful answers with timely capture and escalation.",
    proactive:
      "Bias toward capturing and routing leads earlier in the conversation.",
  };

/**
 * Follow-up tab header — read-only feature status.
 *
 * Shows: enabled state, default sensitivity, staff-review-without-interrupt
 * toggle, persona source. Brand accent applied via inline style for the
 * status pill and the enabled indicator.
 *
 * CON-158.
 */
export function FollowUpHeader({
  config,
  primaryColor,
}: {
  config: FollowUp;
  primaryColor: string;
}) {
  return (
    <section
      className="rounded-lg border border-slate-200 bg-white p-5"
      aria-labelledby="follow-up-header"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2
            id="follow-up-header"
            className="text-lg font-semibold text-slate-900"
          >
            Follow-up
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            How your chatbot decides when to escalate, capture details, or
            route a qualified visitor to the right contact.
          </p>
        </div>
        <div
          className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border px-3 py-1 text-xs font-semibold"
          style={
            config.enabled
              ? {
                  borderColor: primaryColor,
                  color: primaryColor,
                  backgroundColor: `${primaryColor}14`,
                }
              : {
                  borderColor: "#E4E4E7",
                  color: "#71717A",
                  backgroundColor: "#FAFAFA",
                }
          }
        >
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{
              backgroundColor: config.enabled ? primaryColor : "#A1A1AA",
            }}
            aria-hidden
          />
          {config.enabled ? "Enabled" : "Disabled"}
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Default sensitivity
          </dt>
          <dd className="mt-1 flex flex-col gap-1">
            <Chip tone="info">
              {SENSITIVITY_LABEL[config.default_sensitivity]}
            </Chip>
            <span className="text-xs text-slate-500">
              {SENSITIVITY_DESCRIPTION[config.default_sensitivity]}
            </span>
          </dd>
        </div>

        <div>
          <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Staff-review flags without interrupting visitor
          </dt>
          <dd className="mt-1">
            <Chip
              tone={
                config.allow_staff_review_flags_without_visitor_interruption
                  ? "success"
                  : "neutral"
              }
            >
              {config.allow_staff_review_flags_without_visitor_interruption
                ? "Allowed"
                : "Not allowed"}
            </Chip>
          </dd>
        </div>

        <div>
          <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Persona source
          </dt>
          <dd className="mt-1">
            <Chip tone="neutral">{config.persona_source}</Chip>
          </dd>
        </div>
      </dl>
    </section>
  );
}
