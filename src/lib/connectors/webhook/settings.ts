import { z } from "zod";

export const webhookEventSchema = z.enum([
  "case.created",
  "case.updated",
  "case.resolved",
  "contact.updated",
]);

export const webhookEventEnum = webhookEventSchema;

export const webhookSettingsSchema = z.object({
  enabled: z.boolean(),
  url: z.string().url().refine(
    (value) => {
      try {
        return new URL(value).protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "Webhook URL must use HTTPS" },
  ),
  secret_ciphertext: z.string().min(1).nullable(),
  events: z.array(webhookEventSchema),
});

export const webhookConnectorSettingsSchema = webhookSettingsSchema;

export const tenantWebhookSettingsSchema = z.object({
  connectors: z.object({
    webhook: webhookSettingsSchema,
  }),
});

export type WebhookEvent = z.infer<typeof webhookEventSchema>;
export type WebhookSettings = z.infer<typeof webhookSettingsSchema>;
export type WebhookConnectorSettings = WebhookSettings;
export type TenantWebhookSettings = z.infer<
  typeof tenantWebhookSettingsSchema
>;

export function parseWebhookSettings(input: unknown): WebhookSettings {
  return webhookSettingsSchema.parse(input);
}

export function parseWebhookConnectorSettings(input: unknown) {
  return webhookConnectorSettingsSchema.safeParse(input);
}

export function parseTenantWebhookSettings(
  settings: unknown,
): WebhookSettings | null {
  const result = tenantWebhookSettingsSchema.safeParse(settings);
  return result.success ? result.data.connectors.webhook : null;
}
