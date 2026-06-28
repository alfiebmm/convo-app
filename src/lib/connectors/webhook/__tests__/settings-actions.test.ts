import { test } from "node:test";
import assert from "node:assert/strict";

import { decryptWebhookSecret, encryptWebhookSecret } from "@/lib/connectors/webhook/crypto";
import {
  rotateWebhookSecretForTenant,
  saveWebhookSettingsForTenant,
  sendTestWebhookForTenant,
  type WebhookSettingsStore,
} from "@/lib/connectors/webhook/settings-actions";

const TENANT_ID = "a1111111-1111-4111-8111-111111111111";

process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = Buffer.from(
  "12345678901234567890123456789012",
).toString("base64");

function createStore(initial: Record<string, unknown>): WebhookSettingsStore & {
  writes: Record<string, unknown>[];
} {
  let settings = initial;
  const writes: Record<string, unknown>[] = [];

  return {
    writes,
    async getTenantSettings() {
      return settings;
    },
    async saveTenantSettings(_tenantId, nextSettings) {
      settings = nextSettings;
      writes.push(nextSettings);
      return settings;
    },
  };
}

function configuredSettings(secret = "whsec_test_secret") {
  return {
    connectors: {
      webhook: {
        enabled: true,
        url: "https://tenant.example.com/webhooks/convo",
        secret_ciphertext: encryptWebhookSecret(secret),
        events: ["case.created", "case.updated"],
      },
    },
  };
}

test("saveWebhookSettingsForTenant rejects non-HTTPS URLs", async () => {
  const store = createStore({});

  const result = await saveWebhookSettingsForTenant(
    TENANT_ID,
    {
      enabled: true,
      url: "http://tenant.example.com/webhooks/convo",
      events: ["case.created"],
    },
    store,
  );

  assert.equal(result.ok, false);
  assert.match(result.error, /https:\/\//);
  assert.equal(store.writes.length, 0);
});

test("rotateWebhookSecretForTenant generates a new encrypted secret", async () => {
  const store = createStore(configuredSettings("whsec_old_secret"));

  const result = await rotateWebhookSecretForTenant(TENANT_ID, store);

  assert.equal(result.ok, true);
  assert.match(result.plaintext, /^whsec_/);
  assert.notEqual(result.plaintext, "whsec_old_secret");
  assert.equal(store.writes.length, 1);

  const saved = store.writes[0].connectors as Record<string, unknown>;
  const webhook = saved.webhook as Record<string, unknown>;
  assert.equal(typeof webhook.secret_ciphertext, "string");
  assert.notEqual(webhook.secret_ciphertext, result.plaintext);
  assert.equal(
    decryptWebhookSecret(webhook.secret_ciphertext as string),
    result.plaintext,
  );
});

test("sendTestWebhookForTenant POSTs a signed test payload", async () => {
  const store = createStore(configuredSettings());
  let request: { url: string; init: RequestInit } | null = null;

  const result = await sendTestWebhookForTenant(
    TENANT_ID,
    store,
    {
      now: new Date("2026-06-28T00:00:00.000Z"),
      fetchFn: async (url, init) => {
        request = { url: String(url), init: init ?? {} };
        return new Response("", { status: 200 });
      },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.statusCode, 200);
  assert.equal(typeof result.latencyMs, "number");
  assert.ok(request);
  assert.equal(request.url, "https://tenant.example.com/webhooks/convo");
  assert.equal(request.init.method, "POST");
  assert.equal(
    (request.init.headers as Record<string, string>)["Content-Type"],
    "application/json",
  );
  assert.match(
    (request.init.headers as Record<string, string>)["X-Convo-Signature"],
    /^t=\d+,v1=/,
  );
  assert.match(
    (request.init.headers as Record<string, string>)["Idempotency-Key"],
    /^test\.ping:/,
  );
  assert.deepEqual(JSON.parse(String(request.init.body)), {
    event: "test.ping",
    occurred_at: "2026-06-28T00:00:00.000Z",
    data: {
      tenant_id: TENANT_ID,
      message: "Webhook test ping",
    },
  });
  assert.equal(store.writes.length, 0);
});

test("sendTestWebhookForTenant reports 4xx responses as failures", async () => {
  const store = createStore(configuredSettings());

  const result = await sendTestWebhookForTenant(
    TENANT_ID,
    store,
    { fetchFn: async () => new Response("", { status: 400 }) },
  );

  assert.deepEqual(result, {
    ok: false,
    error: "Webhook returned HTTP 400",
  });
  assert.equal(store.writes.length, 0);
});

test("sendTestWebhookForTenant reports timeout failures", async () => {
  const store = createStore(configuredSettings());

  const result = await sendTestWebhookForTenant(
    TENANT_ID,
    store,
    {
      fetchFn: async () => {
        throw new DOMException("Request timed out", "TimeoutError");
      },
    },
  );

  assert.deepEqual(result, {
    ok: false,
    error: "Request timed out",
  });
  assert.equal(store.writes.length, 0);
});
