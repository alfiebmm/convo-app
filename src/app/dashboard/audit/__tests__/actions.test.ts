import { test } from "node:test";
import assert from "node:assert/strict";

import {
  getAuditEventDetailForTenant,
  listAuditEventsForTenant,
  type AuditCursor,
  type AuditEventFilters,
  type AuditEventRow,
  type AuditEventsStore,
} from "../query";

const TENANT_A = "a1111111-1111-4111-8111-111111111111";
const TENANT_B = "b2222222-2222-4222-9222-222222222222";

function row(overrides: Partial<AuditEventRow>): AuditEventRow {
  return {
    id: "c3333333-3333-4333-8333-333333333333",
    tenantId: TENANT_A,
    caseId: null,
    conversationId: null,
    actorId: "actor-a",
    actorType: "user",
    eventType: "export",
    payload: {},
    createdAt: new Date("2026-06-29T01:00:00.000Z"),
    ...overrides,
  };
}

function createStore(rows: AuditEventRow[]): AuditEventsStore {
  return {
    async list(tenantId, filters, cursor, limit) {
      let scoped = rows.filter((candidate) => candidate.tenantId === tenantId);
      if (filters.eventTypes?.length) {
        scoped = scoped.filter((candidate) =>
          filters.eventTypes?.includes(candidate.eventType),
        );
      }
      if (filters.actorId) {
        scoped = scoped.filter((candidate) => candidate.actorId === filters.actorId);
      }
      if (filters.from) {
        scoped = scoped.filter((candidate) => candidate.createdAt >= filters.from!);
      }
      if (filters.to) {
        scoped = scoped.filter((candidate) => candidate.createdAt <= filters.to!);
      }
      scoped = scoped.sort((a, b) => {
        const created = b.createdAt.getTime() - a.createdAt.getTime();
        return created || a.id.localeCompare(b.id);
      });
      if (cursor) {
        const index = scoped.findIndex(
          (candidate) =>
            candidate.id === cursor.id &&
            candidate.createdAt.toISOString() === cursor.createdAt,
        );
        if (index >= 0) scoped = scoped.slice(index + 1);
      }
      const page = scoped.slice(0, limit);
      const last = page.at(-1);
      return {
        rows: page,
        nextCursor:
          scoped.length > limit && last
            ? { id: last.id, createdAt: last.createdAt.toISOString() }
            : null,
      };
    },
    async getById(tenantId, eventId) {
      return rows.find((candidate) => candidate.tenantId === tenantId && candidate.id === eventId) ?? null;
    },
  };
}

test("audit listing keeps rows tenant-scoped", async () => {
  const result = await listAuditEventsForTenant(
    TENANT_A,
    {},
    null,
    {
      store: createStore([
        row({ id: "a1111111-0000-4000-8000-000000000001", tenantId: TENANT_A }),
        row({ id: "b2222222-0000-4000-8000-000000000001", tenantId: TENANT_B }),
      ]),
    },
  );

  assert.deepEqual(
    result.rows.map((item) => item.tenantId),
    [TENANT_A],
  );
});

test("audit detail lookup returns null for another tenant's event", async () => {
  const store = createStore([
    row({ id: "a1111111-0000-4000-8000-000000000001", tenantId: TENANT_A }),
    row({ id: "b2222222-0000-4000-8000-000000000001", tenantId: TENANT_B }),
  ]);

  const own = await getAuditEventDetailForTenant(
    TENANT_A,
    "a1111111-0000-4000-8000-000000000001",
    { store },
  );
  const hidden = await getAuditEventDetailForTenant(
    TENANT_A,
    "b2222222-0000-4000-8000-000000000001",
    { store },
  );

  assert.equal(own?.tenantId, TENANT_A);
  assert.equal(hidden, null);
});

test("audit listing applies event_type filter", async () => {
  const result = await listAuditEventsForTenant(
    TENANT_A,
    { eventTypes: ["pii_reveal"] },
    null,
    {
      store: createStore([
        row({ id: "a1111111-0000-4000-8000-000000000001", eventType: "export" }),
        row({ id: "a1111111-0000-4000-8000-000000000002", eventType: "pii_reveal" }),
      ]),
    },
  );

  assert.deepEqual(
    result.rows.map((item) => item.eventType),
    ["pii_reveal"],
  );
});

test("audit listing paginates with a cursor", async () => {
  const rows = Array.from({ length: 3 }, (_, index) =>
    row({
      id: `a1111111-0000-4000-8000-00000000000${index + 1}`,
      createdAt: new Date(`2026-06-29T01:0${2 - index}:00.000Z`),
    }),
  );
  const store = createStore(rows);
  const first = await listAuditEventsForTenant(TENANT_A, {}, null, {
    store,
    limit: 2,
  });

  assert.equal(first.rows.length, 2);
  assert.deepEqual(first.nextCursor, {
    id: "a1111111-0000-4000-8000-000000000002",
    createdAt: "2026-06-29T01:01:00.000Z",
  } satisfies AuditCursor);

  const second = await listAuditEventsForTenant(
    TENANT_A,
    {} satisfies AuditEventFilters,
    first.nextCursor,
    { store, limit: 2 },
  );
  assert.deepEqual(
    second.rows.map((item) => item.id),
    ["a1111111-0000-4000-8000-000000000003"],
  );
  assert.equal(second.nextCursor, null);
});
