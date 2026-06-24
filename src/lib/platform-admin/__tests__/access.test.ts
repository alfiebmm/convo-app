import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluatePlatformStaffAccess,
  isPlatformStaff,
  parsePlatformStaffEmails,
  requirePlatformStaff,
} from "../access";

const allowlist = parsePlatformStaffEmails("blake@example.com, cam@example.com");

test("platform staff access: unauthenticated fails closed", async () => {
  assert.equal(evaluatePlatformStaffAccess(null, allowlist), false);
  assert.equal(await isPlatformStaff({ getUser: async () => null, allowlist }), false);
});

test("platform staff access: authenticated but not env-allowlisted fails closed", async () => {
  const user = { id: "tenant", email: "tenant@example.com", isPlatformStaff: true };
  assert.equal(evaluatePlatformStaffAccess(user, allowlist), false);
  assert.equal(await isPlatformStaff({ getUser: async () => user, allowlist }), false);
});

test("platform staff access: allowlisted but DB staff flag false fails closed", async () => {
  const user = { id: "blake", email: "blake@example.com", isPlatformStaff: false };
  assert.equal(evaluatePlatformStaffAccess(user, allowlist), false);
  assert.equal(await isPlatformStaff({ getUser: async () => user, allowlist }), false);
});

test("platform staff access: allowlist and DB staff flag pass", async () => {
  const user = { id: "blake", email: "blake@example.com", isPlatformStaff: true };
  assert.equal(evaluatePlatformStaffAccess(user, allowlist), true);
  assert.equal(await isPlatformStaff({ getUser: async () => user, allowlist }), true);
  await assert.doesNotReject(
    requirePlatformStaff({ requireUser: async () => ({ user }), allowlist }),
  );
});

test("requirePlatformStaff fails closed for non-allowlisted user", async () => {
  const user = { id: "tenant", email: "tenant@example.com", isPlatformStaff: true };
  await assert.rejects(
    requirePlatformStaff({ requireUser: async () => ({ user }), allowlist }),
  );
});

test("requirePlatformStaff fails closed when DB staff flag is false", async () => {
  const user = { id: "cam", email: "cam@example.com", isPlatformStaff: false };
  await assert.rejects(
    requirePlatformStaff({ requireUser: async () => ({ user }), allowlist }),
  );
});
