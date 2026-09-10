import { randomBytes } from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  decryptWordPressApplicationPassword,
  encryptWordPressApplicationPassword,
} from "@/lib/blog/connectors/wordpress-crypto";
import {
  encryptedWordPressConnectorFromInput,
  redactWordPressSecretsFromSettings,
} from "@/lib/blog/connectors/wordpress-settings";

function withConnectorKey<T>(key: string | undefined, run: () => T): T {
  const original = process.env.CONNECTOR_ENCRYPTION_KEY;
  if (key === undefined) {
    delete process.env.CONNECTOR_ENCRYPTION_KEY;
  } else {
    process.env.CONNECTOR_ENCRYPTION_KEY = key;
  }

  try {
    return run();
  } finally {
    if (original === undefined) {
      delete process.env.CONNECTOR_ENCRYPTION_KEY;
    } else {
      process.env.CONNECTOR_ENCRYPTION_KEY = original;
    }
  }
}

test("WordPress application password encryption round-trips without plaintext ciphertext", () => {
  withConnectorKey(randomBytes(32).toString("hex"), () => {
    const plaintext = ["wp", "app", "password", "with", "spaces"].join(" ");

    const encrypted = encryptWordPressApplicationPassword(plaintext);

    assert.notEqual(encrypted, plaintext);
    assert.equal(encrypted.split(":").length, 3);
    assert.equal(decryptWordPressApplicationPassword(encrypted), plaintext);
  });
});

test("WordPress application password encryption requires a 32-byte hex key", () => {
  withConnectorKey(randomBytes(32).toString("base64"), () => {
    assert.throws(
      () => encryptWordPressApplicationPassword("candidate"),
      /CONNECTOR_ENCRYPTION_KEY not configured/,
    );
  });
});

test("WordPress application password decryption rejects malformed payloads", () => {
  withConnectorKey(randomBytes(32).toString("hex"), () => {
    assert.throws(
      () => decryptWordPressApplicationPassword("iv:tag"),
      /Invalid encrypted WordPress application password payload/,
    );
  });
});

test("WordPress settings redaction removes encrypted and legacy plaintext values", () => {
  withConnectorKey(randomBytes(32).toString("hex"), () => {
    const connectorPassword = ["stored", "connector", "password"].join(" ");
    const legacyPassword = ["legacy", "cms", "password"].join(" ");
    const connector = encryptedWordPressConnectorFromInput(
      {
        siteUrl: "https://example.com",
        username: "admin",
        applicationPassword: connectorPassword,
      },
      new Date("2026-09-10T00:00:00.000Z"),
    );

    const redacted = redactWordPressSecretsFromSettings({
      connectors: { wordpress: connector },
      cms: {
        type: "wordpress",
        wordpress: {
          siteUrl: "https://legacy.example.com",
          username: "legacy-admin",
          applicationPassword: legacyPassword,
        },
      },
    });
    const text = JSON.stringify(redacted);

    assert.equal(text.includes(connectorPassword), false);
    assert.equal(text.includes(legacyPassword), false);
    assert.equal(text.includes(connector.applicationPasswordEncrypted), false);
    assert.match(text, /••••••••word/);
  });
});
