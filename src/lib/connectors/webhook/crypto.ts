import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// TODO: 1P - provision WEBHOOK_SECRET_ENCRYPTION_KEY before CON-178b deploys.
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
