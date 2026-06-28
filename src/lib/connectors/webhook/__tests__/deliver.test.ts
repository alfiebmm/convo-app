import { test } from "node:test";
import assert from "node:assert/strict";

import { encryptWebhookSecret } from "@/lib/connectors/webhook/crypto";
import {
  deliverPendingWebhooks,
  type WebhookDeliveryStore,
  type WebhookOutboxDeliveryRow,
} from "@/lib/connectors/webhook/deliver";
import type { WebhookSettings } from "@/lib/connectors/webhook/settings";

const TENANT_A = "a1111111-1111-4111-8111-111111111111";
const TENANT_B = "b2222222-2222-4222-9222-222222222222";
const CASE_A = "c1111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-06-28T00:00:00.000Z");

process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = Buffer.from(
  "12345678901234567890123456789012",
).toString("base64");

type MutableRow = WebhookOutboxDeliveryRow & {
  status: "pending" | "sent" | "failed" | "abandoned";
  lastError: string | null;
  nextAttemptAt: Date;
  deliveredAt: Date | null;
};

function row(
  overrides: Partial<MutableRow> = {},
): MutableRow {
  return {
    id: "outbox-1",
    tenantId: TENANT_A,
    caseId: CASE_A,
    destinationId: "https://tenant.example.com/webhooks/convo",
    payload: { event: "case.created", case: { id: CASE_A } },
    attemptCount: 0,
    createdAt: new Date("2026-06-27T23:59:00.000Z"),
    idempotencyKey: "case.created:test",
    status: "pending",
    lastError: null,
    nextAttemptAt: NOW,
    deliveredAt: null,
    ...overrides,
  };
}

function settings(): WebhookSettings {
  return {
    enabled: true,
    url: "https://tenant.example.com/webhooks/convo",
    secret_ciphertext: encryptWebhookSecret("whsec_test_secret"),
    events: ["case.created", "case.updated", "case.resolved", "contact.updated"],
  };
}

function createStore(rows: MutableRow[]): WebhookDeliveryStore & {
  listCalls: string[];
} {
  const listCalls: string[] = [];
  return {
    listCalls,
    async listTenantIds() {
      return [TENANT_A, TENANT_B];
    },
    async listPendingWebhookOutboxRows(tenantId, limit, now) {
      listCalls.push(tenantId);
      return rows
        .filter(
          (candidate) =>
            candidate.tenantId === tenantId &&
            candidate.status === "pending" &&
            candidate.nextAttemptAt <= now,
        )
        .slice(0, limit)
        .map((candidate) => ({ ...candidate }));
    },
    async getTenantWebhookSettings() {
      return settings();
    },
    async markSent(tenantId, rowId, now) {
      const item = rows.find((candidate) => candidate.tenantId === tenantId && candidate.id === rowId);
      assert.ok(item);
      item.status = "sent";
      item.deliveredAt = now;
      item.attemptCount += 1;
      item.lastError = null;
    },
    async markFailed(tenantId, rowId, error) {
      const item = rows.find((candidate) => candidate.tenantId === tenantId && candidate.id === rowId);
      assert.ok(item);
      item.status = "failed";
      item.attemptCount += 1;
      item.lastError = error;
    },
    async markRetry(tenantId, rowId, error, nextAttemptAt) {
      const item = rows.find((candidate) => candidate.tenantId === tenantId && candidate.id === rowId);
      assert.ok(item);
      item.attemptCount += 1;
      item.lastError = error;
      item.nextAttemptAt = nextAttemptAt;
    },
    async markAbandoned(tenantId, rowId, error) {
      const item = rows.find((candidate) => candidate.tenantId === tenantId && candidate.id === rowId);
      assert.ok(item);
      item.status = "abandoned";
      item.attemptCount += 1;
      item.lastError = error;
    },
  };
}

function response(status: number): Response {
  return new Response("", { status });
}

test("deliverPendingWebhooks marks 200 OK rows sent", async () => {
  const rows = [row()];
  const store = createStore(rows);

  const summary = await deliverPendingWebhooks(
    { tenantId: TENANT_A, now: NOW },
    { store, fetchFn: async () => response(200) },
  );

  assert.deepEqual(summary, { scanned: 1, sent: 1, failed: 0, abandoned: 0, deferred: 0 });
  assert.equal(rows[0].status, "sent");
  assert.equal(rows[0].attemptCount, 1);
  assert.equal(rows[0].deliveredAt, NOW);
});

test("deliverPendingWebhooks marks 400 responses failed without retry", async () => {
  const rows = [row()];
  const store = createStore(rows);

  const summary = await deliverPendingWebhooks(
    { tenantId: TENANT_A, now: NOW },
    { store, fetchFn: async () => response(400) },
  );

  assert.deepEqual(summary, { scanned: 1, sent: 0, failed: 1, abandoned: 0, deferred: 0 });
  assert.equal(rows[0].status, "failed");
  assert.equal(rows[0].attemptCount, 1);
  assert.equal(rows[0].lastError, "Webhook returned HTTP 400");
});

test("deliverPendingWebhooks retries 500 responses with first backoff", async () => {
  const rows = [row()];
  const store = createStore(rows);

  const summary = await deliverPendingWebhooks(
    { tenantId: TENANT_A, now: NOW },
    { store, fetchFn: async () => response(500) },
  );

  assert.deepEqual(summary, { scanned: 1, sent: 0, failed: 0, abandoned: 0, deferred: 1 });
  assert.equal(rows[0].status, "pending");
  assert.equal(rows[0].attemptCount, 1);
  assert.equal(rows[0].nextAttemptAt.toISOString(), "2026-06-28T00:01:00.000Z");
});

test("deliverPendingWebhooks abandons after the fifth failed attempt", async () => {
  const rows = [row({ attemptCount: 4 })];
  const store = createStore(rows);

  const summary = await deliverPendingWebhooks(
    { tenantId: TENANT_A, now: NOW },
    { store, fetchFn: async () => response(500) },
  );

  assert.deepEqual(summary, { scanned: 1, sent: 0, failed: 0, abandoned: 1, deferred: 0 });
  assert.equal(rows[0].status, "abandoned");
  assert.equal(rows[0].attemptCount, 5);
});

test("deliverPendingWebhooks treats timeout/AbortSignal failures as retryable", async () => {
  const rows = [row()];
  const store = createStore(rows);

  const summary = await deliverPendingWebhooks(
    { tenantId: TENANT_A, now: NOW },
    {
      store,
      fetchFn: async () => {
        throw new DOMException("Request timed out", "TimeoutError");
      },
    },
  );

  assert.deepEqual(summary, { scanned: 1, sent: 0, failed: 0, abandoned: 0, deferred: 1 });
  assert.equal(rows[0].status, "pending");
  assert.equal(rows[0].attemptCount, 1);
});

test("deliverPendingWebhooks scoped to tenant B does not load tenant A rows", async () => {
  const rows = [row({ tenantId: TENANT_A })];
  const store = createStore(rows);

  const summary = await deliverPendingWebhooks(
    { tenantId: TENANT_B, now: NOW },
    { store, fetchFn: async () => response(200) },
  );

  assert.deepEqual(summary, { scanned: 0, sent: 0, failed: 0, abandoned: 0, deferred: 0 });
  assert.deepEqual(store.listCalls, [TENANT_B]);
  assert.equal(rows[0].status, "pending");
});
