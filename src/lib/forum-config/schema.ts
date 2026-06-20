import { z } from "zod";

/**
 * forum.config.json Schema (K-01)
 * 
 * This is the per-tenant configuration object that drives all chatbot and blog behaviour.
 * Store as a JSON column on the Tenant DB record. Validate on every write.
 * 
 * @see README.md for detailed field documentation
 */

// ============================================================
// AI Persona Configuration
// ============================================================

// CON-201: `tone` now has a field-level default so a partial `ai_persona`
// slice that omits `tone` (e.g. a tenant who only set `voice_description`)
// still parses cleanly instead of falling through to the fallback config.
export const aiPersonaSchema = z.object({
  tone: z
    .enum(["professional", "friendly", "casual", "expert", "empathetic"])
    .default("friendly"),
  locale: z.string().default("en-AU"),
  banned_words: z.array(z.string()).default([]),
  voice_description: z.string().default(""),
});

// ============================================================
// CTA Rules Configuration
// ============================================================

export const ctaRuleSchema = z.object({
  tag: z.string(),
  text: z.string(),
  url: z.string().url(),
  default: z.boolean().default(false),
});

export const ctaRulesSchema = z.array(ctaRuleSchema).default([]);

// ============================================================
// Qualifying Questions Configuration
// ============================================================

export const questionOptionSchema = z.object({
  label: z.string(),
  value: z.string(),
});

export const qualifyingQuestionSchema = z.object({
  question: z.string(),
  options: z.array(questionOptionSchema),
  persona_field: z.string(),
});

export const qualifyingQuestionsSchema = z.object({
  preset: qualifyingQuestionSchema.optional(),
  additional: z.array(qualifyingQuestionSchema).max(4).default([]),
});

// ============================================================
// Welcome Message Configuration
// ============================================================

export const welcomeSchema = z.object({
  copy: z.string().default(""),
  enabled: z.boolean().default(true),
  show_with_questions: z.boolean().default(false),
});

// ============================================================
// Topic Configuration
// ============================================================

export const allowedTopicsSchema = z.array(z.string()).default([]);
export const exclusionListSchema = z.array(z.string()).default([]);

// ============================================================
// SEO Defaults Configuration
// ============================================================

// CON-201: field-level defaults so an absent or partial `seo_defaults`
// slice no longer kills the strict root parse. SEO templates are pure
// UI/display surface — defaults are safe filler.
export const seoDefaultsSchema = z.object({
  title_template: z.string().default("{topic} | {site_name}"),
  meta_template: z
    .string()
    .default(
      "Expert advice on {topic}. Get clear, practical answers from Australian specialists.",
    ),
  og_image: z.string().url().optional(),
  schema_org_type: z
    .enum(["Article", "BlogPosting", "QAPage", "HowTo", "FAQPage"])
    .default("Article"),
});

// ============================================================
// Lead Capture Configuration (CON-95 / C-06)
// ============================================================

export const leadCaptureKeywordsSchema = z
  .object({
    pricing: z.array(z.string()).optional(),
    booking: z.array(z.string()).optional(),
    project: z.array(z.string()).optional(),
    contact_request: z.array(z.string()).optional(),
  })
  .partial();

export const leadCaptureSchema = z.object({
  enabled: z.boolean().default(true),
  detection: z
    .object({
      keywords: leadCaptureKeywordsSchema.prefault({}),
    })
    .prefault({}),
  notify: z
    .object({
      onCapture: z.boolean().default(true),
    })
    .prefault({}),
});

// ============================================================
// Connector Configurations
// ============================================================

export const gscConnectorSchema = z.object({
  enabled: z.boolean().default(false),
  site_url: z.string().url().optional(),
  refresh_token: z.string().optional(),
  access_token: z.string().optional(),
  token_expiry: z.string().datetime().optional(),
});

export const ga4ConnectorSchema = z.object({
  enabled: z.boolean().default(false),
  property_id: z.string().optional(),
  credentials: z.string().optional(), // JSON service account credentials
});

export const openaiConnectorSchema = z.object({
  enabled: z.boolean().default(true),
  api_key: z.string().optional(),
  model: z.string().default("gpt-4o"),
  temperature: z.number().min(0).max(2).default(0.7),
});

export const connectorsSchema = z.object({
  gsc: gscConnectorSchema.prefault({}),
  ga4: ga4ConnectorSchema.prefault({}),
  openai: openaiConnectorSchema.prefault({}),
});

// ============================================================
// Limits Configuration
// ============================================================

export const limitsSchema = z.object({
  max_output_tokens: z.number().int().positive().default(1500),
  max_input_tokens: z.number().int().positive().default(4000),
  max_history_turns: z.number().int().positive().default(10),
  rate_limit_per_minute: z.number().int().positive().default(60),
});

// ============================================================
// Follow-Up, Escalation and Lead Routing Configuration
//
// Linear: CON-157 (Epic A1 — foundation for CON-149 program).
// PRD: 2026-05-31-convo-configurable-follow-up-prd_1 §8–§10.
//
// This block governs how the chatbot decides when to escalate,
// when to capture contact details, and where qualified leads go.
// All rules are evaluated server-side at conversation runtime.
// ============================================================

// ---- Shared enums ----

export const caseTypeEnum = z.enum(["cx_support", "lead"]);

export const sensitivityEnum = z.enum([
  "conservative",
  "balanced",
  "proactive",
]);

export const actionModeEnum = z.enum([
  "continue_helping",
  "clarify_then_recheck",
  "offer_follow_up",
  "refer_to_approved_contact_method",
  "capture_details_then_flag",
  "flag_for_staff_review_without_interrupting_visitor",
  "immediate_escalation",
]);

export const contactMethodTypeEnum = z.enum([
  "email",
  "phone",
  "callback",
  "url",
  "form",
]);

export const rulePriorityEnum = z.enum(["low", "normal", "high"]);

export const followUpConnectorEnum = z.enum(["webhook", "csv_export"]);

/**
 * V1 field-key registry for capture policies.
 *
 * Accepts the canonical registry values plus arbitrary tenant-defined custom
 * keys (e.g. `"abn"`, `"property_size"`). The registry is documented so
 * downstream UI surfaces can offer pickers for known keys without blocking
 * tenants who need bespoke fields.
 */
export const fieldKeySchema = z.union([
  z.enum([
    "name",
    "email",
    "mobile",
    "postcode",
    "suburb",
    "state",
    "company",
    "free_text_note",
    "preferred_contact_method",
  ]),
  z.string().min(1),
]);

// ---- Contact methods ----

export const contactMethodSchema = z
  .object({
    id: z.string().min(1),
    type: contactMethodTypeEnum,
    label: z.string().min(1),
    value: z.string().optional(),
    url: z.string().url().optional(),
    available_for: z.array(caseTypeEnum).min(1),
  })
  .superRefine((cm, ctx) => {
    // Type-specific shape: email/phone need `value`; url/form need `url`;
    // callback can use either or neither (the tenant inbox handles routing).
    if ((cm.type === "email" || cm.type === "phone") && !cm.value) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: `contact_method.type "${cm.type}" requires "value"`,
      });
    }
    if ((cm.type === "url" || cm.type === "form") && !cm.url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["url"],
        message: `contact_method.type "${cm.type}" requires "url"`,
      });
    }
  });

// ---- Capture policies ----

export const capturePolicySchema = z.object({
  id: z.string().min(1),
  case_type: caseTypeEnum,
  required_fields: z.array(fieldKeySchema).default([]),
  optional_fields: z.array(fieldKeySchema).default([]),
  privacy_notice: z.string().min(1),
  privacy_policy_url: z.string().url(),
});

// ---- Rule conditions ----

/**
 * RuleCondition (PRD §9 + §8).
 *
 * All fields optional; when present, evaluated as a logical AND.
 * An empty `when: {}` block matches every conversation.
 */
export const ruleConditionSchema = z.object({
  persona_in: z.array(z.string()).optional(),
  intent_in: z.array(z.string()).optional(),
  topic_in: z.array(z.string()).optional(),
  exclude_topics: z.array(z.string()).optional(),
  sentiment_in: z.array(z.string()).optional(),
  urgency_in: z.array(z.string()).optional(),
  marketplace_side_in: z.array(z.string()).optional(),
  page_url_pattern: z.string().optional(),
  repeated_loop_count_gte: z.number().int().nonnegative().optional(),
  unanswered_confidence_lte: z.number().min(0).max(1).optional(),
  direct_human_request: z.boolean().optional(),
  location_in: z.array(z.string()).optional(),
  product_or_service_in: z.array(z.string()).optional(),
});

// ---- Follow-up rules ----

/**
 * Action-mode → policy/contact dependency matrix.
 * Source of truth for the rule-level `.superRefine` below.
 */
const RULE_ACTION_REQUIREMENTS: Record<
  z.infer<typeof actionModeEnum>,
  {
    capture_policy_id: "required" | "forbidden" | "optional";
    contact_method_id: "required" | "forbidden" | "optional";
  }
> = {
  continue_helping: { capture_policy_id: "forbidden", contact_method_id: "forbidden" },
  clarify_then_recheck: { capture_policy_id: "forbidden", contact_method_id: "forbidden" },
  offer_follow_up: { capture_policy_id: "required", contact_method_id: "forbidden" },
  refer_to_approved_contact_method: { capture_policy_id: "forbidden", contact_method_id: "required" },
  capture_details_then_flag: { capture_policy_id: "required", contact_method_id: "forbidden" },
  flag_for_staff_review_without_interrupting_visitor: { capture_policy_id: "forbidden", contact_method_id: "forbidden" },
  immediate_escalation: { capture_policy_id: "optional", contact_method_id: "optional" },
};

export const followUpRuleSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    case_type: caseTypeEnum,
    enabled: z.boolean().default(true),
    priority: rulePriorityEnum.default("normal"),
    confidence_threshold: z.number().min(0).max(1).default(0.7),
    when: ruleConditionSchema.prefault({}),
    action: actionModeEnum,
    capture_policy_id: z.string().optional(),
    contact_method_id: z.string().optional(),
    routing_key: z.string().min(1),
    // CON-169 (Epic D1): visitor-facing title surfaced to the widget when
    // `action: "offer_follow_up"` triggers. Optional — widget falls back to
    // a sensible default if omitted.
    offer_title: z.string().optional(),
  })
  .superRefine((rule, ctx) => {
    const req = RULE_ACTION_REQUIREMENTS[rule.action];

    if (req.capture_policy_id === "required" && !rule.capture_policy_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["capture_policy_id"],
        message: `action "${rule.action}" requires capture_policy_id`,
      });
    }
    if (req.capture_policy_id === "forbidden" && rule.capture_policy_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["capture_policy_id"],
        message: `action "${rule.action}" must not set capture_policy_id`,
      });
    }
    if (req.contact_method_id === "required" && !rule.contact_method_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contact_method_id"],
        message: `action "${rule.action}" requires contact_method_id`,
      });
    }
    if (req.contact_method_id === "forbidden" && rule.contact_method_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contact_method_id"],
        message: `action "${rule.action}" must not set contact_method_id`,
      });
    }
  });

// ---- Destinations ----

export const destinationSchema = z.object({
  id: z.string().min(1),
  case_type: caseTypeEnum,
  connector: followUpConnectorEnum,
  routing_key: z.string().min(1),
  config: z.record(z.string(), z.unknown()).optional(),
});

// ---- Follow-up root ----

export const followUpSchema = z
  .object({
    enabled: z.boolean().default(true),
    default_sensitivity: sensitivityEnum.default("balanced"),
    allow_staff_review_flags_without_visitor_interruption: z
      .boolean()
      .default(true),
    persona_source: z.literal("qualifying").default("qualifying"),
    contact_methods: z.array(contactMethodSchema).default([]),
    capture_policies: z.array(capturePolicySchema).default([]),
    rules: z.array(followUpRuleSchema).default([]),
    destinations: z.array(destinationSchema).default([]),
  })
  .superRefine((fu, ctx) => {
    // Reference linkage: rules → capture_policies / contact_methods, plus
    // case_type alignment between the referenced entity and the rule itself.
    const policyById = new Map(
      fu.capture_policies.map((p) => [p.id, p] as const),
    );
    const contactById = new Map(
      fu.contact_methods.map((c) => [c.id, c] as const),
    );

    fu.rules.forEach((rule, idx) => {
      if (rule.capture_policy_id) {
        const policy = policyById.get(rule.capture_policy_id);
        if (!policy) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["rules", idx, "capture_policy_id"],
            message: `unknown capture_policy_id "${rule.capture_policy_id}"`,
          });
        } else if (policy.case_type !== rule.case_type) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["rules", idx, "capture_policy_id"],
            message: `capture_policy "${policy.id}" case_type "${policy.case_type}" does not match rule case_type "${rule.case_type}"`,
          });
        }
      }
      if (rule.contact_method_id) {
        const contact = contactById.get(rule.contact_method_id);
        if (!contact) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["rules", idx, "contact_method_id"],
            message: `unknown contact_method_id "${rule.contact_method_id}"`,
          });
        } else if (!contact.available_for.includes(rule.case_type)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["rules", idx, "contact_method_id"],
            message: `contact_method "${contact.id}" is not available_for "${rule.case_type}"`,
          });
        }
      }
    });

    // Reference linkage: every destination case_type must be referenced by
    // at least one rule of that case_type. Dangling destinations are a
    // config-rot signal and break the routing-key contract for Epic D.
    const ruleCaseTypes = new Set(fu.rules.map((r) => r.case_type));
    fu.destinations.forEach((dest, idx) => {
      if (!ruleCaseTypes.has(dest.case_type)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["destinations", idx, "case_type"],
          message: `destination case_type "${dest.case_type}" is not referenced by any rule`,
        });
      }
    });
  });

// ============================================================
// Root Forum Config Schema
// ============================================================

// CON-201: every slice is `.prefault({})` so the strict root parse no
// longer fails when a tenant config is missing a slice. Combined with
// the field-level defaults on `ai_persona` and `seo_defaults`, a tenant
// whose `forumConfig` only contains one authoring slice (e.g.
// `qualifying_questions`) round-trips through `parseForumConfigSafe`
// without being replaced wholesale by `DEFAULT_FORUM_CONFIG`.
//
// `parseForumConfigPerSlice` in `./validate.ts` is the belt-and-braces
// runtime safety net for any future tightening — see that file.
export const forumConfigSchema = z.object({
  schema_version: z.number().int().positive().default(1),
  ai_persona: aiPersonaSchema.prefault({}),
  cta_rules: ctaRulesSchema,
  qualifying_questions: qualifyingQuestionsSchema.prefault({}),
  welcome: welcomeSchema.prefault({}),
  lead_capture: leadCaptureSchema.prefault({}),
  allowed_topics: allowedTopicsSchema,
  exclusion_list: exclusionListSchema,
  seo_defaults: seoDefaultsSchema.prefault({}),
  connectors: connectorsSchema.prefault({}),
  limits: limitsSchema.prefault({}),
  follow_up: followUpSchema.prefault({}),
});

// ============================================================
// Inferred TypeScript Type
// ============================================================

export type ForumConfig = z.infer<typeof forumConfigSchema>;
export type AiPersona = z.infer<typeof aiPersonaSchema>;
export type CtaRule = z.infer<typeof ctaRuleSchema>;
export type QualifyingQuestion = z.infer<typeof qualifyingQuestionSchema>;
export type Welcome = z.infer<typeof welcomeSchema>;
export type SeoDefaults = z.infer<typeof seoDefaultsSchema>;
export type Connectors = z.infer<typeof connectorsSchema>;
export type Limits = z.infer<typeof limitsSchema>;
export type LeadCapture = z.infer<typeof leadCaptureSchema>;

// Follow-up (CON-157)
export type CaseType = z.infer<typeof caseTypeEnum>;
export type Sensitivity = z.infer<typeof sensitivityEnum>;
export type ActionMode = z.infer<typeof actionModeEnum>;
export type ContactMethodType = z.infer<typeof contactMethodTypeEnum>;
export type RulePriority = z.infer<typeof rulePriorityEnum>;
export type FollowUpConnector = z.infer<typeof followUpConnectorEnum>;
export type FieldKey = z.infer<typeof fieldKeySchema>;
export type ContactMethod = z.infer<typeof contactMethodSchema>;
export type CapturePolicy = z.infer<typeof capturePolicySchema>;
export type RuleCondition = z.infer<typeof ruleConditionSchema>;
export type FollowUpRule = z.infer<typeof followUpRuleSchema>;
export type Destination = z.infer<typeof destinationSchema>;
export type FollowUp = z.infer<typeof followUpSchema>;
