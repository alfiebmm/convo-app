import { randomBytes } from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  encryptWebhookSecret,
  decryptWebhookSecret,
} from "../crypto";

function withKey(bytes: number): string {
  return randomBytes(bytes).toString("base64");
}

test("encryptWebhookSecret/decryptWebhookSecret round-trips a plaintext secret", () => {
  process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = withKey(32);
  const plaintext = "whsec_test_supersecret_value_123";

  const encrypted = encryptWebhookSecret(plaintext);

  assert.notEqual(encrypted, plaintext);
  assert.equal(encrypted.split(":").length, 3);
  assert.equal(decryptWebhookSecret(encrypted), plaintext);
});

test("encryptWebhookSecret produces a new ciphertext for the same plaintext (random IV)", () => {
  process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = withKey(32);
  const plaintext = "whsec_repeatable_input";

  const a = encryptWebhookSecret(plaintext);
  const b = encryptWebhookSecret(plaintext);

  assert.notEqual(a, b);
  assert.equal(decryptWebhookSecret(a), plaintext);
  assert.equal(decryptWebhookSecret(b), plaintext);
});

test("encryptWebhookSecret throws if the env key is missing", () => {
  delete process.env.WEBHOOK_SECRET_ENCRYPTION_KEY;
  assert.throws(
    () => encryptWebhookSecret("anything"),
    /WEBHOOK_SECRET_ENCRYPTION_KEY not configured/,
  );
});

test("encryptWebhookSecret throws if the env key is the wrong length", () => {
  process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = withKey(16); // half-length
  assert.throws(
    () => encryptWebhookSecret("anything"),
    /WEBHOOK_SECRET_ENCRYPTION_KEY not configured/,
  );
});

test("decryptWebhookSecret rejects a truncated ciphertext payload", () => {
  process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = withKey(32);
  const encrypted = encryptWebhookSecret("payload");
  const [iv] = encrypted.split(":");

  assert.throws(
    () => decryptWebhookSecret(iv),
    /Invalid encrypted webhook secret payload/,
  );
});

test("decryptWebhookSecret rejects tampered ciphertext (auth tag mismatch)", () => {
  process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = withKey(32);
  const encrypted = encryptWebhookSecret("payload");
  const [iv, tag, ciphertext] = encrypted.split(":");

  // Flip a byte in the ciphertext segment.
  const buf = Buffer.from(ciphertext, "base64");
  buf[0] = buf[0] ^ 0x01;
  const tampered = [iv, tag, buf.toString("base64")].join(":");

  assert.throws(() => decryptWebhookSecret(tampered));
});
