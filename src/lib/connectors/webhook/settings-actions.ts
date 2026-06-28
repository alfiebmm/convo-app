import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";

import { assertTenantId } from "@/lib/cases/tenant-guard";
import { decryptWebhookSecret, encryptWebhookSecret } from "./crypto";
import { postSignedWebhook } from "./http";
import {
  parseTenantWebhookSettings,
  webhookEventSchema,
  webhookSettingsSchema,
  type WebhookSettings,
} from "./settings";

export const webhookSettingsInputSchema = z.object({
  enabled: z.boolean(),
  url: z.string().trim().url().refine(
    (value) => {
      try {
        return new URL(value).protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "Destination URL must start with https://" },
  ),
  events: z.array(webhookEventSchema).min(1, "Choose at least one event"),
});

export type WebhookSettingsInput = z.infer<typeof webhookSettingsInputSchema>;

export type SaveWebhookSettingsResult =
  | { ok: true; settings: WebhookSettings; hasSecret: boolean }
  | { ok: false; error: string };

export type RotateWebhookSecretResult =
  | { ok: true; plaintext: string; settings: WebhookSettings }
  | { ok: false; error: string };

export type SendTestWebhookResult =
  | { ok: true; statusCode: number; latencyMs: number }
  | { ok: false; error: string };

export type WebhookSettingsStore = {
  getTenantSettings: (tenantId: string) => Promise<Record<string, unknown> | null>;
  saveTenantSettings: (
    tenantId: string,
    settings: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
};

export async function saveWebhookSettingsForTenant(
  tenantId: string,
  input: unknown,
  store: WebhookSettingsStore,
): Promise<SaveWebhookSettingsResult> {
  assertTenantId(tenantId);
  const parsed = webhookSettingsInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const settings = await store.getTenantSettings(tenantId);
  if (settings === null) return { ok: false, error: "Tenant not found" };

  const current = parseTenantWebhookSettings(settings);
  const nextWebhook = webhookSettingsSchema.parse({
    ...parsed.data,
    secret_ciphertext: current?.secret_ciphertext ?? null,
  });
  const saved = await store.saveTenantSettings(
    tenantId,
    mergeWebhookSettings(settings, nextWebhook),
  );
  const savedWebhook = parseTenantWebhookSettings(saved) ?? nextWebhook;

  return {
    ok: true,
    settings: savedWebhook,
    hasSecret: Boolean(savedWebhook.secret_ciphertext),
  };
}

export async function rotateWebhookSecretForTenant(
  tenantId: string,
  store: WebhookSettingsStore,
): Promise<RotateWebhookSecretResult> {
  assertTenantId(tenantId);
  const settings = await store.getTenantSettings(tenantId);
  if (settings === null) return { ok: false, error: "Tenant not found" };

  const current = parseTenantWebhookSettings(settings);
  if (!current) {
    return { ok: false, error: "Save webhook settings before rotating the secret" };
  }

  const plaintext = `whsec_${randomBytes(32).toString("base64url")}`;
  const nextWebhook = webhookSettingsSchema.parse({
    ...current,
    secret_ciphertext: encryptWebhookSecret(plaintext),
  });
  const saved = await store.saveTenantSettings(
    tenantId,
    mergeWebhookSettings(settings, nextWebhook),
  );
  const savedWebhook = parseTenantWebhookSettings(saved) ?? nextWebhook;

  return { ok: true, plaintext, settings: savedWebhook };
}

export async function sendTestWebhookForTenant(
  tenantId: string,
  store: Pick<WebhookSettingsStore, "getTenantSettings">,
  opts: { fetchFn?: typeof fetch; now?: Date; timeoutMs?: number } = {},
): Promise<SendTestWebhookResult> {
  assertTenantId(tenantId);
  const settings = await store.getTenantSettings(tenantId);
  if (settings === null) return { ok: false, error: "Tenant not found" };

  const webhook = parseTenantWebhookSettings(settings);
  if (!webhook?.enabled || !webhook.url || !webhook.secret_ciphertext) {
    return { ok: false, error: "Webhook is not configured" };
  }

  const occurredAt = opts.now ?? new Date();
  const body = JSON.stringify({
    event: "test.ping",
    occurred_at: occurredAt.toISOString(),
    data: {
      tenant_id: tenantId,
      message: "Webhook test ping",
    },
  });

  try {
    const secret = decryptWebhookSecret(webhook.secret_ciphertext);
    const response = await postSignedWebhook({
      url: webhook.url,
      secret,
      body,
      idempotencyKey: `test.ping:${randomUUID()}`,
      fetchFn: opts.fetchFn,
      timeoutMs: opts.timeoutMs,
    });

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return {
        ok: true,
        statusCode: response.statusCode,
        latencyMs: response.latencyMs,
      };
    }

    return {
      ok: false,
      error: `Webhook returned HTTP ${response.statusCode}`,
    };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

function mergeWebhookSettings(
  settings: Record<string, unknown>,
  webhook: WebhookSettings,
): Record<string, unknown> {
  const connectors = isPlainObject(settings.connectors)
    ? settings.connectors
    : {};

  return {
    ...settings,
    connectors: {
      ...connectors,
      webhook,
    },
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
