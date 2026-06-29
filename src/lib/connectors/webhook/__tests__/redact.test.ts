import { test } from "node:test";
import assert from "node:assert/strict";

import { redactWebhookPayload } from "@/lib/connectors/webhook/redact";

const payload = {
  event: "case.created",
  contact: {
    name: "Alex Smith",
    email: "alex@example.com",
    phone: "+61400111222",
    contact_identifiers: [
      { type: "email", value: "alex@example.com", verified: true },
      { type: "phone", value: "+61400111222", verified: false },
    ],
  },
  metadata: {
    value: "non-pii value stays visible",
  },
};

test("redactWebhookPayload returns the original payload when PII can be revealed", () => {
  const result = redactWebhookPayload(payload, { canRevealPii: true });

  assert.equal(result, payload);
  assert.deepEqual(result, payload);
});

test("redactWebhookPayload redacts email, phone, and contact identifier values", () => {
  const result = redactWebhookPayload(payload, { canRevealPii: false });

  assert.deepEqual(result, {
    event: "case.created",
    contact: {
      name: "Alex Smith",
      email: "[redacted]",
      phone: "[redacted]",
      contact_identifiers: [
        { type: "email", value: "[redacted]", verified: true },
        { type: "phone", value: "[redacted]", verified: false },
      ],
    },
    metadata: {
      value: "non-pii value stays visible",
    },
  });
});
