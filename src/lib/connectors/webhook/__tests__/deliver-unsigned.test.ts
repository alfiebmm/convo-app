import { test } from "node:test";
import assert from "node:assert/strict";

import {
  deliverPendingWebhooks,
  type WebhookDeliveryStore,
  type WebhookOutboxDeliveryRow,
} from "@/lib/connectors/webhook/deliver";

const TENANT_A = "a1111111-1111-4111-8111-111111111111";
const CASE_A = "c1111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-06-28T00:00:00.000Z");

type MutableRow = WebhookOutboxDeliveryRow & {
  status: "pending" | "sent" | "failed" | "abandoned";
  lastError: string | null;
  nextAttemptAt: Date;
  deliveredAt: Date | null;
};

function row(): MutableRow {
  return {
    id: "outbox-1",
    tenantId: TENANT_A,
    caseId: CASE_A,
    destinationId: "lead-webhook",
    payload: { event: "case.created", case: { id: CASE_A } },
    attemptCount: 0,
    createdAt: new Date("2026-06-27T23:59:00.000Z"),
    idempotencyKey: "case.created:test:lead-webhook",
    status: "pending",
    lastError: null,
    nextAttemptAt: NOW,
    deliveredAt: null,
  };
}

function createStore(rows: MutableRow[]): WebhookDeliveryStore {
  return {
    async listTenantIds() {
      return [TENANT_A];
    },
    async listPendingWebhookOutboxRows(tenantId, limit, now) {
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
      return null;
    },
    async getTenantWebhookConfig() {
      return {
        connector: null,
        forumConfigDestinations: [
          {
            id: "lead-webhook",
            case_type: "lead",
            connector: "webhook",
            routing_key: "sales",
            config: { url: "https://tenant.example.com/webhooks/leads" },
          },
        ],
      };
    },
    async markSent(tenantId, rowId, now) {
      const item = rows.find(
        (candidate) => candidate.tenantId === tenantId && candidate.id === rowId,
      );
      assert.ok(item);
      item.status = "sent";
      item.deliveredAt = now;
      item.attemptCount += 1;
      item.lastError = null;
    },
    async markFailed(tenantId, rowId, error) {
      const item = rows.find(
        (candidate) => candidate.tenantId === tenantId && candidate.id === rowId,
      );
      assert.ok(item);
      item.status = "failed";
      item.attemptCount += 1;
      item.lastError = error;
    },
    async markRetry(tenantId, rowId, error, nextAttemptAt) {
      const item = rows.find(
        (candidate) => candidate.tenantId === tenantId && candidate.id === rowId,
      );
      assert.ok(item);
      item.attemptCount += 1;
      item.lastError = error;
      item.nextAttemptAt = nextAttemptAt;
    },
    async markAbandoned(tenantId, rowId, error) {
      const item = rows.find(
        (candidate) => candidate.tenantId === tenantId && candidate.id === rowId,
      );
      assert.ok(item);
      item.status = "abandoned";
      item.attemptCount += 1;
      item.lastError = error;
    },
  };
}

test("unsigned forumConfig destination delivers without signature header and warns", async () => {
  const rows = [row()];
  const store = createStore(rows);
  let requestHeaders: HeadersInit | undefined;
  const warnings: unknown[] = [];
  const originalWarn = console.warn;
  console.warn = (message?: unknown) => {
    warnings.push(message);
  };

  try {
    const summary = await deliverPendingWebhooks(
      { tenantId: TENANT_A, now: NOW },
      {
        store,
        fetchFn: async (_url, init) => {
          requestHeaders = init?.headers;
          return new Response("", { status: 200 });
        },
      },
    );

    assert.deepEqual(summary, {
      scanned: 1,
      sent: 1,
      failed: 0,
      abandoned: 0,
      deferred: 0,
    });
    assert.ok(requestHeaders);
    assert.equal(
      "X-Convo-Signature" in (requestHeaders as Record<string, string>),
      false,
    );
    assert.deepEqual(warnings, [
      {
        event: "webhook_unsigned_delivery",
        tenant_id: TENANT_A,
        destination_id: "lead-webhook",
      },
    ]);
  } finally {
    console.warn = originalWarn;
  }
});
