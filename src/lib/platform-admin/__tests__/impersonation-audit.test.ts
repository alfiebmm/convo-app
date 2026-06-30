/**
 * CON-239 \u2014 verify the audit contract for impersonation events.
 *
 * The server actions call `withAuditLog` with `impersonation.start`
 * (sensitive, requires reason) and `impersonation.end` (non-sensitive).
 * We exercise the contract directly with a mock store + actor so we
 * fail loudly if anyone re-classifies the events or removes them.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  withAuditLog,
  type AuditRowInsert,
  type AuditStore,
} from "../audit";

function makeStore(rows: AuditRowInsert[]): AuditStore {
  return {
    async insert(row) {
      rows.push(row);
    },
    async findSuccessfulOutcome() {
      return null;
    },
  };
}

const ACTOR = { id: "staff-1", email: "staff@example.com" };

test("impersonation.start writes intent + success rows with a reason", async () => {
  const rows: AuditRowInsert[] = [];
  const result = await withAuditLog(
    {
      action: "impersonation.start",
      target: { type: "tenant", id: "tenant-1" },
      reason: "QA debugging",
      fn: async () => ({ tenantId: "tenant-1" }),
    },
    { getActor: async () => ACTOR, store: makeStore(rows) },
  );

  assert.equal(result.ok, true);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.action, "impersonation.start");
  assert.equal(rows[0]!.status, "intent");
  assert.equal(rows[0]!.reason, "QA debugging");
  assert.equal(rows[0]!.actor_user_id, "staff-1");
  assert.equal(rows[1]!.status, "outcome:success");
  assert.equal(rows[1]!.target_id, "tenant-1");
});

test("impersonation.start without a reason throws (sensitive action)", async () => {
  const rows: AuditRowInsert[] = [];
  await assert.rejects(
    () =>
      // @ts-expect-error \u2014 deliberately omitting `reason` to assert the
      // runtime guard fires when callers forget the reason.
      withAuditLog(
        {
          action: "impersonation.start",
          target: { type: "tenant", id: "tenant-1" },
          fn: async () => ({}),
        },
        { getActor: async () => ACTOR, store: makeStore(rows) },
      ),
    /Audit reason is required for impersonation\.start/,
  );
});

test("impersonation.end writes intent + success rows, reason optional", async () => {
  const rows: AuditRowInsert[] = [];
  const result = await withAuditLog(
    {
      action: "impersonation.end",
      target: { type: "tenant", id: "tenant-1" },
      fn: async () => ({ tenantId: "tenant-1" }),
    },
    { getActor: async () => ACTOR, store: makeStore(rows) },
  );

  assert.equal(result.ok, true);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.action, "impersonation.end");
  assert.equal(rows[0]!.status, "intent");
  assert.equal(rows[0]!.reason, null);
  assert.equal(rows[1]!.status, "outcome:success");
});
