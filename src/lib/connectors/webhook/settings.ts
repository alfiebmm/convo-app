/**
 * Tenant webhook connector settings (CON-178a).
 *
 * Shape stored at `tenants.settings.connectors.webhook` (the loose
 * jsonb `settings` column on the `tenants` table — see
 * `src/lib/db/schema.ts` line ~100). This module exports the Zod schema,
 * the inferred TypeScript type, and a safe parser.
 *
 * Note: this is intentionally separate from the `forum-config`
 * `connectors` slice (which covers GSC / GA4 / OpenAI). The webhook
 * connector targets the durable-delivery surface defined by CON-178
 * (cases / contacts → outbound HTTP), not the forum-config plumbing.
 *
 * CON-178a delivers the schema + parser only — no DB writes, no UI,
 * no migration. Wiring to `tenants.settings` is done by 178b/c.
 */

import { z } from "zod";

/**
 * Event types that can fire a webhook delivery (V1 surface).
 *
 * Aligned with the CON-161 follow-up case lifecycle and the CON-178
 * connector spec. Adding a new event type is a schema bump; doing so
 * before 178b ships is fine — no tenant config has been migrated yet.
 */
export const webhookEventEnum = z.enum([
  "case.created",
  "case.updated",
  "case.resolved",
  "contact.updated",
]);

export type WebhookEvent = z.infer<typeof webhookEventEnum>;

/**
 * Webhook connector settings.
 *
 * - `enabled` — master switch. False disables all deliveries even if
 *   `url` / `secret_ciphertext` are populated.
 * - `url` — destination URL. Must be `https://` (no plaintext HTTP
 *   for outbound webhooks).
 * - `secret_ciphertext` — output of `encryptWebhookSecret`. Null when
 *   the tenant has not yet generated/set a signing secret.
 * - `events` — subset of event types this tenant subscribes to. Empty
 *   array means "no events delivered" even if `enabled` is true.
 *
 * Field-level defaults keep partial tenant configs parsing cleanly
 * (matches the CON-201 pattern used in `forum-config/schema.ts`).
 */
export const webhookConnectorSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  url: z
    .string()
    .url()
    .refine((u) => u.startsWith("https://"), {
      message: "Webhook URL must use https",
    })
    .optional(),
  secret_ciphertext: z.string().nullable().default(null),
  events: z.array(webhookEventEnum).default([]),
});

export type WebhookConnectorSettings = z.infer<
  typeof webhookConnectorSettingsSchema
>;

/**
 * Parse arbitrary input (e.g. a slice of `tenants.settings`) into a
 * `WebhookConnectorSettings`. Returns a Zod `SafeParseReturnType` so the
 * caller can branch on `.success` without `try`/`catch`.
 *
 * Use this at any boundary that reads tenant settings from the DB — the
 * jsonb column is loose by design and may contain legacy or partial
 * shapes.
 */
export function parseWebhookConnectorSettings(input: unknown) {
  return webhookConnectorSettingsSchema.safeParse(input);
}
