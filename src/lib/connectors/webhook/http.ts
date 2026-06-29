import { signWebhookPayload } from "./sign";

export type PostSignedWebhookResult = {
  statusCode: number;
  latencyMs: number;
};

export type PostSignedWebhookInput = {
  url: string;
  secret?: string;
  body: string;
  idempotencyKey: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  now?: () => number;
};

export async function postSignedWebhook({
  url,
  secret,
  body,
  idempotencyKey,
  fetchFn = fetch,
  timeoutMs = 10_000,
  now = Date.now,
}: PostSignedWebhookInput): Promise<PostSignedWebhookResult> {
  const startedAt = now();
  const signature = secret ? signWebhookPayload(secret, body) : null;
  const response = await fetchFn(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(signature ? { "X-Convo-Signature": signature.header } : {}),
      "Idempotency-Key": idempotencyKey,
      "User-Agent": "Convo-Webhook/v1",
    },
    body,
    signal: AbortSignal.timeout(timeoutMs),
  });

  return {
    statusCode: response.status,
    latencyMs: Math.max(0, now() - startedAt),
  };
}
