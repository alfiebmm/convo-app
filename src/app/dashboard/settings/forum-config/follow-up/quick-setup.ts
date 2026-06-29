import { z } from "zod";

import {
  forumConfigSchema,
  type CaseType,
  type FieldKey,
  type FollowUp,
  type ForumConfig,
  type FollowUpRule,
} from "@/lib/forum-config/schema";

export const quickSetupPresetSchema = z.enum([
  "high_intent_buyers",
  "support_requests",
  "both",
]);

export const quickSetupDestinationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("webhook"),
    url: z.string().url(),
  }),
  z.object({
    type: z.literal("email"),
    email: z.string().email(),
  }),
]);

export const quickSetupInputSchema = z.object({
  voice_description: z.string().trim().min(1, "Voice description is required"),
  persona_question: z.object({
    question: z.string().trim().min(1, "Persona question is required"),
    options: z
      .array(
        z.object({
          label: z.string().trim().min(1, "Option label is required"),
          value: z.string().trim().min(1, "Option value is required"),
        }),
      )
      .min(2, "Add at least two persona options")
      .max(5, "Use five persona options or fewer"),
  }),
  allowed_topics: z
    .array(z.string().trim().min(1))
    .min(1, "Add at least one allowed topic"),
  preset: quickSetupPresetSchema,
  capture_fields: z
    .array(
      z.enum(["name", "email", "mobile", "postcode", "free_text_note"]),
    )
    .min(1, "Select at least one capture field"),
  destination: quickSetupDestinationSchema,
  privacy_notice: z.string().trim().min(1, "Privacy notice is required"),
  privacy_policy_url: z.string().url("Enter a valid privacy policy URL"),
});

export type QuickSetupPreset = z.infer<typeof quickSetupPresetSchema>;
export type QuickSetupDestination = z.infer<typeof quickSetupDestinationSchema>;
export type QuickSetupInput = z.infer<typeof quickSetupInputSchema>;

const PRESET_CASE_TYPES: Record<QuickSetupPreset, CaseType[]> = {
  high_intent_buyers: ["lead"],
  support_requests: ["cx_support"],
  both: ["lead", "cx_support"],
};

const DEFAULT_QUICK_INPUT: QuickSetupInput = {
  voice_description: "",
  persona_question: {
    question: "What best describes what you need help with?",
    options: [
      { label: "Buying or availability", value: "buying_or_availability" },
      { label: "Support", value: "support" },
    ],
  },
  allowed_topics: [],
  preset: "high_intent_buyers",
  capture_fields: ["name", "mobile", "postcode"],
  destination: {
    type: "webhook",
    url: "https://hooks.example.com.au/leads",
  },
  privacy_notice:
    "We will use these details to follow up about your enquiry.",
  privacy_policy_url: "https://example.com.au/privacy",
};

export function getDefaultQuickSetupInput(): QuickSetupInput {
  return structuredClone(DEFAULT_QUICK_INPUT);
}

export function buildForumConfigFromQuickSetup(
  input: QuickSetupInput,
  currentForumConfig: unknown = {},
): ForumConfig {
  const quick = quickSetupInputSchema.parse(input);
  const current = forumConfigSchema.parse(currentForumConfig ?? {});
  const followUp = buildFollowUpFromQuickSetup(quick);

  return forumConfigSchema.parse({
    ...current,
    ai_persona: {
      ...current.ai_persona,
      voice_description: quick.voice_description,
    },
    qualifying_questions: {
      ...current.qualifying_questions,
      preset: {
        question: quick.persona_question.question,
        options: quick.persona_question.options,
        persona_field: "quick_setup",
      },
    },
    allowed_topics: quick.allowed_topics,
    follow_up: followUp,
  });
}

export function buildFollowUpFromQuickSetup(input: QuickSetupInput): FollowUp {
  const quick = quickSetupInputSchema.parse(input);
  const caseTypes = PRESET_CASE_TYPES[quick.preset];

  const capture_policies = caseTypes.map((caseType) => ({
    id: capturePolicyId(caseType),
    case_type: caseType,
    required_fields: quick.capture_fields as FieldKey[],
    optional_fields: [],
    privacy_notice: quick.privacy_notice,
    privacy_policy_url: quick.privacy_policy_url,
  }));

  const rules = caseTypes.map((caseType) => ruleForCaseType(caseType));

  const destinations = [];
  if (quick.destination.type === "webhook") {
    const webhookUrl = quick.destination.url;
    destinations.push(
      ...caseTypes.map((caseType) => ({
          id: `${routingKey(caseType)}_webhook`,
          case_type: caseType,
          connector: "webhook" as const,
          routing_key: routingKey(caseType),
          config: {
            url: webhookUrl,
          },
        })),
    );
  }

  const contact_methods =
    quick.destination.type === "email"
      ? [
          {
            id: "quick_email_destination",
            type: "email" as const,
            label: "Email follow-up",
            value: quick.destination.email,
            available_for: caseTypes,
          },
        ]
      : [];

  return {
    enabled: true,
    default_sensitivity: "balanced",
    allow_staff_review_flags_without_visitor_interruption: true,
    persona_source: "qualifying",
    contact_methods,
    capture_policies,
    rules,
    destinations,
  };
}

export function quickSetupInputFromForumConfig(
  forumConfig: unknown,
): QuickSetupInput {
  const current = forumConfigSchema.safeParse(forumConfig ?? {});
  if (!current.success) return getDefaultQuickSetupInput();

  const config = current.data;
  const firstPolicy = config.follow_up.capture_policies[0];
  const presetQuestion = config.qualifying_questions.preset;
  const firstWebhook = config.follow_up.destinations.find(
    (destination) => destination.connector === "webhook",
  );
  const firstEmail = config.follow_up.contact_methods.find(
    (method) => method.type === "email" && method.value,
  );
  const firstEmailValue =
    firstEmail && typeof firstEmail.value === "string"
      ? firstEmail.value
      : null;
  const captureFields =
    firstPolicy?.required_fields.filter(isQuickCaptureField) ?? [];

  return {
    voice_description: config.ai_persona.voice_description,
    persona_question: {
      question:
        presetQuestion?.question ?? DEFAULT_QUICK_INPUT.persona_question.question,
      options:
        presetQuestion && presetQuestion.options.length >= 2
          ? presetQuestion.options.slice(0, 5)
          : DEFAULT_QUICK_INPUT.persona_question.options,
    },
    allowed_topics: config.allowed_topics,
    preset: presetFromRules(config.follow_up.rules),
    capture_fields: captureFields.length
      ? captureFields
      : DEFAULT_QUICK_INPUT.capture_fields,
    destination: firstWebhook
      ? webhookDestinationFromConfig(firstWebhook.config)
      : firstEmailValue
        ? {
          type: "email",
          email: firstEmailValue,
        }
        : DEFAULT_QUICK_INPUT.destination,
    privacy_notice:
      firstPolicy?.privacy_notice ?? DEFAULT_QUICK_INPUT.privacy_notice,
    privacy_policy_url:
      firstPolicy?.privacy_policy_url ?? DEFAULT_QUICK_INPUT.privacy_policy_url,
  };
}

export function buildQuickSetupPreview(input: QuickSetupInput): string {
  const parsed = quickSetupInputSchema.safeParse(input);
  const value = parsed.success ? parsed.data : input;
  const trigger = triggerSummary(value.preset);
  const askFor = value.capture_fields.length
    ? formatList(value.capture_fields.map(fieldLabel))
    : "the selected details";
  const destination =
    value.destination.type === "webhook"
      ? `send a webhook to ${value.destination.url || "the webhook URL"}`
      : `email the conversation to ${value.destination.email || "the selected inbox"}`;

  return `Convo will ${trigger}, ask for ${askFor}, and ${destination}.`;
}

function ruleForCaseType(caseType: CaseType): FollowUpRule {
  if (caseType === "lead") {
    return {
      id: "quick_high_intent_buyers",
      name: "High-intent buyers",
      case_type: "lead",
      enabled: true,
      priority: "normal",
      confidence_threshold: 0.75,
      when: {
        intent_in: ["request_quote", "check_availability"],
      },
      action: "capture_details_then_flag",
      capture_policy_id: capturePolicyId(caseType),
      routing_key: routingKey(caseType),
    };
  }

  return {
    id: "quick_support_requests",
    name: "Support requests",
    case_type: "cx_support",
    enabled: true,
    priority: "normal",
    confidence_threshold: 0.75,
    when: {
      intent_in: ["request_support"],
    },
    action: "offer_follow_up",
    capture_policy_id: capturePolicyId(caseType),
    routing_key: routingKey(caseType),
    offer_title: "Get follow-up from the team",
  };
}

function capturePolicyId(caseType: CaseType) {
  return caseType === "lead" ? "quick_lead_capture" : "quick_support_capture";
}

function routingKey(caseType: CaseType) {
  return caseType === "lead" ? "quick_leads" : "quick_support";
}

function presetFromRules(rules: FollowUpRule[]): QuickSetupPreset {
  const ids = new Set(rules.map((rule) => rule.id));
  const caseTypes = new Set(rules.map((rule) => rule.case_type));
  if (
    ids.has("quick_high_intent_buyers") &&
    ids.has("quick_support_requests")
  ) {
    return "both";
  }
  if (caseTypes.has("cx_support") && !caseTypes.has("lead")) {
    return "support_requests";
  }
  return "high_intent_buyers";
}

function webhookDestinationFromConfig(
  config: Record<string, unknown> | undefined,
): QuickSetupInput["destination"] {
  if (typeof config?.url === "string") {
    return { type: "webhook", url: config.url };
  }
  return DEFAULT_QUICK_INPUT.destination;
}

function isQuickCaptureField(
  field: FieldKey,
): field is QuickSetupInput["capture_fields"][number] {
  return (
    field === "name" ||
    field === "email" ||
    field === "mobile" ||
    field === "postcode" ||
    field === "free_text_note"
  );
}

function triggerSummary(preset: QuickSetupPreset) {
  if (preset === "support_requests") {
    return "offer follow-up when someone asks for support";
  }
  if (preset === "both") {
    return "flag buying or availability conversations and offer follow-up for support requests";
  }
  return "flag a conversation when someone says they want to buy or check availability";
}

function fieldLabel(field: QuickSetupInput["capture_fields"][number]) {
  if (field === "free_text_note") return "a short note";
  return field;
}

function formatList(items: string[]) {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} + ${items[1]}`;
  return `${items.slice(0, -1).join(" + ")} + ${items[items.length - 1]}`;
}
