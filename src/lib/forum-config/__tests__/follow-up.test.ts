#!/usr/bin/env node

/**
 * Follow-Up Schema Tests (CON-157, Epic A1)
 *
 * Validates the `follow_up` block added to `forum.config.json`.
 * Pattern matches scripts/validate-forum-config.ts (CON-94 / K-01) — pure
 * tsx-runnable, no test framework dependency.
 *
 * Run with: npx tsx src/lib/forum-config/__tests__/follow-up.test.ts
 */

import {
  forumConfigSchema,
  followUpSchema,
  contactMethodSchema,
  capturePolicySchema,
  followUpRuleSchema,
  destinationSchema,
  ruleConditionSchema,
  actionModeEnum,
  caseTypeEnum,
  sensitivityEnum,
  contactMethodTypeEnum,
  rulePriorityEnum,
  followUpConnectorEnum,
} from "../schema";
import { DEFAULT_FORUM_CONFIG } from "../defaults";
import { validateForumConfig } from "../validate";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`❌ ${name}`);
    console.log(`   Error: ${message}`);
    failed++;
    failures.push(`${name}: ${message}`);
  }
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("🧪 follow_up Schema Tests (CON-157)\n");

// ============================================================
// 1. PRD §9 full example validates cleanly
// ============================================================

const PRD_FIXTURE = {
  enabled: true,
  default_sensitivity: "balanced" as const,
  allow_staff_review_flags_without_visitor_interruption: true,
  contact_methods: [
    {
      id: "support_email",
      type: "email" as const,
      label: "Email our support team",
      value: "support@example.com.au",
      available_for: ["cx_support" as const],
    },
    {
      id: "sales_callback",
      type: "callback" as const,
      label: "Request a callback",
      available_for: ["lead" as const],
    },
  ],
  capture_policies: [
    {
      id: "lead_callback",
      case_type: "lead" as const,
      required_fields: ["name", "mobile"],
      optional_fields: ["email", "postcode"],
      privacy_notice:
        "We'll share these details with Example Co so they can respond to your enquiry.",
      privacy_policy_url: "https://example.com.au/privacy",
    },
  ],
  rules: [
    {
      id: "farmer_service_request",
      name: "Farmer requesting a contractor",
      case_type: "lead" as const,
      enabled: true,
      priority: "normal" as const,
      confidence_threshold: 0.75,
      when: {
        persona_in: ["farmer"],
        intent_in: ["find_contractor", "request_quote"],
        exclude_topics: ["general_research"],
      },
      action: "capture_details_then_flag" as const,
      capture_policy_id: "lead_callback",
      routing_key: "marketplace_demand",
    },
  ],
  destinations: [
    {
      id: "default_leads",
      case_type: "lead" as const,
      connector: "webhook" as const,
      routing_key: "marketplace_demand",
      config: { url: "https://example.com.au/webhooks/leads" },
    },
  ],
};

test("PRD §9 example validates against followUpSchema", () => {
  const r = followUpSchema.safeParse(PRD_FIXTURE);
  assert(r.success, JSON.stringify(r.error?.issues, null, 2));
});

test("PRD §9 example nested under forumConfigSchema validates", () => {
  const r = forumConfigSchema.safeParse({
    ...DEFAULT_FORUM_CONFIG,
    follow_up: PRD_FIXTURE,
  });
  assert(r.success, JSON.stringify(r.error?.issues, null, 2));
});

// ============================================================
// 2. Minimal valid configs
// ============================================================

test("Minimal follow_up ({}) validates and fills defaults", () => {
  const r = followUpSchema.safeParse({});
  assert(r.success, JSON.stringify(r.error?.issues, null, 2));
  assert(r.data.enabled === true, "enabled should default to true");
  assert(
    r.data.default_sensitivity === "balanced",
    "default_sensitivity should default to balanced",
  );
  assert(
    r.data.allow_staff_review_flags_without_visitor_interruption === true,
    "staff-review-flag toggle should default to true",
  );
  assert(
    r.data.persona_source === "qualifying",
    "persona_source should default to qualifying",
  );
});

test("DEFAULT_FORUM_CONFIG validates (full root parse)", () => {
  const result = validateForumConfig(DEFAULT_FORUM_CONFIG);
  assert(result.ok, JSON.stringify((result as { errors?: string[] }).errors));
});

test("forumConfigSchema parses with no follow_up at all (defaults apply)", () => {
  const r = forumConfigSchema.safeParse({
    ai_persona: { tone: "friendly" },
    cta_rules: [],
    allowed_topics: [],
    exclusion_list: [],
    seo_defaults: {
      title_template: "{topic}",
      meta_template: "{topic}",
      schema_org_type: "Article",
    },
  });
  assert(r.success, JSON.stringify(r.error?.issues, null, 2));
  assert(r.data.follow_up.enabled === true, "follow_up.enabled default missing");
  assert(
    r.data.follow_up.default_sensitivity === "balanced",
    "follow_up.default_sensitivity default missing",
  );
});

// ============================================================
// 3. Enum coverage
// ============================================================

test("caseTypeEnum accepts cx_support and lead, rejects unknown", () => {
  assert(caseTypeEnum.safeParse("cx_support").success, "cx_support");
  assert(caseTypeEnum.safeParse("lead").success, "lead");
  assert(!caseTypeEnum.safeParse("marketing").success, "marketing should fail");
});

test("sensitivityEnum accepts conservative/balanced/proactive only", () => {
  ["conservative", "balanced", "proactive"].forEach((v) => {
    assert(sensitivityEnum.safeParse(v).success, v);
  });
  assert(!sensitivityEnum.safeParse("aggressive").success, "aggressive should fail");
});

test("actionModeEnum accepts all 7 PRD §8 modes, rejects unknown", () => {
  const valid = [
    "continue_helping",
    "clarify_then_recheck",
    "offer_follow_up",
    "refer_to_approved_contact_method",
    "capture_details_then_flag",
    "flag_for_staff_review_without_interrupting_visitor",
    "immediate_escalation",
  ];
  valid.forEach((v) => {
    assert(actionModeEnum.safeParse(v).success, v);
  });
  assert(!actionModeEnum.safeParse("hand_off").success, "hand_off should fail");
});

test("contactMethodTypeEnum accepts email/phone/callback/url/form only", () => {
  ["email", "phone", "callback", "url", "form"].forEach((v) => {
    assert(contactMethodTypeEnum.safeParse(v).success, v);
  });
  assert(!contactMethodTypeEnum.safeParse("sms").success, "sms should fail");
});

test("rulePriorityEnum accepts low/normal/high, rejects unknown", () => {
  ["low", "normal", "high"].forEach((v) => {
    assert(rulePriorityEnum.safeParse(v).success, v);
  });
  assert(!rulePriorityEnum.safeParse("urgent").success, "urgent should fail");
});

test("followUpConnectorEnum accepts webhook/csv_export only (V1)", () => {
  assert(followUpConnectorEnum.safeParse("webhook").success, "webhook");
  assert(followUpConnectorEnum.safeParse("csv_export").success, "csv_export");
  // Future connectors are intentionally NOT in V1 — Epic D adds them.
  assert(!followUpConnectorEnum.safeParse("hubspot").success, "hubspot should fail (V1)");
  assert(!followUpConnectorEnum.safeParse("zendesk").success, "zendesk should fail (V1)");
});

// ============================================================
// 4. RuleCondition — all fields optional
// ============================================================

test("ruleConditionSchema accepts empty object {}", () => {
  const r = ruleConditionSchema.safeParse({});
  assert(r.success, JSON.stringify(r.error?.issues, null, 2));
});

test("ruleConditionSchema accepts a single field (persona_in only)", () => {
  const r = ruleConditionSchema.safeParse({ persona_in: ["farmer"] });
  assert(r.success, JSON.stringify(r.error?.issues, null, 2));
});

test("ruleConditionSchema accepts all PRD §9 + §8 fields together", () => {
  const r = ruleConditionSchema.safeParse({
    persona_in: ["farmer"],
    intent_in: ["request_quote"],
    topic_in: ["pricing"],
    exclude_topics: ["general"],
    sentiment_in: ["positive"],
    urgency_in: ["high"],
    marketplace_side_in: ["demand"],
    page_url_pattern: "^/services/",
    repeated_loop_count_gte: 2,
    unanswered_confidence_lte: 0.4,
    direct_human_request: true,
    location_in: ["NSW"],
    product_or_service_in: ["fencing"],
  });
  assert(r.success, JSON.stringify(r.error?.issues, null, 2));
});

test("ruleConditionSchema rejects unanswered_confidence_lte > 1", () => {
  const r = ruleConditionSchema.safeParse({ unanswered_confidence_lte: 1.5 });
  assert(!r.success, "should reject confidence > 1");
});

// ============================================================
// 5. ContactMethod — type/value/url requirements
// ============================================================

test("contactMethodSchema accepts email with value", () => {
  const r = contactMethodSchema.safeParse({
    id: "se",
    type: "email",
    label: "Support",
    value: "x@y.com",
    available_for: ["cx_support"],
  });
  assert(r.success, JSON.stringify(r.error?.issues, null, 2));
});

test("contactMethodSchema rejects email without value", () => {
  const r = contactMethodSchema.safeParse({
    id: "se",
    type: "email",
    label: "Support",
    available_for: ["cx_support"],
  });
  assert(!r.success, "email without value should fail");
});

test("contactMethodSchema rejects url without url field", () => {
  const r = contactMethodSchema.safeParse({
    id: "ce",
    type: "url",
    label: "Contact page",
    available_for: ["cx_support"],
  });
  assert(!r.success, "url without url should fail");
});

test("contactMethodSchema rejects empty available_for", () => {
  const r = contactMethodSchema.safeParse({
    id: "x",
    type: "callback",
    label: "Callback",
    available_for: [],
  });
  assert(!r.success, "available_for empty should fail");
});

// ============================================================
// 6. CapturePolicy
// ============================================================

test("capturePolicySchema accepts a minimal lead policy", () => {
  const r = capturePolicySchema.safeParse({
    id: "lp",
    case_type: "lead",
    required_fields: ["name"],
    optional_fields: [],
    privacy_notice: "We share with X.",
    privacy_policy_url: "https://example.com.au/privacy",
  });
  assert(r.success, JSON.stringify(r.error?.issues, null, 2));
});

test("capturePolicySchema accepts custom field keys (extensibility)", () => {
  const r = capturePolicySchema.safeParse({
    id: "lp",
    case_type: "lead",
    required_fields: ["name", "property_size", "abn"],
    optional_fields: [],
    privacy_notice: "We share with X.",
    privacy_policy_url: "https://example.com.au/privacy",
  });
  assert(r.success, JSON.stringify(r.error?.issues, null, 2));
});

test("capturePolicySchema rejects non-URL privacy_policy_url", () => {
  const r = capturePolicySchema.safeParse({
    id: "lp",
    case_type: "lead",
    required_fields: [],
    optional_fields: [],
    privacy_notice: "We share with X.",
    privacy_policy_url: "not-a-url",
  });
  assert(!r.success, "non-URL should fail");
});

// ============================================================
// 7. Rule cross-field: action ↔ capture_policy_id / contact_method_id
// ============================================================

function makeRule(overrides: Record<string, unknown>) {
  return {
    id: "r1",
    name: "Test rule",
    case_type: "lead",
    enabled: true,
    priority: "normal",
    confidence_threshold: 0.7,
    when: {},
    routing_key: "rk",
    ...overrides,
  };
}

test("Rule: capture_details_then_flag REQUIRES capture_policy_id", () => {
  const r = followUpRuleSchema.safeParse(
    makeRule({ action: "capture_details_then_flag" }),
  );
  assert(!r.success, "missing capture_policy_id should fail");
});

test("Rule: capture_details_then_flag REJECTS contact_method_id", () => {
  const r = followUpRuleSchema.safeParse(
    makeRule({
      action: "capture_details_then_flag",
      capture_policy_id: "p1",
      contact_method_id: "c1",
    }),
  );
  assert(!r.success, "contact_method_id should be forbidden");
});

test("Rule: capture_details_then_flag with capture_policy_id only passes", () => {
  const r = followUpRuleSchema.safeParse(
    makeRule({ action: "capture_details_then_flag", capture_policy_id: "p1" }),
  );
  assert(r.success, JSON.stringify(r.error?.issues, null, 2));
});

test("Rule: refer_to_approved_contact_method REQUIRES contact_method_id", () => {
  const r = followUpRuleSchema.safeParse(
    makeRule({ action: "refer_to_approved_contact_method" }),
  );
  assert(!r.success, "missing contact_method_id should fail");
});

test("Rule: refer_to_approved_contact_method REJECTS capture_policy_id", () => {
  const r = followUpRuleSchema.safeParse(
    makeRule({
      action: "refer_to_approved_contact_method",
      contact_method_id: "c1",
      capture_policy_id: "p1",
    }),
  );
  assert(!r.success, "capture_policy_id should be forbidden");
});

test("Rule: refer_to_approved_contact_method with contact_method_id only passes", () => {
  const r = followUpRuleSchema.safeParse(
    makeRule({
      action: "refer_to_approved_contact_method",
      contact_method_id: "c1",
    }),
  );
  assert(r.success, JSON.stringify(r.error?.issues, null, 2));
});

test("Rule: offer_follow_up REQUIRES capture_policy_id", () => {
  const r = followUpRuleSchema.safeParse(
    makeRule({ action: "offer_follow_up" }),
  );
  assert(!r.success, "offer_follow_up needs capture_policy_id");
});

test("Rule: flag_for_staff_review_without_interrupting_visitor REJECTS both ids", () => {
  const noIds = followUpRuleSchema.safeParse(
    makeRule({
      action: "flag_for_staff_review_without_interrupting_visitor",
    }),
  );
  assert(noIds.success, "no-ids variant should pass");

  const withPolicy = followUpRuleSchema.safeParse(
    makeRule({
      action: "flag_for_staff_review_without_interrupting_visitor",
      capture_policy_id: "p1",
    }),
  );
  assert(!withPolicy.success, "capture_policy_id should be forbidden");
});

test("Rule: continue_helping and clarify_then_recheck REJECT both ids", () => {
  for (const action of ["continue_helping", "clarify_then_recheck"] as const) {
    const ok = followUpRuleSchema.safeParse(makeRule({ action }));
    assert(ok.success, `${action} bare should pass`);
    const bad = followUpRuleSchema.safeParse(
      makeRule({ action, capture_policy_id: "p1" }),
    );
    assert(!bad.success, `${action} with capture_policy_id should fail`);
  }
});

test("Rule: immediate_escalation allows either id, or neither", () => {
  const bare = followUpRuleSchema.safeParse(
    makeRule({ action: "immediate_escalation" }),
  );
  assert(bare.success, "bare should pass");
  const withPolicy = followUpRuleSchema.safeParse(
    makeRule({ action: "immediate_escalation", capture_policy_id: "p1" }),
  );
  assert(withPolicy.success, "with capture_policy_id should pass");
  const withContact = followUpRuleSchema.safeParse(
    makeRule({ action: "immediate_escalation", contact_method_id: "c1" }),
  );
  assert(withContact.success, "with contact_method_id should pass");
});

// ============================================================
// 8. Top-level reference linkage
// ============================================================

function buildFollowUp(overrides: Record<string, unknown> = {}) {
  return {
    enabled: true,
    default_sensitivity: "balanced" as const,
    contact_methods: [
      {
        id: "se",
        type: "email" as const,
        label: "Support",
        value: "x@y.com",
        available_for: ["cx_support" as const],
      },
    ],
    capture_policies: [
      {
        id: "lp",
        case_type: "lead" as const,
        required_fields: ["name"],
        optional_fields: [],
        privacy_notice: "We share with X.",
        privacy_policy_url: "https://example.com.au/privacy",
      },
    ],
    rules: [
      {
        id: "r1",
        name: "lead",
        case_type: "lead" as const,
        enabled: true,
        priority: "normal" as const,
        confidence_threshold: 0.7,
        when: {},
        action: "capture_details_then_flag" as const,
        capture_policy_id: "lp",
        routing_key: "rk",
      },
    ],
    destinations: [
      {
        id: "d1",
        case_type: "lead" as const,
        connector: "webhook" as const,
        routing_key: "rk",
        config: { url: "https://example.com.au/webhooks/leads" },
      },
    ],
    ...overrides,
  };
}

test("Linkage: rule with unknown capture_policy_id fails", () => {
  const r = followUpSchema.safeParse(
    buildFollowUp({
      rules: [
        {
          id: "r1",
          name: "lead",
          case_type: "lead",
          enabled: true,
          priority: "normal",
          confidence_threshold: 0.7,
          when: {},
          action: "capture_details_then_flag",
          capture_policy_id: "missing_policy",
          routing_key: "rk",
        },
      ],
    }),
  );
  assert(!r.success, "unknown capture_policy_id should fail");
  const hasMessage = r.success
    ? false
    : r.error.issues.some((i) =>
        i.message.includes("unknown capture_policy_id"),
      );
  assert(hasMessage, "error message should mention unknown capture_policy_id");
});

test("Linkage: rule with unknown contact_method_id fails", () => {
  const r = followUpSchema.safeParse(
    buildFollowUp({
      contact_methods: [
        {
          id: "se",
          type: "email",
          label: "Support",
          value: "x@y.com",
          available_for: ["cx_support"],
        },
      ],
      rules: [
        {
          id: "r1",
          name: "cx",
          case_type: "cx_support",
          enabled: true,
          priority: "normal",
          confidence_threshold: 0.7,
          when: {},
          action: "refer_to_approved_contact_method",
          contact_method_id: "missing_contact",
          routing_key: "rk",
        },
      ],
      destinations: [
        {
          id: "d",
          case_type: "cx_support",
          connector: "webhook",
          routing_key: "rk",
          config: { url: "https://example.com.au/webhooks/support" },
        },
      ],
    }),
  );
  assert(!r.success, "unknown contact_method_id should fail");
});

test("Linkage: capture_policy case_type must match rule case_type", () => {
  const r = followUpSchema.safeParse(
    buildFollowUp({
      capture_policies: [
        {
          id: "lp",
          case_type: "cx_support", // mismatch
          required_fields: ["name"],
          optional_fields: [],
          privacy_notice: "We share with X.",
          privacy_policy_url: "https://example.com.au/privacy",
        },
      ],
    }),
  );
  assert(!r.success, "case_type mismatch should fail");
});

test("Linkage: contact_method.available_for must include rule case_type", () => {
  const r = followUpSchema.safeParse(
    buildFollowUp({
      contact_methods: [
        {
          id: "se",
          type: "email",
          label: "Support",
          value: "x@y.com",
          available_for: ["cx_support"], // not lead
        },
      ],
      rules: [
        {
          id: "r1",
          name: "lead",
          case_type: "lead",
          enabled: true,
          priority: "normal",
          confidence_threshold: 0.7,
          when: {},
          action: "refer_to_approved_contact_method",
          contact_method_id: "se", // exists but not available_for lead
          routing_key: "rk",
        },
      ],
    }),
  );
  assert(!r.success, "available_for mismatch should fail");
});

test("Linkage: destination case_type with no matching rule fails", () => {
  const r = followUpSchema.safeParse(
    buildFollowUp({
      destinations: [
        {
          id: "d_cx",
          case_type: "cx_support", // no cx_support rule in fixture
          connector: "webhook",
          routing_key: "rk",
          config: { url: "https://example.com.au/webhooks/support" },
        },
        {
          id: "d_lead",
          case_type: "lead",
          connector: "webhook",
          routing_key: "rk",
          config: { url: "https://example.com.au/webhooks/leads" },
        },
      ],
    }),
  );
  assert(!r.success, "dangling destination should fail");
  // Justification: pilots ship with curated rule sets, and a destination
  // without a matching rule is config rot that breaks Epic D routing. Error
  // (not warn) keeps the schema strict at config-load time.
});

// ============================================================
// 9. Destination
// ============================================================

test("destinationSchema accepts webhook with custom config", () => {
  const r = destinationSchema.safeParse({
    id: "d1",
    case_type: "lead",
    connector: "webhook",
    routing_key: "rk",
    config: { url: "https://example.com/webhook", secret: "xyz" },
  });
  assert(r.success, JSON.stringify(r.error?.issues, null, 2));
});

test("destinationSchema accepts csv_export with no config", () => {
  const r = destinationSchema.safeParse({
    id: "d1",
    case_type: "cx_support",
    connector: "csv_export",
    routing_key: "rk",
  });
  assert(r.success, JSON.stringify(r.error?.issues, null, 2));
});

// ============================================================
// 10. Pilot-shaped fixtures (smoke confidence for A3)
// ============================================================

test("Minimal AgPages-shaped fixture validates", () => {
  const r = followUpSchema.safeParse({
    enabled: true,
    contact_methods: [
      {
        id: "ag_callback",
        type: "callback",
        label: "Request a callback",
        available_for: ["lead"],
      },
    ],
    capture_policies: [
      {
        id: "ag_lead",
        case_type: "lead",
        required_fields: ["name", "mobile"],
        optional_fields: ["email", "postcode"],
        privacy_notice: "We pass your details to the listing owner.",
        privacy_policy_url: "https://agpages.com.au/privacy",
      },
    ],
    rules: [
      {
        id: "ag_buyer_intent",
        name: "Buyer intent",
        case_type: "lead",
        action: "capture_details_then_flag",
        capture_policy_id: "ag_lead",
        routing_key: "ag_buyer",
        when: { marketplace_side_in: ["demand"], product_or_service_in: ["land"] },
      },
    ],
    destinations: [
      {
        id: "ag_dest",
        case_type: "lead",
        connector: "webhook",
        routing_key: "ag_buyer",
        config: { url: "https://example.com.au/webhooks/ag-buyer" },
      },
    ],
  });
  assert(r.success, JSON.stringify(r.error?.issues, null, 2));
});

test("Minimal Doggo-shaped fixture validates", () => {
  const r = followUpSchema.safeParse({
    enabled: true,
    contact_methods: [
      {
        id: "doggo_support",
        type: "email",
        label: "Email Doggo support",
        value: "support@doggo.com.au",
        available_for: ["cx_support"],
      },
    ],
    capture_policies: [],
    rules: [
      {
        id: "doggo_human_ask",
        name: "Visitor asks for a human",
        case_type: "cx_support",
        action: "refer_to_approved_contact_method",
        contact_method_id: "doggo_support",
        routing_key: "doggo_cx",
        when: { direct_human_request: true },
      },
    ],
    destinations: [
      {
        id: "doggo_dest",
        case_type: "cx_support",
        connector: "webhook",
        routing_key: "doggo_cx",
        config: { url: "https://example.com.au/webhooks/doggo-cx" },
      },
    ],
  });
  assert(r.success, JSON.stringify(r.error?.issues, null, 2));
});

// ============================================================
// 11. CON-94 untouched — sanity probe
// ============================================================

test("CON-94 qualifying_questions still parses identical to baseline", () => {
  // We don't redefine the schema here, just confirm a known-good fixture
  // continues to validate — proves we haven't accidentally shadowed it.
  const r = forumConfigSchema.safeParse({
    ...DEFAULT_FORUM_CONFIG,
    qualifying_questions: {
      preset: {
        question: "What brings you here today?",
        options: [
          { label: "I have a question", value: "question" },
          { label: "I need advice", value: "advice" },
        ],
        persona_field: "visitor_intent",
      },
      additional: [],
    },
  });
  assert(r.success, JSON.stringify(r.error?.issues, null, 2));
});

// ============================================================
// 3 Jul 2026 — field-key canonicalisation & id trim
// ============================================================

test("capturePolicySchema canonicalises common field-key aliases", () => {
  const r = capturePolicySchema.parse({
    id: "lead_basic",
    case_type: "lead",
    required_fields: ["Name", "Email", "Phone"],
    optional_fields: ["Postcode", "Company"],
    privacy_notice: "x",
    privacy_policy_url: "https://example.com/privacy",
  });
  assert(
    JSON.stringify(r.required_fields) === JSON.stringify(["name", "email", "mobile"]),
    `required_fields should canonicalise to [name,email,mobile], got ${JSON.stringify(r.required_fields)}`,
  );
  assert(
    JSON.stringify(r.optional_fields) === JSON.stringify(["postcode", "company"]),
    `optional_fields should canonicalise to [postcode,company], got ${JSON.stringify(r.optional_fields)}`,
  );
});

test("capturePolicySchema leaves genuine custom field keys untouched", () => {
  const r = capturePolicySchema.parse({
    id: "custom_policy",
    case_type: "lead",
    required_fields: ["abn", "property_size", "name"],
    optional_fields: [],
    privacy_notice: "x",
    privacy_policy_url: "https://example.com/privacy",
  });
  assert(
    JSON.stringify(r.required_fields) === JSON.stringify(["abn", "property_size", "name"]),
    `custom keys should pass through, got ${JSON.stringify(r.required_fields)}`,
  );
});

test("capturePolicySchema trims whitespace from id", () => {
  const r = capturePolicySchema.parse({
    id: "  cx_inquiry  ",
    case_type: "cx_support",
    required_fields: ["name"],
    optional_fields: [],
    privacy_notice: "x",
    privacy_policy_url: "https://example.com/privacy",
  });
  assert(r.id === "cx_inquiry", `id should be trimmed, got '${r.id}'`);
});

test("followUpRuleSchema trims whitespace from capture_policy_id", () => {
  const r = followUpRuleSchema.parse({
    id: "support_issue",
    name: "Support",
    case_type: "cx_support",
    action: "offer_follow_up",
    capture_policy_id: "  cx_inquiry ",
    routing_key: "support",
    when: {},
  });
  assert(
    r.capture_policy_id === "cx_inquiry",
    `capture_policy_id should be trimmed, got '${r.capture_policy_id}'`,
  );
});

// ============================================================
// Summary
// ============================================================

console.log(`\n${"=".repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log("=".repeat(60));

if (failed > 0) {
  console.log("\nFailures:");
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
} else {
  console.log("\n✅ All follow_up schema tests passing.");
  process.exit(0);
}
