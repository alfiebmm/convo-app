import { randomBytes } from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decryptWebhookSecret,
  encryptWebhookSecret,
} from "@/lib/connectors/webhook/crypto";

function withWebhookKey<T>(key: string | undefined, run: () => T): T {
  const original = process.env.WEBHOOK_SECRET_ENCRYPTION_KEY;
  if (key === undefined) {
    delete process.env.WEBHOOK_SECRET_ENCRYPTION_KEY;
  } else {
    process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = key;
  }

  try {
    return run();
  } finally {
    if (original === undefined) {
      delete process.env.WEBHOOK_SECRET_ENCRYPTION_KEY;
    } else {
      process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = original;
    }
  }
}

test("encryptWebhookSecret/decryptWebhookSecret roundtrips without storing plaintext", () => {
  withWebhookKey(randomBytes(32).toString("base64"), () => {
    const secret = "whsec_test_secret";

    const encrypted = encryptWebhookSecret(secret);

    assert.notEqual(encrypted, secret);
    assert.equal(encrypted.split(":").length, 3);
    assert.equal(decryptWebhookSecret(encrypted), secret);
  });
});

test("encryptWebhookSecret rejects a wrong key length", () => {
  withWebhookKey(randomBytes(16).toString("base64"), () => {
    assert.throws(
      () => encryptWebhookSecret("whsec_test_secret"),
      /WEBHOOK_SECRET_ENCRYPTION_KEY not configured/,
    );
  });
});

test("decryptWebhookSecret rejects truncated ciphertext", () => {
  withWebhookKey(randomBytes(32).toString("base64"), () => {
    assert.throws(
      () => decryptWebhookSecret("iv:tag"),
      /Invalid encrypted webhook secret payload/,
    );
  });
});

test("decryptWebhookSecret rejects tampered ciphertext", () => {
  withWebhookKey(randomBytes(32).toString("base64"), () => {
    const encrypted = encryptWebhookSecret("whsec_test_secret");
    const [iv, authTag, ciphertext] = encrypted.split(":");
    const tampered = `${iv}:${authTag}:${ciphertext.slice(0, -1)}A`;

    assert.throws(() => decryptWebhookSecret(tampered));
  });
});
