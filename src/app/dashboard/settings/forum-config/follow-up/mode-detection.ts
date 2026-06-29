import { followUpSchema, type FollowUp } from "@/lib/forum-config/schema";

export type FollowUpMode = "quick" | "advanced";

export const QUICK_INCOMPATIBLE_MESSAGE =
  "Your follow-up config has multiple rules / destinations / capture policies. Stay in Advanced mode to keep that flexibility.";

export type QuickCompatibility =
  | { compatible: true }
  | { compatible: false; reason: string };

export function detectFollowUpMode(input: unknown): FollowUpMode {
  const parsed = followUpSchema.safeParse(input ?? {});
  if (!parsed.success) return "advanced";

  const followUp = parsed.data;
  if (
    followUp.rules.length === 0 &&
    followUp.capture_policies.length === 0 &&
    followUp.destinations.length === 0 &&
    followUp.contact_methods.length === 0
  ) {
    return "quick";
  }

  return canSwitchToQuick(followUp).compatible ? "quick" : "advanced";
}

export function canSwitchToQuick(input: unknown): QuickCompatibility {
  const parsed = followUpSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { compatible: false, reason: "Current follow-up config is invalid." };
  }

  const followUp = parsed.data;
  const hasNoContent =
    followUp.rules.length === 0 &&
    followUp.capture_policies.length === 0 &&
    followUp.destinations.length === 0 &&
    followUp.contact_methods.length === 0;
  if (hasNoContent) return { compatible: true };

  const endpointCount =
    followUp.destinations.length + followUp.contact_methods.length;

  if (
    followUp.rules.length !== 1 ||
    followUp.capture_policies.length !== 1 ||
    endpointCount !== 1
  ) {
    return { compatible: false, reason: QUICK_INCOMPATIBLE_MESSAGE };
  }

  const rule = followUp.rules[0];
  const policy = followUp.capture_policies[0];
  if (!rule.capture_policy_id || rule.capture_policy_id !== policy.id) {
    return {
      compatible: false,
      reason:
        "Switch to Quick setup needs one rule linked to one capture policy.",
    };
  }

  if (rule.case_type !== policy.case_type) {
    return {
      compatible: false,
      reason:
        "Switch to Quick setup needs the rule and capture policy to use the same case type.",
    };
  }

  const destination = followUp.destinations[0];
  if (destination && destination.case_type !== rule.case_type) {
    return {
      compatible: false,
      reason:
        "Switch to Quick setup needs the destination to match the rule case type.",
    };
  }

  const contactMethod = followUp.contact_methods[0];
  if (contactMethod && !contactMethod.available_for.includes(rule.case_type)) {
    return {
      compatible: false,
      reason:
        "Switch to Quick setup needs the contact method to handle the rule case type.",
    };
  }

  return { compatible: true };
}

export function resolveRequestedMode({
  requestedMode,
  followUp,
}: {
  requestedMode?: string;
  followUp: FollowUp | null;
}): FollowUpMode {
  if (requestedMode === "quick") {
    return canSwitchToQuick(followUp ?? {}).compatible ? "quick" : "advanced";
  }
  if (requestedMode === "advanced") return "advanced";
  return detectFollowUpMode(followUp ?? {});
}
