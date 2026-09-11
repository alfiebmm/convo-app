import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const missingKeyMessage =
  "CONNECTOR_ENCRYPTION_KEY not configured. Generate 32 random bytes as hex (node -e 'console.log(crypto.randomBytes(32).toString(\"hex\"))') and add it to 1Password + Vercel env.";

function getConnectorEncryptionKey(raw = process.env.CONNECTOR_ENCRYPTION_KEY) {
  if (!raw) throw new Error(missingKeyMessage);
  if (!/^[0-9a-f]{64}$/i.test(raw)) throw new Error(missingKeyMessage);

  const key = Buffer.from(raw, "hex");
  if (key.length !== 32) throw new Error(missingKeyMessage);
  return key;
}

export function encryptWordPressApplicationPassword(plaintext: string): string {
  const key = getConnectorEncryptionKey();
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

export function decryptWordPressApplicationPassword(ciphertext: string): string {
  const key = getConnectorEncryptionKey();
  const [ivRaw, authTagRaw, ciphertextRaw] = ciphertext.split(":");

  if (!ivRaw || !authTagRaw || !ciphertextRaw) {
    throw new Error("Invalid encrypted WordPress application password payload");
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
