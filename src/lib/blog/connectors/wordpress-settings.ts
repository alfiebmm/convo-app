import { z } from "zod";

import type { WordPressConfig } from "@/lib/blog/connectors/wordpress";
import {
  decryptWordPressApplicationPassword,
  encryptWordPressApplicationPassword,
} from "@/lib/blog/connectors/wordpress-crypto";

export const wordpressCredentialsInputSchema = z.object({
  siteUrl: z.string().trim().min(1, "WordPress site URL is required"),
  username: z.string().trim().min(1, "WordPress username is required"),
  applicationPassword: z
    .string()
    .min(1, "WordPress application password is required"),
});

export const storedWordPressConnectorSchema = z.object({
  siteUrl: z.string().url(),
  username: z.string().min(1),
  applicationPasswordEncrypted: z.string().min(1),
  connectedAt: z.string().datetime(),
});

export type WordPressCredentialsInput = z.infer<
  typeof wordpressCredentialsInputSchema
>;
export type StoredWordPressConnector = z.infer<
  typeof storedWordPressConnectorSchema
>;

export type MaskedWordPressConnector = {
  siteUrl: string;
  username: string;
  applicationPassword: string;
  connectedAt: string;
};

export function encryptedWordPressConnectorFromInput(
  input: WordPressCredentialsInput,
  connectedAt = new Date(),
): StoredWordPressConnector {
  return storedWordPressConnectorSchema.parse({
    siteUrl: input.siteUrl.trim(),
    username: input.username.trim(),
    applicationPasswordEncrypted: encryptWordPressApplicationPassword(
      input.applicationPassword,
    ),
    connectedAt: connectedAt.toISOString(),
  });
}

export function parseStoredWordPressConnector(
  settings: unknown,
): StoredWordPressConnector | null {
  if (!isPlainObject(settings)) return null;
  const connectors = settings.connectors;
  if (!isPlainObject(connectors)) return null;

  const parsed = storedWordPressConnectorSchema.safeParse(connectors.wordpress);
  return parsed.success ? parsed.data : null;
}

export function maskStoredWordPressConnector(
  connector: StoredWordPressConnector,
): MaskedWordPressConnector {
  const plaintext = decryptWordPressApplicationPassword(
    connector.applicationPasswordEncrypted,
  );
  return {
    siteUrl: connector.siteUrl,
    username: connector.username,
    applicationPassword: maskApplicationPassword(plaintext),
    connectedAt: connector.connectedAt,
  };
}

export function decryptStoredWordPressConnector(
  connector: StoredWordPressConnector,
): WordPressConfig {
  return {
    siteUrl: connector.siteUrl,
    username: connector.username,
    applicationPassword: decryptWordPressApplicationPassword(
      connector.applicationPasswordEncrypted,
    ),
  };
}

export function getDecryptedWordPressConnectorFromSettings(
  settings: unknown,
): WordPressConfig | null {
  const connector = parseStoredWordPressConnector(settings);
  return connector ? decryptStoredWordPressConnector(connector) : null;
}

export function mergeWordPressConnectorSettings(
  settings: Record<string, unknown>,
  wordpress: StoredWordPressConnector,
): Record<string, unknown> {
  const connectors = isPlainObject(settings.connectors)
    ? settings.connectors
    : {};

  return {
    ...settings,
    connectors: {
      ...connectors,
      wordpress,
    },
  };
}

export function removeWordPressConnectorSettings(
  settings: Record<string, unknown>,
): Record<string, unknown> {
  const connectors = isPlainObject(settings.connectors)
    ? { ...settings.connectors }
    : {};
  delete connectors.wordpress;

  return {
    ...settings,
    connectors,
  };
}

export function redactWordPressSecretsFromSettings(
  settings: Record<string, unknown>,
): Record<string, unknown> {
  const redacted = { ...settings };

  const connectors = isPlainObject(settings.connectors)
    ? { ...settings.connectors }
    : null;
  if (connectors) {
    const wordpress = parseStoredWordPressConnector(settings);
    if (wordpress) {
      connectors.wordpress = maskStoredWordPressConnector(wordpress);
    }
    redacted.connectors = connectors;
  }

  const cms = isPlainObject(settings.cms) ? { ...settings.cms } : null;
  if (cms && isPlainObject(cms.wordpress)) {
    const wordpress = { ...cms.wordpress };
    const legacyPassword = wordpress.applicationPassword;
    if (typeof legacyPassword === "string") {
      wordpress.applicationPassword = maskApplicationPassword(legacyPassword);
    }
    cms.wordpress = wordpress;
    redacted.cms = cms;
  }

  return redacted;
}

export function maskApplicationPassword(plaintext: string): string {
  const lastFour = plaintext.slice(-4);
  return `••••••••${lastFour}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
