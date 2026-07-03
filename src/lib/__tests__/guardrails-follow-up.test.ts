#!/usr/bin/env node

/**
 * Guardrails follow-up-active rule tests (Bug 4, 3 Jul 2026).
 *
 * Verifies that `buildSystemPrompt` injects the "follow-up armed" hard
 * rule only when the tenant has an active follow-up program with at
 * least one capture policy AND at least one enabled interactive rule.
 *
 * Pattern matches src/lib/forum-config/__tests__/follow-up.test.ts —
 * pure tsx-runnable, no test framework.
 *
 * Run with: npx tsx src/lib/__tests__/guardrails-follow-up.test.ts
 */

import {
  buildSystemPrompt,
  hasActiveCapturePolicy,
  FOLLOW_UP_ACTIVE_RULE,
} from "../guardrails";

let passed = 0;
let failed = 0;

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
  }
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const emptyTenant = {
  id: "t1",
  name: "Empty Tenant",
  domain: "empty.example.com",
  settings: {},
};

const agpagesLikeTenant = {
  id: "t2",
  name: "AgPagesLike",
  domain: "agpages.example.com",
  settings: {
    forumConfig: {
      follow_up: {
        enabled: true,
        capture_policies: [
          {
            id: "lead_basic",
            case_type: "lead",
            required_fields: ["name", "email", "mobile"],
            optional_fields: ["postcode"],
            privacy_notice: "x",
            privacy_policy_url: "https://example.com/",
          },
        ],
        rules: [
          {
            id: "lead_high_intent",
            name: "Lead",
            case_type: "lead",
            enabled: true,
            action: "offer_follow_up",
            capture_policy_id: "lead_basic",
            routing_key: "leads",
            when: {},
          },
        ],
      },
    },
  },
};

const disabledFollowUp = {
  id: "t3",
  name: "Disabled",
  domain: "disabled.example.com",
  settings: {
    forumConfig: {
      follow_up: {
        enabled: false,
        capture_policies: [
          {
            id: "lead_basic",
            case_type: "lead",
            required_fields: ["name"],
            optional_fields: [],
            privacy_notice: "x",
            privacy_policy_url: "https://example.com/",
          },
        ],
        rules: [
          {
            id: "r",
            name: "r",
            case_type: "lead",
            enabled: true,
            action: "offer_follow_up",
            capture_policy_id: "lead_basic",
            routing_key: "leads",
            when: {},
          },
        ],
      },
    },
  },
};

const noRules = {
  id: "t4",
  name: "NoRules",
  domain: "norules.example.com",
  settings: {
    forumConfig: {
      follow_up: {
        enabled: true,
        capture_policies: [
          {
            id: "lead_basic",
            case_type: "lead",
            required_fields: ["name"],
            optional_fields: [],
            privacy_notice: "x",
            privacy_policy_url: "https://example.com/",
          },
        ],
        rules: [],
      },
    },
  },
};

console.log("🧪 guardrails follow-up-active rule tests\n");

test("hasActiveCapturePolicy returns false when settings is empty", () => {
  assert(hasActiveCapturePolicy({}) === false, "empty settings should be false");
});

test("hasActiveCapturePolicy returns true for AgPages-like config", () => {
  assert(
    hasActiveCapturePolicy(agpagesLikeTenant.settings) === true,
    "AgPages-like config should be active",
  );
});

test("hasActiveCapturePolicy respects follow_up.enabled = false", () => {
  assert(
    hasActiveCapturePolicy(disabledFollowUp.settings) === false,
    "disabled follow_up should be false",
  );
});

test("hasActiveCapturePolicy needs at least one interactive rule", () => {
  assert(
    hasActiveCapturePolicy(noRules.settings) === false,
    "no rules should be false",
  );
});

test("buildSystemPrompt omits FOLLOW_UP_ACTIVE_RULE for empty tenant", () => {
  const prompt = buildSystemPrompt(emptyTenant, {});
  assert(
    !prompt.includes(FOLLOW_UP_ACTIVE_RULE),
    "empty tenant prompt should NOT include follow-up rule",
  );
});

test("buildSystemPrompt injects FOLLOW_UP_ACTIVE_RULE for active tenant", () => {
  const prompt = buildSystemPrompt(agpagesLikeTenant, {});
  assert(
    prompt.includes(FOLLOW_UP_ACTIVE_RULE),
    "active tenant prompt SHOULD include follow-up rule",
  );
  assert(
    prompt.includes("Follow-up is armed"),
    "prompt should include the header",
  );
});

test("buildSystemPrompt omits FOLLOW_UP_ACTIVE_RULE when follow-up disabled", () => {
  const prompt = buildSystemPrompt(disabledFollowUp, {});
  assert(
    !prompt.includes(FOLLOW_UP_ACTIVE_RULE),
    "disabled follow-up should not inject rule",
  );
});

console.log(`\n${"=".repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log("=".repeat(60));
process.exit(failed > 0 ? 1 : 0);
