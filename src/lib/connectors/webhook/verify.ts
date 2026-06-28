/**
 * Webhook signature verifier (CON-178a).
 *
 * Verifies the `X-Convo-Signature: t=<unix-seconds>,v1=<hex>` header
 * produced by `signWebhookPayload`. Designed to be safe to ship as a
 * reference snippet for tenants to drop into their own receivers.
 *
 * Failure reasons are surfaced as a typed string so the caller can log
 * a specific cause without the verifier ever throwing on bad input.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export type VerifyFailureReason =
  | "missing"
  | "malformed"
  | "stale"
  | "mismatch";

export interface VerifyWebhookSignatureResult {
  valid: boolean;
  reason?: VerifyFailureReason;
}

export interface VerifyWebhookSignatureInput {
  /** Value of the `X-Convo-Signature` header (or null/undefined). */
  header: string | null | undefined;
  /** Raw request body the receiver actually got. */
  body: string;
  /** Plaintext signing secret. */
  secret: string;
  /**
   * Maximum age (in seconds) accepted for the signed timestamp,
   * measured from `now`. Default 300 (five minutes).
   */
  toleranceSeconds?: number;
  /**
   * Override for `Date.now()` in seconds. Tests use this; production
   * callers should leave it undefined.
   */
  now?: number;
}

const DEFAULT_TOLERANCE_SECONDS = 300;

/**
 * Constant-time hex comparison. Returns false if the buffers differ in
 * length (the underlying `timingSafeEqual` throws on length mismatch,
 * which would itself leak a timing signal if propagated to the caller).
 */
function safeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let bufA: Buffer;
  let bufB: Buffer;
  try {
    bufA = Buffer.from(a, "hex");
    bufB = Buffer.from(b, "hex");
  } catch {
    return false;
  }

  // `Buffer.from(<odd-length>, "hex")` silently truncates; guard.
  if (bufA.length !== bufB.length) return false;

  return timingSafeEqual(bufA, bufB);
}

/**
 * Parse a `t=...,v1=...` header into its parts. Returns null on any
 * malformed input. Tolerates additional comma-separated key=value pairs
 * (future-proofing for a `v2=` scheme alongside `v1=`).
 */
function parseSignatureHeader(
  header: string,
): { timestamp: number; v1: string } | null {
  const parts = header.split(",").map((p) => p.trim());
  let timestamp: number | undefined;
  let v1: string | undefined;

  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq <= 0) return null;
    const key = part.slice(0, eq);
    const value = part.slice(eq + 1);
    if (key === "t") {
      if (!/^\d+$/.test(value)) return null;
      timestamp = Number.parseInt(value, 10);
    } else if (key === "v1") {
      if (!/^[0-9a-f]+$/i.test(value)) return null;
      v1 = value.toLowerCase();
    }
    // Ignore unknown keys for forward compatibility.
  }

  if (timestamp === undefined || v1 === undefined) return null;
  if (!Number.isFinite(timestamp)) return null;

  return { timestamp, v1 };
}

/**
 * Verify an `X-Convo-Signature` header against a body + secret.
 *
 * Returns `{ valid: true }` on success, or
 * `{ valid: false, reason }` where `reason` is one of:
 *   - `missing`  — header not present
 *   - `malformed`— header could not be parsed
 *   - `stale`    — timestamp outside ±tolerance from `now`
 *   - `mismatch` — header valid but signature did not match
 *
 * Never throws.
 */
export function verifyWebhookSignature(
  input: VerifyWebhookSignatureInput,
): VerifyWebhookSignatureResult {
  const {
    header,
    body,
    secret,
    toleranceSeconds = DEFAULT_TOLERANCE_SECONDS,
    now,
  } = input;

  if (header === null || header === undefined || header === "") {
    return { valid: false, reason: "missing" };
  }

  const parsed = parseSignatureHeader(header);
  if (!parsed) {
    return { valid: false, reason: "malformed" };
  }

  const nowSeconds =
    typeof now === "number" ? Math.floor(now) : Math.floor(Date.now() / 1000);

  if (Math.abs(nowSeconds - parsed.timestamp) > toleranceSeconds) {
    return { valid: false, reason: "stale" };
  }

  const expected = createHmac("sha256", secret)
    .update(`${parsed.timestamp}.${body}`, "utf8")
    .digest("hex");

  if (!safeHexEqual(expected, parsed.v1)) {
    return { valid: false, reason: "mismatch" };
  }

  return { valid: true };
}
