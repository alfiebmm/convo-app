import { z } from "zod";

import { canManageConnectors } from "@/lib/auth/permissions";
import type { getTenantMembership as getTenantMembershipForType } from "@/lib/auth-context";
import { assertTenantId } from "@/lib/cases/tenant-guard";
import {
  verifyCredentials,
  type WordPressConfig,
} from "@/lib/blog/connectors/wordpress";
import {
  encryptedWordPressConnectorFromInput,
  decryptStoredWordPressConnector,
  maskStoredWordPressConnector,
  mergeWordPressConnectorSettings,
  parseStoredWordPressConnector,
  removeWordPressConnectorSettings,
  wordpressCredentialsInputSchema,
  type MaskedWordPressConnector,
} from "@/lib/blog/connectors/wordpress-settings";

type TenantMembership =
  | NonNullable<Awaited<ReturnType<typeof getTenantMembershipForType>>>
  | null;

export type WordPressSettingsStore = {
  getTenantSettings: (tenantId: string) => Promise<Record<string, unknown> | null>;
  saveTenantSettings: (
    tenantId: string,
    settings: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
};

export type WordPressRouteDeps = WordPressSettingsStore & {
  getSessionUserId: () => Promise<string | null>;
  getTenantMembership: (
    userId: string,
    tenantId: string,
  ) => Promise<TenantMembership>;
  verifyCredentials: (config: WordPressConfig) => ReturnType<typeof verifyCredentials>;
  now: () => Date;
};

export type WordPressConfigResponse =
  | { ok: true; config: MaskedWordPressConnector | null }
  | { ok: false; error: string };

export type WordPressTestResponse =
  | { ok: true; siteUrl: string }
  | { ok: false; error: string };

export type WordPressSaveResponse =
  | { ok: true; config: MaskedWordPressConnector }
  | { ok: false; error: string };

export async function getWordPressConnectorForTenant(
  tenantId: string,
  store: Pick<WordPressSettingsStore, "getTenantSettings">,
): Promise<WordPressConfigResponse> {
  assertTenantId(tenantId);
  const settings = await store.getTenantSettings(tenantId);
  if (settings === null) return { ok: false, error: "Tenant not found" };

  const connector = parseStoredWordPressConnector(settings);
  if (!connector) return { ok: true, config: null };

  return { ok: true, config: maskStoredWordPressConnector(connector) };
}

export async function getDecryptedWordPressConnectorForTenant(
  tenantId: string,
  store: Pick<WordPressSettingsStore, "getTenantSettings">,
): Promise<WordPressConfig | null> {
  assertTenantId(tenantId);
  const settings = await store.getTenantSettings(tenantId);
  if (settings === null) return null;

  const connector = parseStoredWordPressConnector(settings);
  return connector ? decryptStoredWordPressConnector(connector) : null;
}

export async function testWordPressConnectorForTenant(
  tenantId: string,
  input: unknown,
  deps: Pick<WordPressRouteDeps, "verifyCredentials">,
): Promise<WordPressTestResponse> {
  assertTenantId(tenantId);
  const parsed = parseInput(input);
  if (!parsed.ok) return parsed;

  const result = await deps.verifyCredentials(parsed.input);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, siteUrl: result.siteUrl };
}

export async function saveWordPressConnectorForTenant(
  tenantId: string,
  input: unknown,
  store: WordPressSettingsStore,
  now = new Date(),
): Promise<WordPressSaveResponse> {
  assertTenantId(tenantId);
  const parsed = parseInput(input);
  if (!parsed.ok) return parsed;

  const settings = await store.getTenantSettings(tenantId);
  if (settings === null) return { ok: false, error: "Tenant not found" };

  const nextConnector = encryptedWordPressConnectorFromInput(parsed.input, now);
  const saved = await store.saveTenantSettings(
    tenantId,
    mergeWordPressConnectorSettings(settings, nextConnector),
  );
  const savedConnector = parseStoredWordPressConnector(saved) ?? nextConnector;

  return {
    ok: true,
    config: maskStoredWordPressConnector(savedConnector),
  };
}

export async function deleteWordPressConnectorForTenant(
  tenantId: string,
  store: WordPressSettingsStore,
): Promise<{ ok: true } | { ok: false; error: string }> {
  assertTenantId(tenantId);
  const settings = await store.getTenantSettings(tenantId);
  if (settings === null) return { ok: false, error: "Tenant not found" };

  await store.saveTenantSettings(
    tenantId,
    removeWordPressConnectorSettings(settings),
  );
  return { ok: true };
}

export async function requireWordPressConnectorReadAccess(
  tenantId: string,
  deps: Pick<WordPressRouteDeps, "getSessionUserId" | "getTenantMembership">,
): Promise<
  | { ok: true; userId: string; membership: NonNullable<TenantMembership> }
  | { ok: false; status: number; error: string }
> {
  assertTenantId(tenantId);
  const userId = await deps.getSessionUserId();
  if (!userId) return { ok: false, status: 401, error: "Unauthorized" };

  const membership = await deps.getTenantMembership(userId, tenantId);
  if (!membership) return { ok: false, status: 404, error: "Not found" };

  return { ok: true, userId, membership };
}

export async function requireWordPressConnectorManageAccess(
  tenantId: string,
  deps: Pick<WordPressRouteDeps, "getSessionUserId" | "getTenantMembership">,
) {
  const access = await requireWordPressConnectorReadAccess(tenantId, deps);
  if (!access.ok) return access;
  if (!canManageConnectors(access.membership)) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }
  return access;
}

function parseInput(
  input: unknown,
):
  | { ok: true; input: z.infer<typeof wordpressCredentialsInputSchema> }
  | { ok: false; error: string } {
  const parsed = wordpressCredentialsInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  return { ok: true, input: parsed.data };
}
