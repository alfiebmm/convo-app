import { randomBytes } from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  handleWordPressConnectorDelete,
  handleWordPressConnectorGet,
  handleWordPressConnectorPut,
  handleWordPressConnectorTest,
} from "@/app/api/tenants/[tenantId]/connectors/wordpress/handler";
import { decryptWordPressApplicationPassword } from "@/lib/blog/connectors/wordpress-crypto";
import type { WordPressRouteDeps } from "@/lib/blog/connectors/wordpress-settings-actions";

const TENANT_ID = "a1111111-1111-4111-8111-111111111111";
const ACTOR_ID = "b2222222-2222-4222-9222-222222222222";

process.env.CONNECTOR_ENCRYPTION_KEY = randomBytes(32).toString("hex");

function candidatePassword() {
  return ["word", "press", "app", "pass", "with", "spaces"].join(" ");
}

function request(body: unknown) {
  return new Request(`https://app.test/api/tenants/${TENANT_ID}/connectors/wordpress`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function readJson(response: Response) {
  return JSON.parse(await response.text()) as Record<string, unknown>;
}

function makeDeps(options: {
  userId?: string | null;
  role?: "owner" | "admin" | "editor" | "viewer" | null;
  settings?: Record<string, unknown> | null;
  verifyOk?: boolean;
  verifyError?: string;
} = {}): WordPressRouteDeps & {
  writes: Record<string, unknown>[];
  settings: Record<string, unknown> | null;
} {
  let settings = options.settings === undefined ? {} : options.settings;
  const writes: Record<string, unknown>[] = [];
  const deps = {
    get settings() {
      return settings;
    },
    writes,
    getSessionUserId: async () =>
      Object.prototype.hasOwnProperty.call(options, "userId")
        ? (options.userId ?? null)
        : ACTOR_ID,
    getTenantMembership: async () =>
      options.role === null
        ? null
        : {
            id: "c3333333-3333-4333-8333-333333333333",
            tenantId: TENANT_ID,
            userId: ACTOR_ID,
            role: options.role ?? "admin",
            createdAt: new Date("2026-09-10T00:00:00.000Z"),
          },
    getTenantSettings: async () => settings,
    saveTenantSettings: async (_tenantId: string, next: Record<string, unknown>) => {
      settings = next;
      writes.push(next);
      return next;
    },
    verifyCredentials: async (config) => {
      if (options.verifyOk === false) {
        return {
          ok: false as const,
          error: options.verifyError ?? "WordPress credentials were rejected",
        };
      }
      return {
        ok: true as const,
        siteUrl: config.siteUrl.replace(/\/+$/, ""),
      };
    },
    now: () => new Date("2026-09-10T02:03:04.000Z"),
  } satisfies WordPressRouteDeps & {
    settings: Record<string, unknown> | null;
    writes: Record<string, unknown>[];
  };
  return deps;
}

test("GET requires an authenticated tenant member", async () => {
  const unauthenticated = await handleWordPressConnectorGet(
    TENANT_ID,
    makeDeps({ userId: null }),
  );
  assert.equal(unauthenticated.status, 401);

  const notMember = await handleWordPressConnectorGet(
    TENANT_ID,
    makeDeps({ role: null }),
  );
  assert.equal(notMember.status, 404);
});

test("POST test requires connector manager access and returns connector errors exactly", async () => {
  const forbidden = await handleWordPressConnectorTest(
    TENANT_ID,
    request({
      siteUrl: "https://example.com",
      username: "editor",
      applicationPassword: candidatePassword(),
    }),
    makeDeps({ role: "editor" }),
  );
  assert.equal(forbidden.status, 403);

  const response = await handleWordPressConnectorTest(
    TENANT_ID,
    request({
      siteUrl: "https://example.com/",
      username: "admin",
      applicationPassword: candidatePassword(),
    }),
    makeDeps({
      verifyOk: false,
      verifyError: "WordPress credentials were rejected",
    }),
  );
  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    ok: false,
    error: "WordPress credentials were rejected",
  });
});

test("POST test does not persist WordPress credentials", async () => {
  const deps = makeDeps();
  const plaintext = candidatePassword();

  const response = await handleWordPressConnectorTest(
    TENANT_ID,
    request({
      siteUrl: "https://example.com/",
      username: "admin",
      applicationPassword: plaintext,
    }),
    deps,
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), {
    ok: true,
    siteUrl: "https://example.com",
  });
  assert.equal(deps.writes.length, 0);
});

test("PUT saves encrypted WordPress credentials and returns only masked config", async () => {
  const deps = makeDeps({ settings: { connectors: { webhook: { enabled: true } } } });
  const plaintext = candidatePassword();

  const response = await handleWordPressConnectorPut(
    TENANT_ID,
    request({
      siteUrl: "https://example.com",
      username: "admin",
      applicationPassword: plaintext,
    }),
    deps,
  );

  assert.equal(response.status, 200);
  const body = await readJson(response);
  const responseText = JSON.stringify(body);
  assert.equal(responseText.includes(plaintext), false);
  assert.match(responseText, /••••••••aces/);

  assert.equal(deps.writes.length, 1);
  const connectors = deps.writes[0].connectors as Record<string, unknown>;
  assert.ok(connectors.webhook, "preserves sibling connectors");
  const wordpress = connectors.wordpress as Record<string, unknown>;
  assert.equal(wordpress.siteUrl, "https://example.com");
  assert.equal(wordpress.username, "admin");
  assert.equal(typeof wordpress.applicationPasswordEncrypted, "string");
  assert.equal(String(wordpress.applicationPasswordEncrypted).includes(plaintext), false);
  assert.equal(
    decryptWordPressApplicationPassword(
      wordpress.applicationPasswordEncrypted as string,
    ),
    plaintext,
  );
});

test("PUT requires connector manager access", async () => {
  const response = await handleWordPressConnectorPut(
    TENANT_ID,
    request({
      siteUrl: "https://example.com",
      username: "viewer",
      applicationPassword: candidatePassword(),
    }),
    makeDeps({ role: "viewer" }),
  );

  assert.equal(response.status, 403);
});

test("GET returns masked WordPress config without plaintext", async () => {
  const deps = makeDeps();
  const plaintext = candidatePassword();
  await handleWordPressConnectorPut(
    TENANT_ID,
    request({
      siteUrl: "https://example.com",
      username: "admin",
      applicationPassword: plaintext,
    }),
    deps,
  );

  const response = await handleWordPressConnectorGet(TENANT_ID, deps);
  assert.equal(response.status, 200);
  const body = await readJson(response);
  const responseText = JSON.stringify(body);

  assert.equal(responseText.includes(plaintext), false);
  assert.match(responseText, /••••••••aces/);
  assert.equal(
    (body.config as Record<string, unknown>).applicationPassword,
    "••••••••aces",
  );
});

test("DELETE clears WordPress connector while preserving other settings", async () => {
  const deps = makeDeps();
  await handleWordPressConnectorPut(
    TENANT_ID,
    request({
      siteUrl: "https://example.com",
      username: "admin",
      applicationPassword: candidatePassword(),
    }),
    deps,
  );

  const response = await handleWordPressConnectorDelete(TENANT_ID, deps);
  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), { ok: true });
  const connectors = deps.writes.at(-1)?.connectors as Record<string, unknown>;
  assert.equal(connectors.wordpress, undefined);
});

test("DELETE requires connector manager access", async () => {
  const response = await handleWordPressConnectorDelete(
    TENANT_ID,
    makeDeps({ role: "editor" }),
  );

  assert.equal(response.status, 403);
});
