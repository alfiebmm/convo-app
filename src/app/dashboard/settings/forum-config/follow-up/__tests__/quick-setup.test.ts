import { test } from "node:test";
import assert from "node:assert/strict";

import { forumConfigSchema } from "@/lib/forum-config/schema";

import {
  buildForumConfigFromQuickSetup,
  quickSetupInputSchema,
  type QuickSetupInput,
  type QuickSetupPreset,
} from "../quick-setup";

const BASE_INPUT: QuickSetupInput = {
  voice_description: "Helpful, direct and practical.",
  persona_question: {
    question: "What do you need help with?",
    options: [
      { label: "Buying", value: "buying" },
      { label: "Support", value: "support" },
    ],
  },
  allowed_topics: ["pricing", "availability"],
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

for (const preset of [
  "high_intent_buyers",
  "support_requests",
  "both",
] as QuickSetupPreset[]) {
  test(`${preset} quick preset generates schema-valid forumConfig`, () => {
    const config = buildForumConfigFromQuickSetup({
      ...BASE_INPUT,
      preset,
    });

    assert.doesNotThrow(() => forumConfigSchema.parse(config));
    assert.equal(config.ai_persona.voice_description, BASE_INPUT.voice_description);
    assert.equal(
      config.qualifying_questions.preset?.question,
      BASE_INPUT.persona_question.question,
    );
    assert.deepEqual(config.allowed_topics, BASE_INPUT.allowed_topics);
  });
}

test("high_intent_buyers preset writes the required lead rule shape", () => {
  const config = buildForumConfigFromQuickSetup({
    ...BASE_INPUT,
    preset: "high_intent_buyers",
  });

  assert.deepEqual(config.follow_up.rules, [
    {
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
      capture_policy_id: "quick_lead_capture",
      routing_key: "quick_leads",
    },
  ]);
});

test("support_requests preset writes the required support rule shape", () => {
  const config = buildForumConfigFromQuickSetup({
    ...BASE_INPUT,
    preset: "support_requests",
  });

  assert.equal(config.follow_up.rules.length, 1);
  assert.deepEqual(config.follow_up.rules[0], {
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
    capture_policy_id: "quick_support_capture",
    routing_key: "quick_support",
    offer_title: "Get follow-up from the team",
  });
});

test("both preset writes lead and support rules", () => {
  const config = buildForumConfigFromQuickSetup({
    ...BASE_INPUT,
    preset: "both",
  });

  assert.deepEqual(
    config.follow_up.rules.map((rule) => rule.case_type),
    ["lead", "cx_support"],
  );
  assert.equal(config.follow_up.capture_policies.length, 2);
});

test("webhook destination input generates webhook destination shapes", () => {
  const config = buildForumConfigFromQuickSetup({
    ...BASE_INPUT,
    preset: "both",
    destination: {
      type: "webhook",
      url: "https://hooks.example.com.au/leads",
    },
  });

  assert.equal(config.follow_up.destinations.length, 2);
  assert.deepEqual(
    config.follow_up.destinations.map((destination) => ({
      connector: destination.connector,
      url: destination.config?.url,
    })),
    [
      { connector: "webhook", url: "https://hooks.example.com.au/leads" },
      { connector: "webhook", url: "https://hooks.example.com.au/leads" },
    ],
  );
  assert.deepEqual(config.follow_up.contact_methods, []);
});

test("email destination input generates one email contact method", () => {
  const config = buildForumConfigFromQuickSetup({
    ...BASE_INPUT,
    preset: "both",
    destination: {
      type: "email",
      email: "support@example.com.au",
    },
  });

  assert.deepEqual(config.follow_up.destinations, []);
  assert.deepEqual(config.follow_up.contact_methods, [
    {
      id: "quick_email_destination",
      type: "email",
      label: "Email follow-up",
      value: "support@example.com.au",
      available_for: ["lead", "cx_support"],
    },
  ]);
});

test("empty privacy notice is a validation error", () => {
  const result = quickSetupInputSchema.safeParse({
    ...BASE_INPUT,
    privacy_notice: "",
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.error.issues[0]?.path.join("."), "privacy_notice");
  }
});
