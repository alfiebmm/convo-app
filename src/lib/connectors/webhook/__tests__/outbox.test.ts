import { test } from "node:test";
import assert from "node:assert/strict";

import {
  enqueueWebhookDelivery,
  type InsertOutboxInput,
  type WebhookOutboxStore,
} from "@/lib/connectors/webhook/outbox";
import type {
  TenantWebhookConfig,
  WebhookSettings,
} from "@/lib/connectors/webhook/settings";

const TENANT_A = "a1111111-1111-4111-8111-111111111111";
const CASE_A = "c1111111-1111-4111-8111-111111111111";

function configuredSettings(events = ["case.created"]): WebhookSettings {
  return {
    enabled: true,
    url: "https://tenant.example.com/webhooks/convo",
    secret_ciphertext: "iv:tag:ciphertext",
    events: events as WebhookSettings["events"],
  };
}

function createStore(
  settings: WebhookSettings | null,
  overrides: Partial<TenantWebhookConfig> = {},
): WebhookOutboxStore & {
  rows: Array<InsertOutboxInput & { id: string }>;
} {
  const rows: Array<InsertOutboxInput & { id: string }> = [];
  return {
    rows,
    async getTenantWebhookConfig(tenantId) {
      assert.equal(tenantId, TENANT_A);
      return {
        connector: settings,
        forumConfigDestinations: [],
        ...overrides,
      };
    },
    async insertOutbox(input) {
      if (
        rows.some(
          (row) =>
            row.tenantId === input.tenantId &&
            row.idempotencyKey === input.idempotencyKey,
        )
      ) {
        return null;
      }
      const row = { ...input, id: `outbox-${rows.length + 1}` };
      rows.push(row);
      return { id: row.id };
    },
    async findOutboxByIdempotencyKey(tenantId, idempotencyKey) {
      const row = rows.find(
        (candidate) =>
          candidate.tenantId === tenantId &&
          candidate.idempotencyKey === idempotencyKey,
      );
      return row ? { id: row.id } : null;
    },
  };
}

test("enqueueWebhookDelivery inserts a pending webhook row", async () => {
  const store = createStore(configuredSettings());
  const now = new Date("2026-06-28T00:00:00.000Z");

  const result = await enqueueWebhookDelivery(
    {
      tenantId: TENANT_A,
      caseId: CASE_A,
      event: "case.created",
      payload: { event: "case.created", case: { id: CASE_A } },
      idempotencyKey: "case.created:test",
    },
    { store, now },
  );

  assert.deepEqual(result, { status: "enqueued", id: "outbox-1" });
  assert.equal(store.rows.length, 1);
  assert.equal(store.rows[0].connectorType, "webhook");
  assert.equal(store.rows[0].destinationId, "https://tenant.example.com/webhooks/convo");
  assert.equal(store.rows[0].payloadVersion, "v1");
  assert.equal(store.rows[0].status, "pending");
  assert.equal(store.rows[0].attemptCount, 0);
  assert.equal(store.rows[0].nextAttemptAt, now);
});

test("enqueueWebhookDelivery uses forumConfig destinations when connector settings are not configured", async () => {
  const store = createStore(null, {
    forumConfigDestinations: [
      {
        id: "lead-webhook",
        case_type: "lead",
        connector: "webhook",
        routing_key: "sales",
        config: { url: "https://tenant.example.com/webhooks/leads" },
      },
    ],
  });

  const result = await enqueueWebhookDelivery(
    {
      tenantId: TENANT_A,
      caseId: CASE_A,
      event: "case.created",
      payload: {
        event: "case.created",
        case: { id: CASE_A, caseType: "lead", routingKey: "sales" },
      },
      idempotencyKey: "case.created:not-configured",
    },
    { store },
  );

  assert.deepEqual(result, { status: "enqueued", id: "outbox-1" });
  assert.equal(store.rows.length, 1);
  assert.equal(store.rows[0].destinationId, "lead-webhook");
});

test("enqueueWebhookDelivery skips when event is not subscribed", async () => {
  const store = createStore(configuredSettings(["case.resolved"]));

  const result = await enqueueWebhookDelivery(
    {
      tenantId: TENANT_A,
      caseId: CASE_A,
      event: "case.created",
      payload: { event: "case.created" },
      idempotencyKey: "case.created:not-subscribed",
    },
    { store },
  );

  assert.deepEqual(result, { status: "skipped-event-not-subscribed" });
  assert.equal(store.rows.length, 0);
});

test("enqueueWebhookDelivery returns existing id for duplicate idempotency key", async () => {
  const store = createStore(configuredSettings());
  const input = {
    tenantId: TENANT_A,
    caseId: CASE_A,
    event: "case.created" as const,
    payload: { event: "case.created" },
    idempotencyKey: "case.created:duplicate",
  };

  assert.deepEqual(await enqueueWebhookDelivery(input, { store }), {
    status: "enqueued",
    id: "outbox-1",
  });
  assert.deepEqual(await enqueueWebhookDelivery(input, { store }), {
    status: "skipped-duplicate",
    existingId: "outbox-1",
  });
  assert.equal(store.rows.length, 1);
});
