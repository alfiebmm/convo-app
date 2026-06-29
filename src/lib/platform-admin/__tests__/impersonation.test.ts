import { test } from "node:test";
import assert from "node:assert/strict";

import {
  impersonationTtlSeconds,
  mintImpersonationCookie,
  verifyImpersonationCookie,
} from "../impersonation";

const SECRET = "test-secret-for-impersonation-cookie";

test("mint + verify round-trip preserves payload", async () => {
  const token = await mintImpersonationCookie(
    {
      staffUserId: "user-1",
      staffEmail: "staff@example.com",
      tenantId: "tenant-1",
    },
    SECRET,
  );
  const payload = await verifyImpersonationCookie(token, SECRET);
  assert.ok(payload, "payload should verify");
  assert.equal(payload?.staffUserId, "user-1");
  assert.equal(payload?.staffEmail, "staff@example.com");
  assert.equal(payload?.tenantId, "tenant-1");
  assert.equal(typeof payload?.issuedAt, "number");
});

test("verify rejects tampered signature", async () => {
  const token = await mintImpersonationCookie(
    {
      staffUserId: "user-1",
      staffEmail: "staff@example.com",
      tenantId: "tenant-1",
    },
    SECRET,
  );
  const [body] = token.split(".");
  const tampered = `${body}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
  const payload = await verifyImpersonationCookie(tampered, SECRET);
  assert.equal(payload, null);
});

test("verify rejects body swap", async () => {
  const a = await mintImpersonationCookie(
    {
      staffUserId: "user-1",
      staffEmail: "a@example.com",
      tenantId: "tenant-1",
    },
    SECRET,
  );
  const b = await mintImpersonationCookie(
    {
      staffUserId: "user-2",
      staffEmail: "b@example.com",
      tenantId: "tenant-2",
    },
    SECRET,
  );
  const [bodyA] = a.split(".");
  const [, sigB] = b.split(".");
  const mismatched = `${bodyA}.${sigB}`;
  const payload = await verifyImpersonationCookie(mismatched, SECRET);
  assert.equal(payload, null);
});

test("verify rejects expired token", async () => {
  const token = await mintImpersonationCookie(
    {
      staffUserId: "user-1",
      staffEmail: "staff@example.com",
      tenantId: "tenant-1",
      issuedAt: 1_000_000,
    },
    SECRET,
  );
  // Now() returns a time well past the TTL window.
  const payload = await verifyImpersonationCookie(
    token,
    SECRET,
    () => 1_000_000 + impersonationTtlSeconds + 1,
  );
  assert.equal(payload, null);
});

test("verify accepts token within TTL", async () => {
  const token = await mintImpersonationCookie(
    {
      staffUserId: "user-1",
      staffEmail: "staff@example.com",
      tenantId: "tenant-1",
      issuedAt: 1_000_000,
    },
    SECRET,
  );
  const payload = await verifyImpersonationCookie(
    token,
    SECRET,
    () => 1_000_000 + impersonationTtlSeconds - 1,
  );
  assert.ok(payload);
});

test("verify rejects empty / malformed input", async () => {
  assert.equal(await verifyImpersonationCookie(undefined, SECRET), null);
  assert.equal(await verifyImpersonationCookie(null, SECRET), null);
  assert.equal(await verifyImpersonationCookie("", SECRET), null);
  assert.equal(await verifyImpersonationCookie("not-a-token", SECRET), null);
  assert.equal(await verifyImpersonationCookie("a.b.c", SECRET), null);
});
