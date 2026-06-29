import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";

import { db as defaultDb } from "@/lib/db";
import { connectorOutbox, tenants } from "@/lib/db/schema";
import { assertTenantId } from "@/lib/cases/tenant-guard";
import { logAuditEvent } from "@/lib/audit/log-event";
import { decryptWebhookSecret } from "./crypto";
import { postSignedWebhook } from "./http";
import {
  parseTenantWebhookConfig,
  parseTenantWebhookSettings,
  type TenantWebhookConfig,
  type WebhookEvent,
  type WebhookSettings,
} from "./settings";

const BACKOFF_SECONDS = [60, 300, 1800, 7200, 43200] as const;

export interface WebhookOutboxDeliveryRow {
  id: string;
  tenantId: string;
  caseId: string;
  destinationId: string | null;
  payload: Record<string, unknown>;
  attemptCount: number;
  createdAt: Date;
  idempotencyKey: string;
}

export type DeliverPendingWebhooksSummary = {
  scanned: number;
  sent: number;
  failed: number;
  abandoned: number;
  deferred: number;
};

export interface DeliverPendingWebhooksInput {
  tenantId?: string;
  limit?: number;
  now?: Date;
}

export interface WebhookDeliveryStore {
  listTenantIds(): Promise<string[]>;
  listPendingWebhookOutboxRows(
    tenantId: string,
    limit: number,
    now: Date,
  ): Promise<WebhookOutboxDeliveryRow[]>;
  getTenantWebhookSettings(tenantId: string): Promise<WebhookSettings | null>;
  getTenantWebhookConfig?(tenantId: string): Promise<TenantWebhookConfig>;
  markSent(tenantId: string, rowId: string, now: Date): Promise<void>;
  markFailed(
    tenantId: string,
    rowId: string,
    error: string,
    now: Date,
  ): Promise<void>;
  markRetry(
    tenantId: string,
    rowId: string,
    error: string,
    nextAttemptAt: Date,
  ): Promise<void>;
  markAbandoned(
    tenantId: string,
    rowId: string,
    error: string,
    now: Date,
  ): Promise<void>;
}

type DrizzleDb = typeof defaultDb;

export function createDrizzleWebhookDeliveryStore(
  db: DrizzleDb = defaultDb,
): WebhookDeliveryStore {
  return {
    async listTenantIds() {
      const rows = await db
        .select({ id: tenants.id })
        .from(tenants)
        .where(inArray(tenants.status, ["active", "suspended"]));
      return rows.map((row) => row.id);
    },

    async listPendingWebhookOutboxRows(tenantId, limit, now) {
      assertTenantId(tenantId);
      const rows = await db
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
            eq(connectorOutbox.connectorType, "webhook"),
            eq(connectorOutbox.status, "pending"),
            lte(connectorOutbox.nextAttemptAt, now),
          ),
        )
        .orderBy(asc(connectorOutbox.nextAttemptAt), asc(connectorOutbox.createdAt))
        .limit(limit);

      return rows as WebhookOutboxDeliveryRow[];
    },

    async getTenantWebhookSettings(tenantId) {
      assertTenantId(tenantId);
      const [tenant] = await db
        .select({ settings: tenants.settings })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      return parseTenantWebhookSettings(tenant?.settings ?? null);
    },

    async getTenantWebhookConfig(tenantId) {
      assertTenantId(tenantId);
      const [tenant] = await db
        .select({ settings: tenants.settings })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      return parseTenantWebhookConfig(tenant?.settings ?? null);
    },

    async markSent(tenantId, rowId, now) {
      assertTenantId(tenantId);
      await db
        .update(connectorOutbox)
        .set({
          status: "sent",
          deliveredAt: now,
          attemptCount: sql`${connectorOutbox.attemptCount} + 1`,
          lastError: null,
        })
        .where(and(eq(connectorOutbox.tenantId, tenantId), eq(connectorOutbox.id, rowId)));
    },

    async markFailed(tenantId, rowId, error) {
      assertTenantId(tenantId);
      await db
        .update(connectorOutbox)
        .set({
          status: "failed",
          attemptCount: sql`${connectorOutbox.attemptCount} + 1`,
          lastError: error,
        })
        .where(and(eq(connectorOutbox.tenantId, tenantId), eq(connectorOutbox.id, rowId)));
    },

    async markRetry(tenantId, rowId, error, nextAttemptAt) {
      assertTenantId(tenantId);
      await db
        .update(connectorOutbox)
        .set({
          attemptCount: sql`${connectorOutbox.attemptCount} + 1`,
          lastError: error,
          nextAttemptAt,
        })
        .where(and(eq(connectorOutbox.tenantId, tenantId), eq(connectorOutbox.id, rowId)));
    },

    async markAbandoned(tenantId, rowId, error) {
      assertTenantId(tenantId);
      await db
        .update(connectorOutbox)
        .set({
          status: "abandoned",
          attemptCount: sql`${connectorOutbox.attemptCount} + 1`,
          lastError: error,
        })
        .where(and(eq(connectorOutbox.tenantId, tenantId), eq(connectorOutbox.id, rowId)));
    },
  };
}

function isPermanentClientError(status: number): boolean {
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function nextAttemptAt(now: Date, nextAttemptNumber: number): Date {
  const index = Math.min(nextAttemptNumber - 1, BACKOFF_SECONDS.length - 1);
  return new Date(now.getTime() + BACKOFF_SECONDS[index] * 1000);
}

function webhookEventFromPayload(payload: Record<string, unknown>): WebhookEvent {
  const event = payload.event;
  if (
    event === "case.created" ||
    event === "case.updated" ||
    event === "case.resolved" ||
    event === "contact.updated"
  ) {
    return event;
  }
  throw new Error("Webhook payload event is invalid");
}

function conversationIdFromPayload(payload: Record<string, unknown>): string | null {
  const kase = payload.case;
  if (kase && typeof kase === "object" && "conversationId" in kase) {
    const conversationId = (kase as { conversationId?: unknown }).conversationId;
    return typeof conversationId === "string" ? conversationId : null;
  }
  return null;
}

async function logWebhookDeliveryAttempt(
  tenantId: string,
  row: WebhookOutboxDeliveryRow,
  payload: Record<string, unknown>,
  opts: {
    outcome: "sent" | "failed" | "deferred" | "abandoned";
    statusCode?: number;
    error?: string;
    nextAttemptAt?: Date;
  },
  enabled: boolean,
) {
  if (!enabled) return;
  await logAuditEvent({
    tenantId,
    actorId: "webhook-delivery",
    actorType: "system",
    eventType: "connector_delivery_attempt",
    caseId: row.caseId,
    conversationId: conversationIdFromPayload(payload),
    payload: {
      outbox_id: row.id,
      destination_id: row.destinationId,
      attempt_number: row.attemptCount + 1,
      outcome: opts.outcome,
      status_code: opts.statusCode,
      error: opts.error,
      next_attempt_at: opts.nextAttemptAt?.toISOString(),
    },
  });
}

function isConfigured(
  settings: WebhookSettings | null,
): settings is WebhookSettings & { secret_ciphertext: string } {
  return Boolean(settings?.enabled && settings.url && settings.secret_ciphertext);
}

interface WebhookDeliveryTarget {
  url: string;
  secretCiphertext: string | null;
  unsigned: boolean;
}

async function getTenantWebhookConfig(
  store: WebhookDeliveryStore,
  tenantId: string,
): Promise<TenantWebhookConfig> {
  if (store.getTenantWebhookConfig) {
    return store.getTenantWebhookConfig(tenantId);
  }
  return {
    connector: await store.getTenantWebhookSettings(tenantId),
    forumConfigDestinations: [],
  };
}

function resolveDeliveryTarget(
  config: TenantWebhookConfig,
  row: WebhookOutboxDeliveryRow,
): WebhookDeliveryTarget | null {
  const forumDestination = config.forumConfigDestinations.find(
    (destination) => destination.id === row.destinationId,
  );
  if (forumDestination) {
    return {
      url: forumDestination.config.url,
      secretCiphertext: forumDestination.config.secret_ciphertext ?? null,
      unsigned: !forumDestination.config.secret_ciphertext,
    };
  }

  if (isConfigured(config.connector)) {
    return {
      url: row.destinationId ?? config.connector.url,
      secretCiphertext: config.connector.secret_ciphertext,
      unsigned: false,
    };
  }

  return null;
}

export async function deliverPendingWebhooks(
  input: DeliverPendingWebhooksInput = {},
  opts?: { store?: WebhookDeliveryStore; fetchFn?: typeof fetch },
): Promise<DeliverPendingWebhooksSummary> {
  if (input.tenantId) assertTenantId(input.tenantId);

  const store = opts?.store ?? createDrizzleWebhookDeliveryStore();
  const fetchFn = opts?.fetchFn ?? fetch;
  const shouldLogAudit = !opts?.store;
  const limit = Math.max(1, input.limit ?? 50);
  const scanNow = input.now ?? new Date();
  const summary: DeliverPendingWebhooksSummary = {
    scanned: 0,
    sent: 0,
    failed: 0,
    abandoned: 0,
    deferred: 0,
  };

  const tenantIds = input.tenantId ? [input.tenantId] : await store.listTenantIds();
  for (const tenantId of tenantIds) {
    assertTenantId(tenantId);
    const remaining = limit - summary.scanned;
    if (remaining <= 0) break;

    const rows = await store.listPendingWebhookOutboxRows(
      tenantId,
      remaining,
      scanNow,
    );
    for (const row of rows) {
      if (row.tenantId !== tenantId) {
        throw new Error("Webhook outbox tenant scope assertion failed");
      }
      summary.scanned++;

      const config = await getTenantWebhookConfig(store, tenantId);
      const target = resolveDeliveryTarget(config, row);
      if (!target) {
        const message = "Webhook is not configured";
        await store.markFailed(tenantId, row.id, message, scanNow);
        await logWebhookDeliveryAttempt(
          tenantId,
          row,
          row.payload,
          { outcome: "failed", error: message },
          shouldLogAudit,
        );
        summary.failed++;
        continue;
      }

      try {
        const event = webhookEventFromPayload(row.payload);
        const body = JSON.stringify({
          event,
          occurred_at: row.createdAt.toISOString(),
          data: row.payload,
        });
        const secret = target.secretCiphertext
          ? decryptWebhookSecret(target.secretCiphertext)
          : undefined;
        if (!secret) {
          console.warn({
            event: "webhook_unsigned_delivery",
            tenant_id: tenantId,
            destination_id: row.destinationId,
          });
        }
        const response = await postSignedWebhook({
          url: target.url,
          secret,
          body,
          idempotencyKey: row.idempotencyKey,
          fetchFn,
        });

        if (response.statusCode >= 200 && response.statusCode < 300) {
          await store.markSent(tenantId, row.id, scanNow);
          await logWebhookDeliveryAttempt(
            tenantId,
            row,
            row.payload,
            { outcome: "sent", statusCode: response.statusCode },
            shouldLogAudit,
          );
          summary.sent++;
          continue;
        }

        const message = `Webhook returned HTTP ${response.statusCode}`;
        if (isPermanentClientError(response.statusCode)) {
          await store.markFailed(tenantId, row.id, message, scanNow);
          await logWebhookDeliveryAttempt(
            tenantId,
            row,
            row.payload,
            {
              outcome: "failed",
              statusCode: response.statusCode,
              error: message,
            },
            shouldLogAudit,
          );
          summary.failed++;
          continue;
        }
        if (!isRetryableStatus(response.statusCode)) {
          await store.markFailed(tenantId, row.id, message, scanNow);
          await logWebhookDeliveryAttempt(
            tenantId,
            row,
            row.payload,
            {
              outcome: "failed",
              statusCode: response.statusCode,
              error: message,
            },
            shouldLogAudit,
          );
          summary.failed++;
          continue;
        }

        const nextAttemptNumber = row.attemptCount + 1;
        if (nextAttemptNumber >= BACKOFF_SECONDS.length) {
          await store.markAbandoned(tenantId, row.id, message, scanNow);
          await logWebhookDeliveryAttempt(
            tenantId,
            row,
            row.payload,
            {
              outcome: "abandoned",
              statusCode: response.statusCode,
              error: message,
            },
            shouldLogAudit,
          );
          summary.abandoned++;
        } else {
          const retryAt = nextAttemptAt(scanNow, nextAttemptNumber);
          await store.markRetry(
            tenantId,
            row.id,
            message,
            retryAt,
          );
          await logWebhookDeliveryAttempt(
            tenantId,
            row,
            row.payload,
            {
              outcome: "deferred",
              statusCode: response.statusCode,
              error: message,
              nextAttemptAt: retryAt,
            },
            shouldLogAudit,
          );
          summary.deferred++;
        }
      } catch (error) {
        const message = errorMessage(error);
        const nextAttemptNumber = row.attemptCount + 1;
        if (nextAttemptNumber >= BACKOFF_SECONDS.length) {
          await store.markAbandoned(tenantId, row.id, message, scanNow);
          await logWebhookDeliveryAttempt(
            tenantId,
            row,
            row.payload,
            { outcome: "abandoned", error: message },
            shouldLogAudit,
          );
          summary.abandoned++;
        } else {
          const retryAt = nextAttemptAt(scanNow, nextAttemptNumber);
          await store.markRetry(
            tenantId,
            row.id,
            message,
            retryAt,
          );
          await logWebhookDeliveryAttempt(
            tenantId,
            row,
            row.payload,
            {
              outcome: "deferred",
              error: message,
              nextAttemptAt: retryAt,
            },
            shouldLogAudit,
          );
          summary.deferred++;
        }
      }
    }
  }

  return summary;
}
