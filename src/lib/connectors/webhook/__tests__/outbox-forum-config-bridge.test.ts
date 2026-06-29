import { test } from "node:test";
import assert from "node:assert/strict";

import {
  enqueueWebhookDelivery,
  type InsertOutboxInput,
  type WebhookOutboxStore,
} from "@/lib/connectors/webhook/outbox";
import type {
  ForumConfigWebhookDestination,
  TenantWebhookConfig,
  WebhookSettings,
} from "@/lib/connectors/webhook/settings";

const TENANT_A = "a1111111-1111-4111-8111-111111111111";
const TENANT_B = "b2222222-2222-4222-9222-222222222222";
const CASE_A = "c1111111-1111-4111-8111-111111111111";
const CASE_B = "d2222222-2222-4222-9222-222222222222";

function connectorSettings(): WebhookSettings {
  return {
    enabled: true,
    url: "https://tenant.example.com/webhooks/convo",
    secret_ciphertext: "iv:tag:ciphertext",
    events: ["case.created"],
  };
}

function destination(
  overrides: Partial<ForumConfigWebhookDestination> = {},
): ForumConfigWebhookDestination {
  return {
    id: "lead-webhook",
    case_type: "lead",
    connector: "webhook",
    routing_key: "sales",
    config: { url: "https://tenant.example.com/webhooks/leads" },
    ...overrides,
  };
}

function createStore(
  configs: Record<string, TenantWebhookConfig>,
): WebhookOutboxStore & { rows: Array<InsertOutboxInput & { id: string }> } {
  const rows: Array<InsertOutboxInput & { id: string }> = [];
  return {
    rows,
    async getTenantWebhookConfig(tenantId) {
      return (
        configs[tenantId] ?? {
          connector: null,
          forumConfigDestinations: [],
        }
      );
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

function input(
  overrides: Partial<Parameters<typeof enqueueWebhookDelivery>[0]> = {},
) {
  return {
    tenantId: TENANT_A,
    caseId: CASE_A,
    event: "case.created" as const,
    payload: {
      event: "case.created",
      case: { id: CASE_A, caseType: "lead", routingKey: "sales" },
    },
    idempotencyKey: "case.created:test",
    ...overrides,
  };
}

test("tenant with only forumConfig destinations enqueues matching webhooks", async () => {
  const store = createStore({
    [TENANT_A]: {
      connector: null,
      forumConfigDestinations: [destination()],
    },
  });

  const result = await enqueueWebhookDelivery(input(), { store });

  assert.deepEqual(result, { status: "enqueued", id: "outbox-1" });
  assert.equal(store.rows.length, 1);
  assert.equal(store.rows[0].destinationId, "lead-webhook");
  assert.equal(store.rows[0].idempotencyKey, "case.created:test:lead-webhook");
});

test("tenant with both webhook surfaces enqueues from both independently", async () => {
  const store = createStore({
    [TENANT_A]: {
      connector: connectorSettings(),
      forumConfigDestinations: [
        destination(),
        destination({
          id: "backup-lead-webhook",
          config: { url: "https://tenant.example.com/webhooks/backup" },
        }),
      ],
    },
  });

  const result = await enqueueWebhookDelivery(input(), { store });

  assert.deepEqual(result, { status: "enqueued", id: "outbox-1" });
  assert.deepEqual(
    store.rows.map((row) => row.destinationId),
    [
      "https://tenant.example.com/webhooks/convo",
      "lead-webhook",
      "backup-lead-webhook",
    ],
  );
  assert.equal(new Set(store.rows.map((row) => row.idempotencyKey)).size, 3);
});

test("tenant with neither webhook surface configured enqueues no rows", async () => {
  const store = createStore({
    [TENANT_A]: {
      connector: null,
      forumConfigDestinations: [],
    },
  });

  const result = await enqueueWebhookDelivery(input(), { store });

  assert.deepEqual(result, { status: "skipped-not-configured" });
  assert.equal(store.rows.length, 0);
});

test("routing_key mismatch skips forumConfig destination", async () => {
  const store = createStore({
    [TENANT_A]: {
      connector: null,
      forumConfigDestinations: [destination({ routing_key: "support" })],
    },
  });

  const result = await enqueueWebhookDelivery(input(), { store });

  assert.deepEqual(result, { status: "skipped-not-configured" });
  assert.equal(store.rows.length, 0);
});

test("case_type mismatch skips forumConfig destination", async () => {
  const store = createStore({
    [TENANT_A]: {
      connector: null,
      forumConfigDestinations: [destination({ case_type: "support" })],
    },
  });

  const result = await enqueueWebhookDelivery(input(), { store });

  assert.deepEqual(result, { status: "skipped-not-configured" });
  assert.equal(store.rows.length, 0);
});

test("tenant isolation prevents tenant A destinations enqueuing for tenant B cases", async () => {
  const store = createStore({
    [TENANT_A]: {
      connector: null,
      forumConfigDestinations: [destination()],
    },
    [TENANT_B]: {
      connector: null,
      forumConfigDestinations: [],
    },
  });

  const result = await enqueueWebhookDelivery(
    input({
      tenantId: TENANT_B,
      caseId: CASE_B,
      payload: {
        event: "case.created",
        case: { id: CASE_B, caseType: "lead", routingKey: "sales" },
      },
    }),
    { store },
  );

  assert.deepEqual(result, { status: "skipped-not-configured" });
  assert.equal(store.rows.length, 0);
});
