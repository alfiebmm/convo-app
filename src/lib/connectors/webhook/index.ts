/**
 * Webhook connector — public surface (CON-178a).
 *
 * Pure library exports for the webhook connector. Consumers should
 * import from this barrel, not from the individual modules, so the
 * 178b/c/d follow-ups can re-organise internals without rippling.
 */

export { encryptWebhookSecret, decryptWebhookSecret } from "./crypto";
export {
  webhookEventEnum,
  webhookConnectorSettingsSchema,
  parseWebhookConnectorSettings,
} from "./settings";
export type {
  WebhookEvent,
  WebhookConnectorSettings,
} from "./settings";
export { signWebhookPayload } from "./sign";
export type { SignedWebhookPayload } from "./sign";
export { verifyWebhookSignature } from "./verify";
export type {
  VerifyFailureReason,
  VerifyWebhookSignatureInput,
  VerifyWebhookSignatureResult,
} from "./verify";
