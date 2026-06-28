import { createHmac } from "node:crypto";

export interface WebhookSignature {
  header: string;
  timestamp: number;
  signature: string;
}

export type SignedWebhookPayload = WebhookSignature;

export function signWebhookPayload(
  secret: string,
  body: string,
  timestamp = Math.floor(Date.now() / 1000),
): WebhookSignature {
  const payload = `${timestamp}.${body}`;
  const signature = createHmac("sha256", secret)
    .update(payload, "utf8")
    .digest("hex");

  return {
    header: `t=${timestamp},v1=${signature}`,
    timestamp,
    signature,
  };
}
