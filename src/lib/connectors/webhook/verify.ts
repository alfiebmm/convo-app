import { timingSafeEqual } from "node:crypto";
import { signWebhookPayload } from "./sign";

export type WebhookSignatureFailureReason =
  | "missing"
  | "malformed"
  | "stale"
  | "mismatch";

export type VerifyFailureReason = WebhookSignatureFailureReason;

export interface VerifyWebhookSignatureInput {
  header: string | null | undefined;
  body: string;
  secret: string;
  toleranceSeconds?: number;
  now?: number;
}

export type VerifyWebhookSignatureResult =
  | { valid: true }
  | { valid: false; reason: WebhookSignatureFailureReason };

function parseSignatureHeader(
  header: string,
): { timestamp: number; signature: string } | null {
  const fields = new Map(
    header.split(",").map((part) => {
      const [key, value, extra] = part.split("=");
      return [key, extra === undefined ? value : undefined] as const;
    }),
  );

  const timestampRaw = fields.get("t");
  const signature = fields.get("v1");
  if (!timestampRaw || !signature) return null;
  if (!/^\d+$/.test(timestampRaw)) return null;
  if (!/^[a-f0-9]{64}$/.test(signature)) return null;

  const timestamp = Number(timestampRaw);
  if (!Number.isSafeInteger(timestamp)) return null;

  return { timestamp, signature };
}

function safeCompareHex(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  if (leftBuffer.length !== rightBuffer.length) return false;

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyWebhookSignature({
  header,
  body,
  secret,
  toleranceSeconds = 300,
  now = Math.floor(Date.now() / 1000),
}: VerifyWebhookSignatureInput): VerifyWebhookSignatureResult {
  if (!header) return { valid: false, reason: "missing" };

  const parsed = parseSignatureHeader(header);
  if (!parsed) return { valid: false, reason: "malformed" };

  if (Math.abs(now - parsed.timestamp) > toleranceSeconds) {
    return { valid: false, reason: "stale" };
  }

  const expected = signWebhookPayload(secret, body, parsed.timestamp);
  if (!safeCompareHex(parsed.signature, expected.signature)) {
    return { valid: false, reason: "mismatch" };
  }

  return { valid: true };
}
