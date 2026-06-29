import { test } from "node:test";
import assert from "node:assert/strict";

import type { FollowUp } from "@/lib/forum-config/schema";

import {
  QUICK_INCOMPATIBLE_MESSAGE,
  canSwitchToQuick,
  detectFollowUpMode,
} from "../mode-detection";

function singleRuleFollowUp(): FollowUp {
  return {
    enabled: true,
    default_sensitivity: "balanced",
    allow_staff_review_flags_without_visitor_interruption: true,
    persona_source: "qualifying",
    contact_methods: [],
    capture_policies: [
      {
        id: "lead_capture",
        case_type: "lead",
        required_fields: ["name", "mobile"],
        optional_fields: [],
        privacy_notice: "We will use these details to follow up.",
        privacy_policy_url: "https://example.com.au/privacy",
      },
    ],
    rules: [
      {
        id: "buyer",
        name: "Buyer",
        case_type: "lead",
        enabled: true,
        priority: "normal",
        confidence_threshold: 0.75,
        when: {
          intent_in: ["request_quote", "check_availability"],
        },
        action: "capture_details_then_flag",
        capture_policy_id: "lead_capture",
        routing_key: "sales",
      },
    ],
    destinations: [
      {
        id: "sales_webhook",
        case_type: "lead",
        connector: "webhook",
        routing_key: "sales",
        config: {
          url: "https://hooks.example.com.au/leads",
        },
      },
    ],
  };
}

test("single-rule single-destination tenant detects as Quick", () => {
  assert.equal(detectFollowUpMode(singleRuleFollowUp()), "quick");
});

test("multi-rule tenant detects as Advanced", () => {
  const followUp = singleRuleFollowUp();
  followUp.rules = [
    ...followUp.rules,
    {
      id: "support",
      name: "Support",
      case_type: "cx_support",
      enabled: true,
      priority: "normal",
      confidence_threshold: 0.75,
      when: {
        intent_in: ["request_support"],
      },
      action: "offer_follow_up",
      capture_policy_id: "support_capture",
      routing_key: "support",
    },
  ];
  followUp.capture_policies = [
    ...followUp.capture_policies,
    {
      id: "support_capture",
      case_type: "cx_support",
      required_fields: ["email"],
      optional_fields: [],
      privacy_notice: "We will use these details to follow up.",
      privacy_policy_url: "https://example.com.au/privacy",
    },
  ];
  followUp.destinations = [
    ...followUp.destinations,
    {
      id: "support_webhook",
      case_type: "cx_support",
      connector: "webhook",
      routing_key: "support",
      config: {
        url: "https://hooks.example.com.au/support",
      },
    },
  ];

  assert.equal(detectFollowUpMode(followUp), "advanced");
});

test("incompatible Advanced to Quick switch returns the diagnostic", () => {
  const followUp = singleRuleFollowUp();
  followUp.destinations = [
    ...followUp.destinations,
    {
      id: "overflow",
      case_type: "lead",
      connector: "webhook",
      routing_key: "overflow",
      config: {
        url: "https://hooks.example.com.au/overflow",
      },
    },
  ];

  assert.deepEqual(canSwitchToQuick(followUp), {
    compatible: false,
    reason: QUICK_INCOMPATIBLE_MESSAGE,
  });
});
