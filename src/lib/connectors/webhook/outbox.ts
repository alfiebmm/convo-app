import { and, eq } from "drizzle-orm";

import { db as defaultDb } from "@/lib/db";
import { connectorOutbox, tenants } from "@/lib/db/schema";
import { assertTenantId, assertUuid } from "@/lib/cases/tenant-guard";
import {
  parseTenantWebhookSettings,
  type WebhookEvent,
  type WebhookSettings,
} from "./settings";

export type WebhookPayload = Record<string, unknown>;

export interface EnqueueWebhookDeliveryInput {
  tenantId: string;
  caseId: string;
  event: WebhookEvent;
  payload: WebhookPayload;
  idempotencyKey: string;
}

export type EnqueueWebhookDeliveryResult =
  | { status: "enqueued"; id: string }
  | { status: "skipped-not-configured" }
  | { status: "skipped-event-not-subscribed" }
  | { status: "skipped-duplicate"; existingId: string };

export interface InsertOutboxInput {
  tenantId: string;
  caseId: string;
  connectorType: "webhook";
  destinationId: string;
  payloadVersion: "v1";
  payload: WebhookPayload;
  status: "pending";
  nextAttemptAt: Date;
  attemptCount: 0;
  idempotencyKey: string;
}

export interface WebhookOutboxStore {
  getTenantWebhookSettings(tenantId: string): Promise<WebhookSettings | null>;
  insertOutbox(input: InsertOutboxInput): Promise<{ id: string } | null>;
  findOutboxByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<{ id: string } | null>;
}

type DrizzleDb = typeof defaultDb;

export function createDrizzleWebhookOutboxStore(
  db: DrizzleDb = defaultDb,
): WebhookOutboxStore {
  return {
    async getTenantWebhookSettings(tenantId) {
      assertTenantId(tenantId);
      const [tenant] = await db
        .select({ settings: tenants.settings })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      return parseTenantWebhookSettings(tenant?.settings ?? null);
    },

    async insertOutbox(input) {
      assertTenantId(input.tenantId);
      assertUuid(input.caseId, "caseId");
      const [row] = await db
        .insert(connectorOutbox)
        .values({
          tenantId: input.tenantId,
          caseId: input.caseId,
          connectorType: input.connectorType,
          destinationId: input.destinationId,
          payloadVersion: input.payloadVersion,
          payload: input.payload,
          status: input.status,
          nextAttemptAt: input.nextAttemptAt,
          attemptCount: input.attemptCount,
          idempotencyKey: input.idempotencyKey,
        })
        .onConflictDoNothing({
          target: [connectorOutbox.tenantId, connectorOutbox.idempotencyKey],
        })
        .returning({ id: connectorOutbox.id });

      return row ?? null;
    },

    async findOutboxByIdempotencyKey(tenantId, idempotencyKey) {
      assertTenantId(tenantId);
      const [row] = await db
        .select({ id: connectorOutbox.id })
        .from(connectorOutbox)
        .where(
          and(
            eq(connectorOutbox.tenantId, tenantId),
            eq(connectorOutbox.idempotencyKey, idempotencyKey),
          ),
        )
        .limit(1);

      return row ?? null;
    },
  };
}

let defaultStore: WebhookOutboxStore | null = null;

export function getDefaultWebhookOutboxStore(): WebhookOutboxStore {
  if (!defaultStore) {
    defaultStore = createDrizzleWebhookOutboxStore();
  }
  return defaultStore;
}

export function setDefaultWebhookOutboxStoreForTests(
  store: WebhookOutboxStore,
): void {
  defaultStore = store;
}

export function resetDefaultWebhookOutboxStore(): void {
  defaultStore = null;
}

function resolveStore(store?: WebhookOutboxStore): WebhookOutboxStore {
  return store ?? getDefaultWebhookOutboxStore();
}

function isWebhookConfigured(settings: WebhookSettings | null): settings is WebhookSettings {
  return Boolean(settings?.enabled && settings.url && settings.secret_ciphertext);
}

export async function enqueueWebhookDelivery(
  input: EnqueueWebhookDeliveryInput,
  opts?: { store?: WebhookOutboxStore; now?: Date },
): Promise<EnqueueWebhookDeliveryResult> {
  assertTenantId(input.tenantId);
  assertUuid(input.caseId, "caseId");
  if (!input.idempotencyKey) {
    throw new Error("idempotencyKey is required");
  }

  const store = resolveStore(opts?.store);
  const settings = await store.getTenantWebhookSettings(input.tenantId);
  if (!isWebhookConfigured(settings)) {
    return { status: "skipped-not-configured" };
  }
  if (!settings.events.includes(input.event)) {
    return { status: "skipped-event-not-subscribed" };
  }

  const inserted = await store.insertOutbox({
    tenantId: input.tenantId,
    caseId: input.caseId,
    connectorType: "webhook",
    destinationId: settings.url,
    payloadVersion: "v1",
    payload: input.payload,
    status: "pending",
    nextAttemptAt: opts?.now ?? new Date(),
    attemptCount: 0,
    idempotencyKey: input.idempotencyKey,
  });

  if (inserted) {
    return { status: "enqueued", id: inserted.id };
  }

  const existing = await store.findOutboxByIdempotencyKey(
    input.tenantId,
    input.idempotencyKey,
  );
  if (!existing) {
    throw new Error("Duplicate webhook outbox row could not be resolved");
  }

  return { status: "skipped-duplicate", existingId: existing.id };
}
