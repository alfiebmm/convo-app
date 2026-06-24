import { test } from "node:test";
import assert from "node:assert/strict";
import {
  withAuditLog,
  withExternalActionLog,
  type AuditRowInsert,
  type AuditStore,
} from "../audit";

const actor = { id: "00000000-0000-0000-0000-000000000218", email: "admin@example.com" };

function createStore(): AuditStore & { rows: AuditRowInsert[] } {
  const rows: AuditRowInsert[] = [];
  return {
    rows,
    async insert(row) {
      rows.push(row);
    },
    async findSuccessfulOutcome({ actorUserId, action, targetId, idempotencyKey }) {
      const row = rows
        .slice()
        .reverse()
        .find(
          (candidate) =>
            candidate.actor_user_id === actorUserId &&
            candidate.action === action &&
            candidate.target_id === targetId &&
            candidate.idempotency_key === idempotencyKey &&
            candidate.status === "outcome:success",
        );
      return row
        ? {
            after_state: row.after_state,
            metadata: row.metadata,
            correlation_id: row.correlation_id,
          }
        : null;
    },
  };
}

test("withAuditLog logs intent before fn runs", async () => {
  const store = createStore();
  const result = await withAuditLog(
    {
      action: "tenant.view",
      target: { type: "tenant", id: "tenant-a" },
      before: { status: "active" },
      fn: async () => {
        assert.equal(store.rows.length, 1);
        assert.equal(store.rows[0].status, "intent");
        assert.deepEqual(store.rows[0].before_state, { status: "active" });
        return { ok: true };
      },
    },
    { store, getActor: async () => actor },
  );

  assert.equal(result.ok, true);
});

test("withAuditLog logs outcome:success after fn returns", async () => {
  const store = createStore();
  const result = await withAuditLog(
    {
      action: "tenant.view",
      target: { type: "tenant", id: "tenant-a" },
      fn: async () => ({ saved: true }),
    },
    { store, getActor: async () => actor },
  );

  assert.equal(result.ok, true);
  assert.equal(store.rows.length, 2);
  assert.equal(store.rows[1].status, "outcome:success");
  assert.deepEqual(store.rows[1].after_state, { saved: true });
  assert.deepEqual(store.rows[1].metadata?.result_summary, {
    type: "object",
    keys: ["saved"],
  });
  assert.equal(store.rows[0].correlation_id, store.rows[1].correlation_id);
});

test("withAuditLog logs outcome:error and returns ok false without rethrowing", async () => {
  const store = createStore();
  const result = await withAuditLog(
    {
      action: "tenant.view",
      target: { type: "tenant", id: "tenant-a" },
      fn: async () => {
        throw new Error("boom");
      },
    },
    { store, getActor: async () => actor },
  );

  assert.equal(result.ok, false);
  assert.equal(store.rows.length, 2);
  assert.equal(store.rows[1].status, "outcome:error");
  assert.equal(store.rows[1].metadata?.error, "boom");
});

test("withAuditLog idempotency replay returns recorded outcome without re-executing", async () => {
  const store = createStore();
  let executions = 0;
  const input = {
    action: "tenant.view" as const,
    target: { type: "tenant", id: "tenant-a" },
    idempotencyKey: "tenant-a:view",
    fn: async () => {
      executions += 1;
      return { once: true };
    },
  };

  const first = await withAuditLog(input, { store, getActor: async () => actor });
  const second = await withAuditLog(input, { store, getActor: async () => actor });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(executions, 1);
  assert.deepEqual(second.ok ? second.value : null, { once: true });
  assert.equal(store.rows.at(-1)?.metadata?.replay, true);
});

test("withExternalActionLog writes intent before external call and outcome after local record", async () => {
  const store = createStore();
  const result = await withExternalActionLog(
    {
      action: "billing.refund",
      target: { type: "invoice", id: "in_123" },
      reason: "Customer support approved refund",
      externalCall: async () => {
        assert.equal(store.rows.length, 1);
        assert.equal(store.rows[0].status, "intent");
        return { stripeRefundId: "re_123" };
      },
      recordOutcome: async (externalResult) => {
        assert.deepEqual(externalResult, { stripeRefundId: "re_123" });
        assert.equal(store.rows.length, 1);
        return { recorded: true };
      },
    },
    { store, getActor: async () => actor },
  );

  assert.equal(result.ok, true);
  assert.equal(store.rows.length, 2);
  assert.equal(store.rows[1].status, "outcome:success");
});

function typeCheckSensitiveActionRequiresReason() {
  // @ts-expect-error billing.refund must include reason.
  void withAuditLog({
    action: "billing.refund",
    target: { type: "invoice", id: "in_123" },
    fn: async () => ({ ok: true }),
  });
}

void typeCheckSensitiveActionRequiresReason;
