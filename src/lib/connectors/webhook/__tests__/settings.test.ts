import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWebhookConnectorSettings } from "../settings";

test("parseWebhookConnectorSettings accepts a minimal empty object via defaults", () => {
  const r = parseWebhookConnectorSettings({});
  assert.equal(r.success, true);
  if (r.success) {
    assert.equal(r.data.enabled, false);
    assert.equal(r.data.secret_ciphertext, null);
    assert.deepEqual(r.data.events, []);
    assert.equal(r.data.url, undefined);
  }
});

test("parseWebhookConnectorSettings accepts a fully-populated config", () => {
  const r = parseWebhookConnectorSettings({
    enabled: true,
    url: "https://example.com/hooks/convo",
    secret_ciphertext: "iv:tag:ct",
    events: ["case.created", "contact.updated"],
  });
  assert.equal(r.success, true);
  if (r.success) {
    assert.equal(r.data.enabled, true);
    assert.equal(r.data.url, "https://example.com/hooks/convo");
    assert.deepEqual(r.data.events, ["case.created", "contact.updated"]);
  }
});

test("parseWebhookConnectorSettings rejects http:// URLs (https required)", () => {
  const r = parseWebhookConnectorSettings({
    enabled: true,
    url: "http://insecure.example.com/hook",
  });
  assert.equal(r.success, false);
});

test("parseWebhookConnectorSettings rejects unknown event types", () => {
  const r = parseWebhookConnectorSettings({
    events: ["case.created", "case.unknown"],
  });
  assert.equal(r.success, false);
});

test("parseWebhookConnectorSettings rejects non-string secret_ciphertext", () => {
  const r = parseWebhookConnectorSettings({ secret_ciphertext: 123 });
  assert.equal(r.success, false);
});

test("parseWebhookConnectorSettings accepts explicit null secret_ciphertext", () => {
  const r = parseWebhookConnectorSettings({ secret_ciphertext: null });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.secret_ciphertext, null);
});
