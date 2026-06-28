import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseTenantWebhookSettings,
  parseWebhookSettings,
} from "@/lib/connectors/webhook/settings";

test("parseWebhookSettings accepts the configured webhook settings shape", () => {
  const settings = parseWebhookSettings({
    enabled: true,
    url: "https://tenant.example.com/webhooks/convo",
    secret_ciphertext: "iv:tag:ciphertext",
    events: ["case.created", "case.updated", "case.resolved", "contact.updated"],
  });

  assert.equal(settings.enabled, true);
  assert.equal(settings.events.length, 4);
});

test("parseWebhookSettings rejects non-HTTPS URLs", () => {
  assert.throws(() =>
    parseWebhookSettings({
      enabled: true,
      url: "http://tenant.example.com/webhooks/convo",
      secret_ciphertext: null,
      events: ["case.created"],
    }),
  );
});

test("parseTenantWebhookSettings reads tenants.settings.connectors.webhook", () => {
  const settings = parseTenantWebhookSettings({
    connectors: {
      webhook: {
        enabled: false,
        url: "https://tenant.example.com/webhooks/convo",
        secret_ciphertext: null,
        events: ["contact.updated"],
      },
    },
  });

  assert.equal(settings?.enabled, false);
  assert.deepEqual(settings?.events, ["contact.updated"]);
});
