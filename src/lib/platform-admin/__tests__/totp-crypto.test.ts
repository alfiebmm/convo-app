import { randomBytes } from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { decryptSecret, encryptSecret } from "../totp-crypto";

test("encryptSecret/decryptSecret roundtrips without storing plaintext", () => {
  process.env.ADMIN_TOTP_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  const secret = "JBSWY3DPEHPK3PXP";

  const encrypted = encryptSecret(secret);

  assert.notEqual(encrypted, secret);
  assert.equal(encrypted.split(":").length, 3);
  assert.equal(decryptSecret(encrypted), secret);
});
