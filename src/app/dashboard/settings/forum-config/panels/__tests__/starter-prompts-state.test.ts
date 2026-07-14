import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CAPTURE_FIELD_KEYS,
  FIELD_META,
} from "../../../../../../lib/capture-fields";
import { starterPromptsSchema } from "../../../../../../lib/forum-config/schema";
import {
  actionTypeFor,
  moveField,
  setFieldEnabled,
  setLabelOverride,
  slugFromLabel,
  withActionType,
} from "../starter-prompts-state";

const basePrompt = {
  emoji: "✉️",
  label: "Get in touch",
  prompt: "How do I get in touch?",
};

test("actionTypeFor treats legacy pills without action as chat", () => {
  assert.equal(actionTypeFor(basePrompt), "chat");
});

test("withActionType creates a lead-capture policy with slug suggestion", () => {
  const next = withActionType(basePrompt, "lead_capture");
  assert.equal(next.action?.type, "lead_capture");
  if (next.action?.type !== "lead_capture") return;
  assert.equal(next.action.capture_policy.id, "get_in_touch");
  assert.equal(next.action.capture_policy.case_type, "lead");
  assert.deepEqual(next.action.capture_policy.required_fields, [
    "name",
    "email",
  ]);
});

test("field selection keeps a field in required or optional, not both", () => {
  const lead = withActionType(basePrompt, "lead_capture");
  const optionalEmail = setFieldEnabled(lead, "email", "optional", true);
  assert.equal(optionalEmail.action?.type, "lead_capture");
  if (optionalEmail.action?.type !== "lead_capture") return;
  assert.deepEqual(optionalEmail.action.capture_policy.required_fields, [
    "name",
  ]);
  assert.deepEqual(optionalEmail.action.capture_policy.optional_fields, [
    "email",
  ]);
});

test("field ordering can move selected fields", () => {
  let lead = withActionType(basePrompt, "lead_capture");
  lead = setFieldEnabled(lead, "mobile", "required", true);
  lead = moveField(lead, "required", 2, 0);
  assert.equal(lead.action?.type, "lead_capture");
  if (lead.action?.type !== "lead_capture") return;
  assert.deepEqual(lead.action.capture_policy.required_fields, [
    "mobile",
    "name",
    "email",
  ]);
});

test("label overrides only attach to selected fields", () => {
  let lead = withActionType(basePrompt, "lead_capture");
  lead = setLabelOverride(lead, "postcode", "Your postcode");
  assert.equal(lead.action?.type, "lead_capture");
  if (lead.action?.type !== "lead_capture") return;
  assert.deepEqual(lead.action.field_label_overrides, {});

  lead = setLabelOverride(lead, "email", "Work email");
  assert.deepEqual(lead.action.field_label_overrides, {
    email: "Work email",
  });
});

test("schema validates each action shape used by the editor", () => {
  const lead = withActionType(basePrompt, "lead_capture");
  const embed = withActionType(basePrompt, "custom_embed");
  const parsed = starterPromptsSchema.safeParse([
    withActionType(basePrompt, "chat"),
    lead,
    {
      ...embed,
      action:
        embed.action?.type === "custom_embed"
          ? { ...embed.action, url: "https://example.com/form" }
          : embed.action,
    },
  ]);
  assert.equal(parsed.success, true);
});

test("schema rejects invalid lead-capture policy wiring", () => {
  const lead = withActionType(basePrompt, "lead_capture");
  assert.equal(lead.action?.type, "lead_capture");
  if (lead.action?.type !== "lead_capture") return;

  const duplicate = starterPromptsSchema.safeParse([
    {
      ...lead,
      action: {
        ...lead.action,
        capture_policy: {
          ...lead.action.capture_policy,
          required_fields: ["email"],
          optional_fields: ["email"],
        },
      },
    },
  ]);
  assert.equal(duplicate.success, false);

  const badOverride = starterPromptsSchema.safeParse([
    {
      ...lead,
      action: {
        ...lead.action,
        field_label_overrides: { postcode: "Postcode" },
      },
    },
  ]);
  assert.equal(badOverride.success, false);

  const httpPrivacy = starterPromptsSchema.safeParse([
    {
      ...lead,
      action: {
        ...lead.action,
        capture_policy: {
          ...lead.action.capture_policy,
          privacy_policy_url: "http://example.com/privacy",
        },
      },
    },
  ]);
  assert.equal(httpPrivacy.success, false);
});

test("shared field registry exposes the dashboard picker keys", () => {
  assert.deepEqual(CAPTURE_FIELD_KEYS, [
    "name",
    "email",
    "mobile",
    "postcode",
    "free_text_note",
    "suburb",
    "state",
    "company",
    "preferred_contact_method",
  ]);
  assert.equal(FIELD_META.email.inputType, "email");
});

test("slugFromLabel is stable for tenant-overridable policy ids", () => {
  assert.equal(slugFromLabel(" Get in touch "), "get_in_touch");
  assert.equal(slugFromLabel("Book a 15-min call"), "book_a_15_min_call");
  assert.equal(slugFromLabel(""), "starter_pill_capture");
});
