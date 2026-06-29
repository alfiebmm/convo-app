import { and, desc, eq, gte, lt, or, sql } from "drizzle-orm";

import { assertTenantId, assertUuid } from "@/lib/cases/tenant-guard";
import { db as defaultDb } from "@/lib/db";
import { connectorOutbox } from "@/lib/db/schema";
import {
  createDrizzleWebhookDeliveryStore,
  deliverPendingWebhooks,
  type DeliverPendingWebhooksSummary,
  type WebhookDeliveryStore,
  type WebhookOutboxDeliveryRow,
} from "./deliver";

export const WEBHOOK_OUTBOX_PAGE_SIZE = 50;

export type WebhookOutboxStatus = "pending" | "sent" | "failed" | "abandoned";

export interface WebhookOutboxReplayRow {
  id: string;
  event: string;
  status: WebhookOutboxStatus;
  attemptCount: number;
  createdAt: string;
  lastError: string | null;
  lastAttemptAt: string | null;
  nextAttemptAt: string;
  payload: Record<string, unknown>;
}

export interface ListOutboxRowsInput {
  status?: WebhookOutboxStatus;
  cursor?: string | null;
}

export interface ListOutboxRowsResult {
  rows: WebhookOutboxReplayRow[];
  nextCursor: string | null;
}

export interface ConnectorHealthMetrics {
  successRate24h: number;
  failureCount24h: number;
  avgLatencyMs24h: number | null;
  totalAttempts24h: number;
}

export interface WebhookReplayStore {
  listRows(
    tenantId: string,
    input: Required<Pick<ListOutboxRowsInput, "cursor">> & {
      status?: WebhookOutboxStatus;
      limit: number;
    },
  ): Promise<WebhookOutboxReplayRow[]>;
  resetRowForReplay(
    tenantId: string,
    rowId: string,
    now: Date,
  ): Promise<WebhookOutboxDeliveryRow | null>;
  getPendingDeliveryRow(
    tenantId: string,
    rowId: string,
    now: Date,
  ): Promise<WebhookOutboxDeliveryRow | null>;
  getHealthMetrics(tenantId: string, since: Date): Promise<ConnectorHealthMetrics>;
}

type DrizzleDb = typeof defaultDb;

function eventFromPayload(payload: Record<string, unknown>): string {
  return typeof payload.event === "string" ? payload.event : "unknown";
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

function encodeCursor(row: { createdAt: string; id: string }): string {
  return Buffer.from(`${row.createdAt}|${row.id}`, "utf8").toString("base64url");
}

function decodeCursor(cursor: string | null): { createdAt: Date; id: string } | null {
  if (!cursor) return null;
  const decoded = Buffer.from(cursor, "base64url").toString("utf8");
  const [createdAtRaw, id] = decoded.split("|");
  if (!createdAtRaw || !id) return null;
  assertUuid(id, "cursor row id");
  const createdAt = new Date(createdAtRaw);
  if (Number.isNaN(createdAt.getTime())) return null;
  return { createdAt, id };
}

function validateStatus(status: string | undefined): WebhookOutboxStatus | undefined {
  if (!status) return undefined;
  if (
    status === "pending" ||
    status === "sent" ||
    status === "failed" ||
    status === "abandoned"
  ) {
    return status;
  }
  throw new Error("Webhook outbox status filter is invalid");
}

function mapListRow(row: {
  id: string;
  payload: unknown;
  status: WebhookOutboxStatus;
  attemptCount: number;
  createdAt: Date;
  lastError: string | null;
  deliveredAt: Date | null;
  nextAttemptAt: Date;
}): WebhookOutboxReplayRow {
  const payload =
    row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? (row.payload as Record<string, unknown>)
      : {};

  return {
    id: row.id,
    event: eventFromPayload(payload),
    status: row.status,
    attemptCount: row.attemptCount,
    createdAt: row.createdAt.toISOString(),
    lastError: row.lastError,
    lastAttemptAt: toIso(row.deliveredAt),
    nextAttemptAt: row.nextAttemptAt.toISOString(),
    payload,
  };
}

function mapDeliveryRow(row: {
  id: string;
  tenantId: string;
  caseId: string;
  destinationId: string | null;
  payload: unknown;
  attemptCount: number;
  createdAt: Date;
  idempotencyKey: string;
}): WebhookOutboxDeliveryRow {
  return {
    id: row.id,
    tenantId: row.tenantId,
    caseId: row.caseId,
    destinationId: row.destinationId,
    payload:
      row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
        ? (row.payload as Record<string, unknown>)
        : {},
    attemptCount: row.attemptCount,
    createdAt: row.createdAt,
    idempotencyKey: row.idempotencyKey,
  };
}

export function createDrizzleWebhookReplayStore(
  db: DrizzleDb = defaultDb,
): WebhookReplayStore {
  return {
    async listRows(tenantId, input) {
      assertTenantId(tenantId);
      const cursor = decodeCursor(input.cursor);
      const filters = [
        eq(connectorOutbox.tenantId, tenantId),
        eq(connectorOutbox.connectorType, "webhook"),
      ];
      if (input.status) {
        filters.push(eq(connectorOutbox.status, input.status));
      }
      if (cursor) {
        filters.push(
          or(
            lt(connectorOutbox.createdAt, cursor.createdAt),
            and(
              eq(connectorOutbox.createdAt, cursor.createdAt),
              lt(connectorOutbox.id, cursor.id),
            ),
          )!,
        );
      }

      const rows = await db
        .select({
          id: connectorOutbox.id,
          payload: connectorOutbox.payload,
          status: connectorOutbox.status,
          attemptCount: connectorOutbox.attemptCount,
          createdAt: connectorOutbox.createdAt,
          lastError: connectorOutbox.lastError,
          deliveredAt: connectorOutbox.deliveredAt,
          nextAttemptAt: connectorOutbox.nextAttemptAt,
        })
        .from(connectorOutbox)
        .where(and(...filters))
        .orderBy(desc(connectorOutbox.createdAt), desc(connectorOutbox.id))
        .limit(input.limit);

      return rows.map((row) =>
        mapListRow({ ...row, status: row.status as WebhookOutboxStatus }),
      );
    },

    async resetRowForReplay(tenantId, rowId, now) {
      assertTenantId(tenantId);
      assertUuid(rowId, "rowId");
      const [row] = await db
        .update(connectorOutbox)
        .set({
          status: "pending",
          nextAttemptAt: now,
          lastError: null,
        })
        .where(
          and(
            eq(connectorOutbox.tenantId, tenantId),
            eq(connectorOutbox.id, rowId),
            eq(connectorOutbox.connectorType, "webhook"),
          ),
        )
        .returning({
          id: connectorOutbox.id,
          tenantId: connectorOutbox.tenantId,
          caseId: connectorOutbox.caseId,
          destinationId: connectorOutbox.destinationId,
          payload: connectorOutbox.payload,
          attemptCount: connectorOutbox.attemptCount,
          createdAt: connectorOutbox.createdAt,
          idempotencyKey: connectorOutbox.idempotencyKey,
        });

      return row ? mapDeliveryRow(row) : null;
    },

    async getPendingDeliveryRow(tenantId, rowId, now) {
      assertTenantId(tenantId);
      assertUuid(rowId, "rowId");
      const [row] = await db
        .select({
          id: connectorOutbox.id,
          tenantId: connectorOutbox.tenantId,
          caseId: connectorOutbox.caseId,
          destinationId: connectorOutbox.destinationId,
          payload: connectorOutbox.payload,
          attemptCount: connectorOutbox.attemptCount,
          createdAt: connectorOutbox.createdAt,
          idempotencyKey: connectorOutbox.idempotencyKey,
        })
        .from(connectorOutbox)
        .where(
          and(
            eq(connectorOutbox.tenantId, tenantId),
            eq(connectorOutbox.id, rowId),
            eq(connectorOutbox.connectorType, "webhook"),
            eq(connectorOutbox.status, "pending"),
            sql`${connectorOutbox.nextAttemptAt} <= ${now}`,
          ),
        )
        .limit(1);

      return row ? mapDeliveryRow(row) : null;
    },

    async getHealthMetrics(tenantId, since) {
      assertTenantId(tenantId);
      const [metrics] = await db
        .select({
          totalAttempts24h: sql<number>`count(*) filter (
            where ${connectorOutbox.attemptCount} > 0
              and coalesce(${connectorOutbox.deliveredAt}, ${connectorOutbox.createdAt}) >= ${since}
          )`.mapWith(Number),
          successCount24h: sql<number>`count(*) filter (
            where ${connectorOutbox.status} = 'sent'
              and ${connectorOutbox.deliveredAt} >= ${since}
          )`.mapWith(Number),
          failureCount24h: sql<number>`count(*) filter (
            where ${connectorOutbox.status} in ('failed', 'abandoned')
              and ${connectorOutbox.attemptCount} > 0
              and coalesce(${connectorOutbox.deliveredAt}, ${connectorOutbox.createdAt}) >= ${since}
          )`.mapWith(Number),
          avgLatencyMs24h: sql<number | null>`avg(
            extract(epoch from (${connectorOutbox.deliveredAt} - ${connectorOutbox.createdAt})) * 1000
          ) filter (
            where ${connectorOutbox.status} = 'sent'
              and ${connectorOutbox.deliveredAt} >= ${since}
          )`.mapWith((value) => (value === null ? null : Number(value))),
        })
        .from(connectorOutbox)
        .where(
          and(
            eq(connectorOutbox.tenantId, tenantId),
            eq(connectorOutbox.connectorType, "webhook"),
            or(
              gte(connectorOutbox.createdAt, since),
              gte(connectorOutbox.deliveredAt, since),
            ),
          ),
        );

      const totalAttempts24h = metrics?.totalAttempts24h ?? 0;
      const successCount24h = metrics?.successCount24h ?? 0;
      return {
        totalAttempts24h,
        failureCount24h: metrics?.failureCount24h ?? 0,
        avgLatencyMs24h: metrics?.avgLatencyMs24h ?? null,
        successRate24h:
          totalAttempts24h > 0
            ? Math.round((successCount24h / totalAttempts24h) * 1000) / 10
            : 0,
      };
    },
  };
}

export async function listOutboxRowsForTenant(
  tenantId: string,
  input: ListOutboxRowsInput = {},
  store: WebhookReplayStore = createDrizzleWebhookReplayStore(),
): Promise<ListOutboxRowsResult> {
  assertTenantId(tenantId);
  const status = validateStatus(input.status);
  const rows = await store.listRows(tenantId, {
    status,
    cursor: input.cursor ?? null,
    limit: WEBHOOK_OUTBOX_PAGE_SIZE + 1,
  });

  const pageRows = rows.slice(0, WEBHOOK_OUTBOX_PAGE_SIZE);
  const lastRow = pageRows.at(-1);
  return {
    rows: pageRows,
    nextCursor:
      rows.length > WEBHOOK_OUTBOX_PAGE_SIZE && lastRow
        ? encodeCursor(lastRow)
        : null,
  };
}

export async function replayOutboxRowForTenant(
  tenantId: string,
  rowId: string,
  opts: {
    replayStore?: WebhookReplayStore;
    deliveryStore?: WebhookDeliveryStore;
    fetchFn?: typeof fetch;
    now?: Date;
    canManageConnectors?: boolean;
  } = {},
): Promise<DeliverPendingWebhooksSummary> {
  assertTenantId(tenantId);
  assertUuid(rowId, "rowId");
  if (opts.canManageConnectors === false) {
    throw new Error("Forbidden");
  }
  const now = opts.now ?? new Date();
  const replayStore = opts.replayStore ?? createDrizzleWebhookReplayStore();
  const deliveryStore = opts.deliveryStore ?? createDrizzleWebhookDeliveryStore();
  const resetRow = await replayStore.resetRowForReplay(tenantId, rowId, now);
  if (!resetRow) {
    throw new Error("Webhook outbox row was not found for this tenant");
  }

  const scopedDeliveryStore: WebhookDeliveryStore = {
    async listTenantIds() {
      return [tenantId];
    },
    async listPendingWebhookOutboxRows(scopedTenantId, _limit, scanNow) {
      assertTenantId(scopedTenantId);
      if (scopedTenantId !== tenantId) {
        throw new Error("Webhook replay tenant scope assertion failed");
      }
      const row = await replayStore.getPendingDeliveryRow(tenantId, rowId, scanNow);
      return row ? [row] : [];
    },
    getTenantWebhookSettings: deliveryStore.getTenantWebhookSettings.bind(deliveryStore),
    getTenantWebhookConfig: deliveryStore.getTenantWebhookConfig?.bind(deliveryStore),
    markSent: deliveryStore.markSent.bind(deliveryStore),
    markFailed: deliveryStore.markFailed.bind(deliveryStore),
    markRetry: deliveryStore.markRetry.bind(deliveryStore),
    markAbandoned: deliveryStore.markAbandoned.bind(deliveryStore),
  };

  return deliverPendingWebhooks(
    { tenantId, limit: 1, now },
    { store: scopedDeliveryStore, fetchFn: opts.fetchFn },
  );
}

export async function getConnectorHealthMetricsForTenant(
  tenantId: string,
  opts: {
    replayStore?: WebhookReplayStore;
    now?: Date;
  } = {},
): Promise<ConnectorHealthMetrics> {
  assertTenantId(tenantId);
  const now = opts.now ?? new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const replayStore = opts.replayStore ?? createDrizzleWebhookReplayStore();
  return replayStore.getHealthMetrics(tenantId, since);
}
