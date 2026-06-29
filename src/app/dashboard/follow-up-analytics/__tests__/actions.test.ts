import { test } from "node:test";
import assert from "node:assert/strict";

import {
  getCasesByRoutingKeyForTenant,
  getCasesCreatedForTenant,
  getConnectorDeliveryForTenant,
  getRuleFireCountsForTenant,
  parseAnalyticsRange,
  type AnalyticsRange,
  type FollowUpAnalyticsStore,
} from "../analytics";

const TENANT_A = "a1111111-1111-4111-8111-111111111111";
const TENANT_B = "b2222222-2222-4222-9222-222222222222";
const NOW = new Date("2026-06-29T00:00:00.000Z");

type RuleEvent = {
  tenantId: string;
  ruleId: string;
  ruleName: string;
  createdAt: Date;
};

type CaseRow = {
  tenantId: string;
  caseType: string;
  status: string;
  routingKey: string | null;
  createdAt: Date;
};

type ConnectorRow = {
  tenantId: string;
  connectorType: string;
  status: "pending" | "sent" | "failed" | "abandoned";
  attemptCount: number;
  createdAt: Date;
  deliveredAt: Date | null;
};

function daysAgo(days: number) {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

function createStore({
  rules = [],
  cases = [],
  connectors = [],
}: {
  rules?: RuleEvent[];
  cases?: CaseRow[];
  connectors?: ConnectorRow[];
}): FollowUpAnalyticsStore {
  return {
    async getRuleFireCounts(tenantId, since) {
      const counts = new Map<string, { ruleName: string; count: number }>();
      for (const row of rules) {
        if (row.tenantId !== tenantId || row.createdAt < since) continue;
        const current = counts.get(row.ruleId) ?? {
          ruleName: row.ruleName,
          count: 0,
        };
        counts.set(row.ruleId, { ...current, count: current.count + 1 });
      }
      return [...counts.entries()]
        .map(([ruleId, row]) => ({ ruleId, ...row }))
        .sort((a, b) => b.count - a.count);
    },
    async getCasesCreated(tenantId, since) {
      const scoped = cases.filter(
        (row) => row.tenantId === tenantId && row.createdAt >= since,
      );
      return {
        byCaseType: countBy(scoped, "caseType", "caseType"),
        byStatus: countBy(scoped, "status", "status"),
      };
    },
    async getConnectorDelivery(tenantId, since) {
      const scoped = connectors.filter((row) => {
        const finalAt = row.deliveredAt ?? row.createdAt;
        return (
          row.tenantId === tenantId &&
          row.connectorType === "webhook" &&
          finalAt >= since
        );
      });
      return {
        successCount: scoped.filter((row) => row.status === "sent").length,
        failureCount: scoped.filter(
          (row) =>
            (row.status === "failed" || row.status === "abandoned") &&
            row.attemptCount > 0,
        ).length,
      };
    },
    async getCasesByRoutingKey(tenantId, since) {
      return countBy(
        cases.filter(
          (row) =>
            row.tenantId === tenantId &&
            row.createdAt >= since &&
            row.routingKey,
        ),
        "routingKey",
        "routingKey",
      )
        .slice(0, 10)
        .map((row) => ({ routingKey: row.routingKey, count: row.count }));
    },
  };
}

function countBy<
  Row extends Record<string, unknown>,
  Key extends keyof Row,
  OutputKey extends string,
>(rows: Row[], key: Key, outputKey: OutputKey): Array<Record<OutputKey, string> & { count: number }> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = row[key];
    if (typeof value !== "string" || value.length === 0) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ [outputKey]: value, count }) as Record<OutputKey, string> & { count: number })
    .sort((a, b) => b.count - a.count);
}

test("analytics actions keep all four result sets tenant-scoped", async () => {
  const store = createStore({
    rules: [
      { tenantId: TENANT_A, ruleId: "lead", ruleName: "Lead", createdAt: daysAgo(1) },
      { tenantId: TENANT_B, ruleId: "support", ruleName: "Support", createdAt: daysAgo(1) },
    ],
    cases: [
      {
        tenantId: TENANT_A,
        caseType: "lead",
        status: "open",
        routingKey: "sales",
        createdAt: daysAgo(1),
      },
      {
        tenantId: TENANT_B,
        caseType: "cx_support",
        status: "resolved",
        routingKey: "support",
        createdAt: daysAgo(1),
      },
    ],
    connectors: [
      {
        tenantId: TENANT_A,
        connectorType: "webhook",
        status: "sent",
        attemptCount: 1,
        createdAt: daysAgo(1),
        deliveredAt: daysAgo(1),
      },
      {
        tenantId: TENANT_B,
        connectorType: "webhook",
        status: "failed",
        attemptCount: 2,
        createdAt: daysAgo(1),
        deliveredAt: null,
      },
    ],
  });

  assert.deepEqual(
    await getRuleFireCountsForTenant(TENANT_A, "7d", { store, now: NOW }),
    [{ ruleId: "lead", ruleName: "Lead", count: 1 }],
  );
  assert.deepEqual(
    await getCasesCreatedForTenant(TENANT_A, "7d", { store, now: NOW }),
    {
      byCaseType: [{ caseType: "lead", count: 1 }],
      byStatus: [{ status: "open", count: 1 }],
    },
  );
  assert.deepEqual(
    await getConnectorDeliveryForTenant(TENANT_A, "7d", { store, now: NOW }),
    { successCount: 1, failureCount: 0 },
  );
  assert.deepEqual(
    await getCasesByRoutingKeyForTenant(TENANT_A, "7d", { store, now: NOW }),
    [{ routingKey: "sales", count: 1 }],
  );
});

test("analytics actions apply 7d, 30d and 90d date ranges", async () => {
  const store = createStore({
    rules: [
      { tenantId: TENANT_A, ruleId: "recent", ruleName: "Recent", createdAt: daysAgo(3) },
      { tenantId: TENANT_A, ruleId: "month", ruleName: "Month", createdAt: daysAgo(20) },
      { tenantId: TENANT_A, ruleId: "quarter", ruleName: "Quarter", createdAt: daysAgo(80) },
      { tenantId: TENANT_A, ruleId: "old", ruleName: "Old", createdAt: daysAgo(100) },
    ],
    cases: [
      {
        tenantId: TENANT_A,
        caseType: "lead",
        status: "open",
        routingKey: "sales",
        createdAt: daysAgo(3),
      },
      {
        tenantId: TENANT_A,
        caseType: "lead",
        status: "resolved",
        routingKey: "sales",
        createdAt: daysAgo(20),
      },
      {
        tenantId: TENANT_A,
        caseType: "cx_support",
        status: "dismissed",
        routingKey: "support",
        createdAt: daysAgo(80),
      },
    ],
    connectors: [
      {
        tenantId: TENANT_A,
        connectorType: "webhook",
        status: "sent",
        attemptCount: 1,
        createdAt: daysAgo(3),
        deliveredAt: daysAgo(3),
      },
      {
        tenantId: TENANT_A,
        connectorType: "webhook",
        status: "failed",
        attemptCount: 3,
        createdAt: daysAgo(20),
        deliveredAt: null,
      },
    ],
  });

  await assertRangeCounts(store, "7d", {
    rules: 1,
    caseTypes: 1,
    delivery: { successCount: 1, failureCount: 0 },
    routingKeys: 1,
  });
  await assertRangeCounts(store, "30d", {
    rules: 2,
    caseTypes: 1,
    delivery: { successCount: 1, failureCount: 1 },
    routingKeys: 1,
  });
  await assertRangeCounts(store, "90d", {
    rules: 3,
    caseTypes: 2,
    delivery: { successCount: 1, failureCount: 1 },
    routingKeys: 2,
  });
});

test("analytics actions return clean empty results for zero data", async () => {
  const store = createStore({});

  assert.deepEqual(
    await getRuleFireCountsForTenant(TENANT_A, "7d", { store, now: NOW }),
    [],
  );
  assert.deepEqual(
    await getCasesCreatedForTenant(TENANT_A, "7d", { store, now: NOW }),
    { byCaseType: [], byStatus: [] },
  );
  assert.deepEqual(
    await getConnectorDeliveryForTenant(TENANT_A, "7d", { store, now: NOW }),
    { successCount: 0, failureCount: 0 },
  );
  assert.deepEqual(
    await getCasesByRoutingKeyForTenant(TENANT_A, "7d", { store, now: NOW }),
    [],
  );
  assert.equal(parseAnalyticsRange("invalid"), "7d");
});

test("connector delivery counts each final outbox row once", async () => {
  const store = createStore({
    connectors: [
      {
        tenantId: TENANT_A,
        connectorType: "webhook",
        status: "failed",
        attemptCount: 4,
        createdAt: daysAgo(1),
        deliveredAt: null,
      },
      {
        tenantId: TENANT_A,
        connectorType: "webhook",
        status: "pending",
        attemptCount: 2,
        createdAt: daysAgo(1),
        deliveredAt: null,
      },
    ],
  });

  assert.deepEqual(
    await getConnectorDeliveryForTenant(TENANT_A, "7d", { store, now: NOW }),
    { successCount: 0, failureCount: 1 },
  );
});

async function assertRangeCounts(
  store: FollowUpAnalyticsStore,
  range: AnalyticsRange,
  expected: {
    rules: number;
    caseTypes: number;
    delivery: { successCount: number; failureCount: number };
    routingKeys: number;
  },
) {
  assert.equal(
    (await getRuleFireCountsForTenant(TENANT_A, range, { store, now: NOW }))
      .length,
    expected.rules,
  );
  assert.equal(
    (await getCasesCreatedForTenant(TENANT_A, range, { store, now: NOW }))
      .byCaseType.length,
    expected.caseTypes,
  );
  assert.deepEqual(
    await getConnectorDeliveryForTenant(TENANT_A, range, { store, now: NOW }),
    expected.delivery,
  );
  assert.equal(
    (await getCasesByRoutingKeyForTenant(TENANT_A, range, { store, now: NOW }))
      .length,
    expected.routingKeys,
  );
}
