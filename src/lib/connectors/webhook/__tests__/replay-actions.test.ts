import { test } from "node:test";
import assert from "node:assert/strict";

import { encryptWebhookSecret } from "@/lib/connectors/webhook/crypto";
import type {
  WebhookDeliveryStore,
  WebhookOutboxDeliveryRow,
} from "@/lib/connectors/webhook/deliver";
import {
  getConnectorHealthMetricsForTenant,
  listOutboxRowsForTenant,
  replayOutboxRowForTenant,
  type ConnectorHealthMetrics,
  type WebhookOutboxReplayRow,
  type WebhookOutboxStatus,
  type WebhookReplayStore,
} from "@/lib/connectors/webhook/replay-actions";
import type { WebhookSettings } from "@/lib/connectors/webhook/settings";

const TENANT_A = "a1111111-1111-4111-8111-111111111111";
const TENANT_B = "b2222222-2222-4222-9222-222222222222";
const CASE_A = "c1111111-1111-4111-8111-111111111111";
const CASE_B = "d2222222-2222-4222-9222-222222222222";
const ROW_A = "e1111111-1111-4111-8111-111111111111";
const ROW_B = "f2222222-2222-4222-9222-222222222222";
const NOW = new Date("2026-06-28T00:00:00.000Z");

process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = Buffer.from(
  "12345678901234567890123456789012",
).toString("base64");

type MutableRow = WebhookOutboxDeliveryRow & {
  status: WebhookOutboxStatus;
  lastError: string | null;
  lastAttemptAt: string | null;
  nextAttemptAt: Date;
  deliveredAt: Date | null;
};

function row(overrides: Partial<MutableRow> = {}): MutableRow {
  return {
    id: ROW_A,
    tenantId: TENANT_A,
    caseId: CASE_A,
    destinationId: "https://tenant.example.com/webhooks/convo",
    payload: { event: "case.created", case: { id: CASE_A } },
    attemptCount: 2,
    createdAt: new Date("2026-06-27T23:55:00.000Z"),
    idempotencyKey: "case.created:test",
    status: "failed",
    lastError: "Webhook returned HTTP 500",
    lastAttemptAt: null,
    nextAttemptAt: new Date("2026-06-28T02:00:00.000Z"),
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

function toReplayRow(candidate: MutableRow): WebhookOutboxReplayRow {
  return {
    id: candidate.id,
    event: String(candidate.payload.event ?? "unknown"),
    status: candidate.status,
    attemptCount: candidate.attemptCount,
    createdAt: candidate.createdAt.toISOString(),
    lastError: candidate.lastError,
    lastAttemptAt: candidate.deliveredAt?.toISOString() ?? null,
    nextAttemptAt: candidate.nextAttemptAt.toISOString(),
    payload: candidate.payload,
  };
}

function createReplayStore(rows: MutableRow[]): WebhookReplayStore & {
  listTenantCalls: string[];
  resetTenantCalls: string[];
} {
  const listTenantCalls: string[] = [];
  const resetTenantCalls: string[] = [];

  return {
    listTenantCalls,
    resetTenantCalls,
    async listRows(tenantId, input) {
      listTenantCalls.push(tenantId);
      return rows
        .filter((candidate) => candidate.tenantId === tenantId)
        .filter((candidate) => !input.status || candidate.status === input.status)
        .slice(0, input.limit)
        .map(toReplayRow);
    },
    async resetRowForReplay(tenantId, rowId, now) {
      resetTenantCalls.push(tenantId);
      const candidate = rows.find(
        (item) => item.tenantId === tenantId && item.id === rowId,
      );
      if (!candidate) return null;
      candidate.status = "pending";
      candidate.nextAttemptAt = now;
      candidate.lastError = null;
      return { ...candidate };
    },
    async getPendingDeliveryRow(tenantId, rowId, now) {
      const candidate = rows.find(
        (item) =>
          item.tenantId === tenantId &&
          item.id === rowId &&
          item.status === "pending" &&
          item.nextAttemptAt <= now,
      );
      return candidate ? { ...candidate } : null;
    },
    async getHealthMetrics(tenantId, since) {
      return computeHealthMetrics(rows, tenantId, since);
    },
  };
}

function computeHealthMetrics(
  rows: MutableRow[],
  tenantId: string,
  since: Date,
): ConnectorHealthMetrics {
  const scopedRows = rows.filter(
    (candidate) =>
      candidate.tenantId === tenantId &&
      candidate.attemptCount > 0 &&
      (candidate.deliveredAt ?? candidate.createdAt) >= since,
  );
  const successCount = scopedRows.filter(
    (candidate) => candidate.status === "sent" && candidate.deliveredAt,
  ).length;
  const deliveredRows = scopedRows.filter(
    (candidate) => candidate.status === "sent" && candidate.deliveredAt,
  );
  const totalLatency = deliveredRows.reduce(
    (sum, candidate) =>
      sum + (candidate.deliveredAt!.getTime() - candidate.createdAt.getTime()),
    0,
  );

  return {
    totalAttempts24h: scopedRows.length,
    failureCount24h: scopedRows.filter(
      (candidate) => candidate.status === "failed" || candidate.status === "abandoned",
    ).length,
    avgLatencyMs24h:
      deliveredRows.length > 0 ? Math.round(totalLatency / deliveredRows.length) : null,
    successRate24h:
      scopedRows.length > 0
        ? Math.round((successCount / scopedRows.length) * 1000) / 10
        : 0,
  };
}

function createDeliveryStore(rows: MutableRow[]): WebhookDeliveryStore {
  return {
    async listTenantIds() {
      return [TENANT_A, TENANT_B];
    },
    async listPendingWebhookOutboxRows() {
      throw new Error("Replay tests should use the scoped replay store");
    },
    async getTenantWebhookSettings() {
      return settings();
    },
    async markSent(tenantId, rowId, now) {
      const candidate = rows.find(
        (item) => item.tenantId === tenantId && item.id === rowId,
      );
      assert.ok(candidate);
      candidate.status = "sent";
      candidate.deliveredAt = now;
      candidate.attemptCount += 1;
      candidate.lastError = null;
    },
    async markFailed(tenantId, rowId, error) {
      const candidate = rows.find(
        (item) => item.tenantId === tenantId && item.id === rowId,
      );
      assert.ok(candidate);
      candidate.status = "failed";
      candidate.attemptCount += 1;
      candidate.lastError = error;
    },
    async markRetry(tenantId, rowId, error, nextAttemptAt) {
      const candidate = rows.find(
        (item) => item.tenantId === tenantId && item.id === rowId,
      );
      assert.ok(candidate);
      candidate.status = "pending";
      candidate.attemptCount += 1;
      candidate.lastError = error;
      candidate.nextAttemptAt = nextAttemptAt;
    },
    async markAbandoned(tenantId, rowId, error) {
      const candidate = rows.find(
        (item) => item.tenantId === tenantId && item.id === rowId,
      );
      assert.ok(candidate);
      candidate.status = "abandoned";
      candidate.attemptCount += 1;
      candidate.lastError = error;
    },
  };
}

test("listOutboxRowsForTenant returns no tenant B rows for tenant A", async () => {
  const rows = [
    row({ id: ROW_A, tenantId: TENANT_A, caseId: CASE_A }),
    row({ id: ROW_B, tenantId: TENANT_B, caseId: CASE_B }),
  ];
  const store = createReplayStore(rows);

  const result = await listOutboxRowsForTenant(TENANT_A, {}, store);

  assert.deepEqual(store.listTenantCalls, [TENANT_A]);
  assert.deepEqual(
    result.rows.map((candidate) => candidate.id),
    [ROW_A],
  );
});

test("replayOutboxRowForTenant rejects a cross-tenant row id", async () => {
  const rows = [row({ id: ROW_B, tenantId: TENANT_B, caseId: CASE_B })];
  const replayStore = createReplayStore(rows);

  await assert.rejects(
    replayOutboxRowForTenant(TENANT_A, ROW_B, {
      replayStore,
      deliveryStore: createDeliveryStore(rows),
      now: NOW,
    }),
    /Webhook outbox row was not found for this tenant/,
  );

  assert.deepEqual(replayStore.resetTenantCalls, [TENANT_A]);
  assert.equal(rows[0].tenantId, TENANT_B);
  assert.equal(rows[0].status, "failed");
  assert.equal(rows[0].lastError, "Webhook returned HTTP 500");
});

test("replayOutboxRowForTenant rejects a same-tenant caller without connector manage permission", async () => {
  const rows = [row({ id: ROW_A, tenantId: TENANT_A, caseId: CASE_A })];
  const replayStore = createReplayStore(rows);

  await assert.rejects(
    replayOutboxRowForTenant(TENANT_A, ROW_A, {
      replayStore,
      deliveryStore: createDeliveryStore(rows),
      now: NOW,
      canManageConnectors: false,
    }),
    /Forbidden/,
  );

  assert.deepEqual(replayStore.resetTenantCalls, []);
  assert.equal(rows[0].status, "failed");
});

test("replayOutboxRowForTenant resets scheduling fields and delivers the selected row", async () => {
  const rows = [row({ id: ROW_A, tenantId: TENANT_A, caseId: CASE_A })];
  const replayStore = createReplayStore(rows);

  const result = await replayOutboxRowForTenant(TENANT_A, ROW_A, {
    replayStore,
    deliveryStore: createDeliveryStore(rows),
    fetchFn: async () => new Response("", { status: 200 }),
    now: NOW,
  });

  assert.deepEqual(result, {
    scanned: 1,
    sent: 1,
    failed: 0,
    abandoned: 0,
    deferred: 0,
  });
  assert.equal(rows[0].status, "sent");
  assert.equal(rows[0].nextAttemptAt, NOW);
  assert.equal(rows[0].lastError, null);
  assert.equal(rows[0].attemptCount, 3);
});

test("getConnectorHealthMetricsForTenant returns tenant-scoped 24h metrics", async () => {
  const rows = [
    row({
      id: ROW_A,
      tenantId: TENANT_A,
      status: "sent",
      attemptCount: 1,
      createdAt: new Date("2026-06-27T23:45:00.000Z"),
      deliveredAt: new Date("2026-06-27T23:45:02.000Z"),
    }),
    row({
      id: "e1111111-1111-4111-8111-111111111112",
      tenantId: TENANT_A,
      status: "failed",
      attemptCount: 1,
      createdAt: new Date("2026-06-27T23:50:00.000Z"),
      deliveredAt: null,
    }),
    row({
      id: ROW_B,
      tenantId: TENANT_B,
      status: "sent",
      attemptCount: 1,
      createdAt: new Date("2026-06-27T23:40:00.000Z"),
      deliveredAt: new Date("2026-06-27T23:40:01.000Z"),
    }),
    row({
      id: "e1111111-1111-4111-8111-111111111113",
      tenantId: TENANT_A,
      status: "sent",
      attemptCount: 1,
      createdAt: new Date("2026-06-26T23:45:00.000Z"),
      deliveredAt: new Date("2026-06-26T23:45:01.000Z"),
    }),
  ];

  const result = await getConnectorHealthMetricsForTenant(TENANT_A, {
    replayStore: createReplayStore(rows),
    now: NOW,
  });

  assert.deepEqual(result, {
    successRate24h: 50,
    failureCount24h: 1,
    avgLatencyMs24h: 2000,
    totalAttempts24h: 2,
  });
});
