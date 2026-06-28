/**
 * Webhook payload signer (CON-178a) — V1 signature spec.
 *
 * Header format: `X-Convo-Signature: t=<unix-seconds>,v1=<hex>`
 *
 * Signed payload: `<timestamp>.<request-body>` as UTF-8 bytes.
 * Algorithm: HMAC-SHA256, hex-encoded lower-case.
 *
 * The timestamp is included in the signed string so a captured request
 * cannot be replayed beyond the verifier's tolerance window. The header
 * uses the same `t=`/`v1=` shape Stripe and GitHub use so tenants
 * already familiar with webhook signing recognise it.
 *
 * This module produces signatures only. Verification lives in
 * `./verify.ts` and is intended for both the tenant integration side
 * (their server checks our signature) and any future inbound use.
 */

import { createHmac } from "node:crypto";

export interface SignedWebhookPayload {
  /** Full header value, e.g. `t=1730000000,v1=abc123...`. */
  header: string;
  /** Unix-seconds timestamp used in the signed string and header. */
  timestamp: number;
  /** Lower-case hex HMAC-SHA256 of `<timestamp>.<body>`. */
  signature: string;
}

/**
 * Sign a webhook request body with the tenant's webhook secret.
 *
 * @param secret    Plaintext signing secret (already-decrypted on the
 *                  caller side via `decryptWebhookSecret`). Must be a
 *                  non-empty string.
 * @param body      The raw HTTP request body that will be sent. Pass the
 *                  exact bytes the receiver will see; do not re-stringify.
 * @param timestamp Optional override for the unix-seconds timestamp.
 *                  Defaults to `Math.floor(Date.now() / 1000)`.
 */
export function signWebhookPayload(
  secret: string,
  body: string,
  timestamp?: number,
): SignedWebhookPayload {
  if (typeof secret !== "string" || secret.length === 0) {
    throw new Error("signWebhookPayload requires a non-empty secret");
  }

  const ts =
    typeof timestamp === "number"
      ? Math.floor(timestamp)
      : Math.floor(Date.now() / 1000);

  const signedString = `${ts}.${body}`;
  const signature = createHmac("sha256", secret)
    .update(signedString, "utf8")
    .digest("hex");

  const header = `t=${ts},v1=${signature}`;

  return { header, timestamp: ts, signature };
}
