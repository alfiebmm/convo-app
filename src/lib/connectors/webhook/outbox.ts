import { and, eq } from "drizzle-orm";

import { db as defaultDb } from "@/lib/db";
import { connectorOutbox, tenants } from "@/lib/db/schema";
import { assertTenantId, assertUuid } from "@/lib/cases/tenant-guard";
import {
  parseTenantWebhookConfig,
  type ForumConfigWebhookDestination,
  type TenantWebhookConfig,
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
  getTenantWebhookConfig(tenantId: string): Promise<TenantWebhookConfig>;
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
    async getTenantWebhookConfig(tenantId) {
      assertTenantId(tenantId);
      const [tenant] = await db
        .select({ settings: tenants.settings })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      return parseTenantWebhookConfig(tenant?.settings ?? null);
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

function caseMatchValue(
  payload: WebhookPayload,
  key: "caseType" | "case_type" | "routingKey" | "routing_key",
): string | null {
  const kase = payload.case;
  if (!kase || typeof kase !== "object" || !(key in kase)) return null;
  const value = (kase as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function caseTypeFromPayload(payload: WebhookPayload): string | null {
  return (
    caseMatchValue(payload, "caseType") ??
    caseMatchValue(payload, "case_type")
  );
}

function routingKeyFromPayload(payload: WebhookPayload): string | null {
  return (
    caseMatchValue(payload, "routingKey") ??
    caseMatchValue(payload, "routing_key")
  );
}

function matchingForumConfigDestinations(
  destinations: ForumConfigWebhookDestination[],
  input: EnqueueWebhookDeliveryInput,
): ForumConfigWebhookDestination[] {
  const caseType = caseTypeFromPayload(input.payload);
  const routingKey = routingKeyFromPayload(input.payload);
  if (!caseType || !routingKey) return [];

  return destinations.filter(
    (destination) =>
      destination.case_type === caseType &&
      destination.routing_key === routingKey,
  );
}

function scopedIdempotencyKey(baseKey: string, destinationId: string): string {
  return `${baseKey}:${destinationId}`;
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
  const config = await store.getTenantWebhookConfig(input.tenantId);
  const destinations: Array<{ id: string }> = [];
  let configuredConnectorEventSkipped = false;

  if (isWebhookConfigured(config.connector)) {
    if (config.connector.events.includes(input.event)) {
      destinations.push({
        id: config.connector.url,
      });
    } else {
      configuredConnectorEventSkipped = true;
    }
  }

  for (const destination of matchingForumConfigDestinations(
    config.forumConfigDestinations,
    input,
  )) {
    destinations.push({
      id: destination.id,
    });
  }

  if (destinations.length === 0 && configuredConnectorEventSkipped) {
    return { status: "skipped-event-not-subscribed" };
  }
  if (destinations.length === 0) {
    return { status: "skipped-not-configured" };
  }

  let firstInserted: { id: string } | null = null;
  let firstExisting: { id: string } | null = null;
  const now = opts?.now ?? new Date();

  for (const destination of destinations) {
    const destinationIdempotencyKey = scopedIdempotencyKey(
      input.idempotencyKey,
      destination.id,
    );
    const inserted = await store.insertOutbox({
      tenantId: input.tenantId,
      caseId: input.caseId,
      connectorType: "webhook",
      destinationId: destination.id,
      payloadVersion: "v1",
      payload: input.payload,
      status: "pending",
      nextAttemptAt: now,
      attemptCount: 0,
      idempotencyKey: destinationIdempotencyKey,
    });

    if (inserted) {
      firstInserted ??= inserted;
      continue;
    }

    const existing = await store.findOutboxByIdempotencyKey(
      input.tenantId,
      destinationIdempotencyKey,
    );
    if (!existing) {
      throw new Error("Duplicate webhook outbox row could not be resolved");
    }
    firstExisting ??= existing;
  }

  if (firstInserted) {
    return { status: "enqueued", id: firstInserted.id };
  }

  if (firstExisting) {
    return { status: "skipped-duplicate", existingId: firstExisting.id };
  }

  return { status: "skipped-not-configured" };
}
