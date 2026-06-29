import { and, desc, eq, gte, sql } from "drizzle-orm";

import { assertTenantId } from "@/lib/cases/tenant-guard";
import { db as defaultDb } from "@/lib/db";
import {
  connectorOutbox,
  followUpCases,
  followUpEvents,
} from "@/lib/db/schema";

export const ANALYTICS_RANGES = ["7d", "30d", "90d"] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export type RuleFireCount = {
  ruleId: string;
  ruleName: string;
  count: number;
};

export type CasesCreated = {
  byCaseType: Array<{ caseType: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
};

export type ConnectorDelivery = {
  successCount: number;
  failureCount: number;
};

export type CasesByRoutingKey = Array<{ routingKey: string; count: number }>;

export interface FollowUpAnalyticsStore {
  getRuleFireCounts(
    tenantId: string,
    since: Date,
  ): Promise<RuleFireCount[]>;
  getCasesCreated(tenantId: string, since: Date): Promise<CasesCreated>;
  getConnectorDelivery(
    tenantId: string,
    since: Date,
  ): Promise<ConnectorDelivery>;
  getCasesByRoutingKey(
    tenantId: string,
    since: Date,
  ): Promise<CasesByRoutingKey>;
}

type DrizzleDb = typeof defaultDb;

export function parseAnalyticsRange(range: string | undefined): AnalyticsRange {
  return ANALYTICS_RANGES.includes(range as AnalyticsRange)
    ? (range as AnalyticsRange)
    : "7d";
}

export function analyticsSince(range: AnalyticsRange, now = new Date()): Date {
  const days = Number(range.replace("d", ""));
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export function createDrizzleFollowUpAnalyticsStore(
  db: DrizzleDb = defaultDb,
): FollowUpAnalyticsStore {
  return {
    async getRuleFireCounts(tenantId, since) {
      assertTenantId(tenantId);
      const ruleIdExpr = sql<string>`coalesce(${followUpEvents.payload}->>'rule_id', 'unknown')`;
      const ruleNameExpr = sql<string>`coalesce(${followUpEvents.payload}->>'rule_name', ${followUpEvents.payload}->>'rule_id', 'Unknown rule')`;

      const rows = await db
        .select({
          ruleId: ruleIdExpr,
          ruleName: ruleNameExpr,
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(followUpEvents)
        .where(
          and(
            eq(followUpEvents.tenantId, tenantId),
            eq(followUpEvents.eventType, "rule_fired"),
            gte(followUpEvents.createdAt, since),
          ),
        )
        .groupBy(ruleIdExpr, ruleNameExpr)
        .orderBy(desc(sql`count(*)`));

      return rows;
    },

    async getCasesCreated(tenantId, since) {
      assertTenantId(tenantId);
      const [caseTypes, statuses] = await Promise.all([
        db
          .select({
            caseType: followUpCases.caseType,
            count: sql<number>`count(*)`.mapWith(Number),
          })
          .from(followUpCases)
          .where(
            and(
              eq(followUpCases.tenantId, tenantId),
              gte(followUpCases.createdAt, since),
            ),
          )
          .groupBy(followUpCases.caseType)
          .orderBy(desc(sql`count(*)`)),
        db
          .select({
            status: followUpCases.status,
            count: sql<number>`count(*)`.mapWith(Number),
          })
          .from(followUpCases)
          .where(
            and(
              eq(followUpCases.tenantId, tenantId),
              gte(followUpCases.createdAt, since),
            ),
          )
          .groupBy(followUpCases.status)
          .orderBy(desc(sql`count(*)`)),
      ]);

      return { byCaseType: caseTypes, byStatus: statuses };
    },

    async getConnectorDelivery(tenantId, since) {
      assertTenantId(tenantId);
      const [row] = await db
        .select({
          successCount: sql<number>`count(*) filter (
            where ${connectorOutbox.status} = 'sent'
              and coalesce(${connectorOutbox.deliveredAt}, ${connectorOutbox.createdAt}) >= ${since}
          )`.mapWith(Number),
          failureCount: sql<number>`count(*) filter (
            where ${connectorOutbox.status} in ('failed', 'abandoned')
              and ${connectorOutbox.attemptCount} > 0
              and coalesce(${connectorOutbox.deliveredAt}, ${connectorOutbox.createdAt}) >= ${since}
          )`.mapWith(Number),
        })
        .from(connectorOutbox)
        .where(
          and(
            eq(connectorOutbox.tenantId, tenantId),
            eq(connectorOutbox.connectorType, "webhook"),
          ),
        );

      return {
        successCount: row?.successCount ?? 0,
        failureCount: row?.failureCount ?? 0,
      };
    },

    async getCasesByRoutingKey(tenantId, since) {
      assertTenantId(tenantId);
      return db
        .select({
          routingKey: followUpCases.routingKey,
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(followUpCases)
        .where(
          and(
            eq(followUpCases.tenantId, tenantId),
            gte(followUpCases.createdAt, since),
            sql`${followUpCases.routingKey} is not null`,
          ),
        )
        .groupBy(followUpCases.routingKey)
        .orderBy(desc(sql`count(*)`))
        .limit(10)
        .then((rows) =>
          rows.map((row) => ({
            routingKey: row.routingKey ?? "Unrouted",
            count: row.count,
          })),
        );
    },
  };
}

let defaultStore: FollowUpAnalyticsStore | null = null;

function resolveStore(store?: FollowUpAnalyticsStore): FollowUpAnalyticsStore {
  if (store) return store;
  if (!defaultStore) {
    defaultStore = createDrizzleFollowUpAnalyticsStore();
  }
  return defaultStore;
}

export async function getRuleFireCountsForTenant(
  tenantId: string,
  range: AnalyticsRange,
  opts: { store?: FollowUpAnalyticsStore; now?: Date } = {},
): Promise<RuleFireCount[]> {
  assertTenantId(tenantId);
  // TODO(CON-181): `rule_fired` events are not emitted by the current
  // follow-up lifecycle; this dashboard will stay empty until that is wired.
  return resolveStore(opts.store).getRuleFireCounts(
    tenantId,
    analyticsSince(range, opts.now),
  );
}

export async function getCasesCreatedForTenant(
  tenantId: string,
  range: AnalyticsRange,
  opts: { store?: FollowUpAnalyticsStore; now?: Date } = {},
): Promise<CasesCreated> {
  assertTenantId(tenantId);
  return resolveStore(opts.store).getCasesCreated(
    tenantId,
    analyticsSince(range, opts.now),
  );
}

export async function getConnectorDeliveryForTenant(
  tenantId: string,
  range: AnalyticsRange,
  opts: { store?: FollowUpAnalyticsStore; now?: Date } = {},
): Promise<ConnectorDelivery> {
  assertTenantId(tenantId);
  return resolveStore(opts.store).getConnectorDelivery(
    tenantId,
    analyticsSince(range, opts.now),
  );
}

export async function getCasesByRoutingKeyForTenant(
  tenantId: string,
  range: AnalyticsRange,
  opts: { store?: FollowUpAnalyticsStore; now?: Date } = {},
): Promise<CasesByRoutingKey> {
  assertTenantId(tenantId);
  return resolveStore(opts.store).getCasesByRoutingKey(
    tenantId,
    analyticsSince(range, opts.now),
  );
}
