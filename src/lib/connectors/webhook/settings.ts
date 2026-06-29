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

export const webhookDestinationConfigSchema = z.object({
  url: z.string().url().refine(
    (value) => {
      try {
        return new URL(value).protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "Webhook destination URL must use HTTPS" },
  ),
  secret_ciphertext: z.string().min(1).nullable().optional(),
  notes: z.string().optional(),
});

export const forumConfigWebhookDestinationSchema = z.object({
  id: z.string().min(1),
  case_type: z.string().min(1),
  connector: z.literal("webhook"),
  routing_key: z.string().min(1),
  config: webhookDestinationConfigSchema,
});

export const tenantWebhookSettingsSchema = z.object({
  connectors: z.object({
    webhook: webhookSettingsSchema,
  }),
});

export type WebhookEvent = z.infer<typeof webhookEventSchema>;
export type WebhookSettings = z.infer<typeof webhookSettingsSchema>;
export type WebhookConnectorSettings = WebhookSettings;
export type WebhookDestinationConfig = z.infer<
  typeof webhookDestinationConfigSchema
>;
export type ForumConfigWebhookDestination = z.infer<
  typeof forumConfigWebhookDestinationSchema
>;
export type TenantWebhookSettings = z.infer<
  typeof tenantWebhookSettingsSchema
>;

export interface TenantWebhookConfig {
  connector: WebhookSettings | null;
  forumConfigDestinations: ForumConfigWebhookDestination[];
}

export function parseWebhookSettings(input: unknown): WebhookSettings {
  return webhookSettingsSchema.parse(input);
}

export function parseWebhookConnectorSettings(input: unknown) {
  return webhookConnectorSettingsSchema.safeParse(input);
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

export function parseForumConfigWebhookDestinations(
  settings: unknown,
): ForumConfigWebhookDestination[] {
  if (!isRecord(settings)) return [];
  const forumConfig = settings.forumConfig;
  if (!isRecord(forumConfig)) return [];
  const followUp = forumConfig.follow_up;
  if (!isRecord(followUp)) return [];
  const destinations = followUp.destinations;
  if (!Array.isArray(destinations)) return [];

  return destinations.flatMap((destination) => {
    if (!isRecord(destination) || destination.connector !== "webhook") {
      return [];
    }
    const parsed = forumConfigWebhookDestinationSchema.safeParse(destination);
    return parsed.success ? [parsed.data] : [];
  });
}

export function parseTenantWebhookSettings(
  settings: unknown,
): WebhookSettings | null {
  const result = tenantWebhookSettingsSchema.safeParse(settings);
  return result.success ? result.data.connectors.webhook : null;
}

export function parseTenantWebhookConfig(settings: unknown): TenantWebhookConfig {
  return {
    connector: parseTenantWebhookSettings(settings),
    forumConfigDestinations: parseForumConfigWebhookDestinations(settings),
  };
}
