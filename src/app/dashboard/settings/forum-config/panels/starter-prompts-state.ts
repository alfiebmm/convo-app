import type { StarterPrompt } from "@/lib/forum-config/schema";

export type StarterPromptActionType = "chat" | "lead_capture" | "custom_embed";
export type FieldTier = "required" | "optional";

export function actionTypeFor(prompt: StarterPrompt): StarterPromptActionType {
  const type = prompt.action?.type;
  return type === "lead_capture" || type === "custom_embed" ? type : "chat";
}

export function slugFromLabel(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
  return slug || "starter_pill_capture";
}

export function withActionType(
  prompt: StarterPrompt,
  type: StarterPromptActionType,
): StarterPrompt {
  if (type === "chat") {
    return { ...prompt, action: { type: "chat" } };
  }

  if (type === "custom_embed") {
    const current =
      prompt.action?.type === "custom_embed" ? prompt.action : undefined;
    return {
      ...prompt,
      action: {
        type: "custom_embed",
        kind: "iframe",
        url: current?.url ?? "",
        height: current?.height ?? 520,
        allow: current?.allow ?? "",
      },
    };
  }

  const current = prompt.action?.type === "lead_capture" ? prompt.action : undefined;
  return {
    ...prompt,
    action: {
      type: "lead_capture",
      capture_policy: {
        id: current?.capture_policy.id || slugFromLabel(prompt.label),
        case_type: current?.capture_policy.case_type ?? "lead",
        required_fields:
          current?.capture_policy.required_fields.length
            ? current.capture_policy.required_fields
            : ["name", "email"],
        optional_fields: current?.capture_policy.optional_fields ?? [],
        privacy_notice:
          current?.capture_policy.privacy_notice ??
          "We use your details only to follow up on your enquiry.",
        privacy_policy_url:
          current?.capture_policy.privacy_policy_url ??
          "https://convoapp.com.au/privacy",
      },
      field_label_overrides: current?.field_label_overrides ?? {},
    },
  };
}

export function updateLeadPolicy(
  prompt: StarterPrompt,
  updater: (
    policy: Extract<
      NonNullable<StarterPrompt["action"]>,
      { type: "lead_capture" }
    >["capture_policy"],
  ) => Extract<
    NonNullable<StarterPrompt["action"]>,
    { type: "lead_capture" }
  >["capture_policy"],
): StarterPrompt {
  const leadPrompt = withActionType(prompt, "lead_capture");
  if (leadPrompt.action?.type !== "lead_capture") return leadPrompt;
  const nextPolicy = updater(leadPrompt.action.capture_policy);
  const selected = new Set([
    ...nextPolicy.required_fields,
    ...nextPolicy.optional_fields,
  ]);
  const overrides = Object.fromEntries(
    Object.entries(leadPrompt.action.field_label_overrides ?? {}).filter(([key]) =>
      selected.has(key),
    ),
  );
  return {
    ...leadPrompt,
    action: {
      ...leadPrompt.action,
      capture_policy: nextPolicy,
      field_label_overrides: overrides,
    },
  };
}

export function setFieldEnabled(
  prompt: StarterPrompt,
  field: string,
  tier: FieldTier,
  enabled: boolean,
): StarterPrompt {
  return updateLeadPolicy(prompt, (policy) => {
    const required = without(policy.required_fields, field);
    const optional = without(policy.optional_fields, field);
    if (enabled && tier === "required") required.push(field);
    if (enabled && tier === "optional") optional.push(field);
    return {
      ...policy,
      required_fields: unique(required),
      optional_fields: unique(optional),
    };
  });
}

export function moveField(
  prompt: StarterPrompt,
  tier: FieldTier,
  fromIndex: number,
  toIndex: number,
): StarterPrompt {
  return updateLeadPolicy(prompt, (policy) => {
    const key = tier === "required" ? "required_fields" : "optional_fields";
    const next = [...policy[key]];
    if (
      fromIndex < 0 ||
      fromIndex >= next.length ||
      toIndex < 0 ||
      toIndex >= next.length
    ) {
      return policy;
    }
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return { ...policy, [key]: next };
  });
}

export function setLabelOverride(
  prompt: StarterPrompt,
  field: string,
  label: string,
): StarterPrompt {
  const leadPrompt = withActionType(prompt, "lead_capture");
  if (leadPrompt.action?.type !== "lead_capture") return leadPrompt;
  const selected = new Set([
    ...leadPrompt.action.capture_policy.required_fields,
    ...leadPrompt.action.capture_policy.optional_fields,
  ]);
  if (!selected.has(field)) return leadPrompt;
  const field_label_overrides = {
    ...(leadPrompt.action.field_label_overrides ?? {}),
    [field]: label,
  };
  if (!label.trim()) delete field_label_overrides[field];
  return {
    ...leadPrompt,
    action: {
      ...leadPrompt.action,
      field_label_overrides,
    },
  };
}

function without(values: string[], field: string): string[] {
  return values.filter((value) => value !== field);
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}
