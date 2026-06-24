import { test } from "node:test";
import assert from "node:assert/strict";
import {
  consumeRecoveryCode,
  formatRecoveryCode,
  shouldLockAccount,
} from "../mfa";

test("lockout logic locks on five failures inside fifteen minutes", () => {
  const now = new Date("2026-06-24T12:00:00.000Z");
  const attempts = Array.from({ length: 5 }, (_, index) => ({
    success: false,
    attemptedAt: new Date(now.getTime() - index * 60_000),
  }));

  assert.equal(shouldLockAccount(attempts, now), true);
  assert.equal(
    shouldLockAccount([...attempts.slice(0, 4), { success: true, attemptedAt: now }], now),
    false,
  );
});

test("recovery code consumption removes only the matching hash", async () => {
  const hashes = ["hash-a", "hash-b", "hash-c"];
  const result = await consumeRecoveryCode("CODE-B", hashes, async (hash, code) => {
    return hash === "hash-b" && code === "code-b";
  });

  assert.equal(result.matched, true);
  assert.deepEqual(result.remainingHashes, ["hash-a", "hash-c"]);
});

test("recovery codes are formatted as xxxx-xxxx-xx", () => {
  assert.equal(formatRecoveryCode("0123456789"), "0123-4567-89");
});
