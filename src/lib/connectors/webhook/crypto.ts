/**
 * Webhook secret encryption (CON-178a).
 *
 * Mirrors `src/lib/platform-admin/totp-crypto.ts` exactly: AES-256-GCM,
 * random 12-byte IV, auth tag, base64 triple-join (`iv:authTag:ciphertext`).
 * Kept as an independent module because:
 *   - Different env var (`WEBHOOK_SECRET_ENCRYPTION_KEY`) so key rotation
 *     of the admin-TOTP key and the webhook-secret key are independent.
 *   - Different ciphertext namespace — a leaked admin-TOTP key must not
 *     also decrypt tenant webhook secrets, and vice versa.
 *
 * Production env wiring is handled in CON-178b/c; this module purely
 * implements the primitive.
 *
 * TODO: 1P — provision `Convo | Webhook Secret Encryption Key` (32-byte
 * base64) in the `Convo Infrastructure` vault before deploying 178b.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const missingKeyMessage =
  "WEBHOOK_SECRET_ENCRYPTION_KEY not configured. Generate 32 random bytes (e.g. node -e 'console.log(crypto.randomBytes(32).toString(\"base64\"))') and add to 1P (Convo | Webhook Secret Encryption Key) + Vercel env.";

function getEncryptionKey(raw = process.env.WEBHOOK_SECRET_ENCRYPTION_KEY) {
  if (!raw) throw new Error(missingKeyMessage);

  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(missingKeyMessage);
  }

  return key;
}

/**
 * Encrypt a webhook signing secret with AES-256-GCM.
 *
 * Returns `iv:authTag:ciphertext` as a single colon-joined base64 string,
 * matching the totp-crypto wire format for operational consistency.
 */
export function encryptWebhookSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [iv, authTag, ciphertext]
    .map((part) => part.toString("base64"))
    .join(":");
}

/**
 * Decrypt a ciphertext produced by `encryptWebhookSecret`.
 *
 * Throws a clear error on malformed input or auth-tag mismatch (the
 * underlying `decipher.final()` throws on auth failure).
 */
export function decryptWebhookSecret(ciphertext: string): string {
  const key = getEncryptionKey();
  const [ivRaw, authTagRaw, ciphertextRaw] = ciphertext.split(":");

  if (!ivRaw || !authTagRaw || !ciphertextRaw) {
    throw new Error("Invalid encrypted webhook secret payload");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivRaw, "base64"),
  );
  decipher.setAuthTag(Buffer.from(authTagRaw, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextRaw, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
