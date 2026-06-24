import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mintAdminSession,
  refreshAdminSessionToken,
  shouldRefreshAdminSession,
  verifyAdminSession,
} from "../admin-session-core";

const secret = "test-auth-secret";

test("admin session refreshes after one hour but not before", async () => {
  const token = await mintAdminSession("user-1", { now: 1_000, secret });
  const before = await verifyAdminSession(token, { now: 4_599, secret });
  const after = await verifyAdminSession(token, { now: 4_600, secret });

  assert.ok(before);
  assert.ok(after);
  assert.equal(shouldRefreshAdminSession(before, 4_599), false);
  assert.equal(shouldRefreshAdminSession(after, 4_600), true);

  const refreshed = await refreshAdminSessionToken(after, { now: 4_600, secret });
  const refreshedPayload = await verifyAdminSession(refreshed, {
    now: 4_600,
    secret,
  });

  assert.equal(refreshedPayload?.totpVerifiedAt, 4_600);
  assert.equal(refreshedPayload?.originalMintedAt, 1_000);
});

test("admin session hard cap invalidates after 24 hours from original mint", async () => {
  const token = await mintAdminSession("user-1", { now: 1_000, secret });
  const session = await verifyAdminSession(token, { now: 1_000, secret });
  assert.ok(session);
  const refreshed = await refreshAdminSessionToken(session, {
    now: 1_000 + 23 * 60 * 60,
    secret,
  });

  assert.equal(
    await verifyAdminSession(refreshed, {
      now: 1_000 + 24 * 60 * 60,
      secret,
    }),
    null,
  );
});
