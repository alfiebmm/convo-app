import { randomBytes } from "node:crypto";
import argon2 from "argon2";
import { and, desc, eq, gte } from "drizzle-orm";
import { verify } from "otplib";
import { db } from "@/lib/db";
import { adminTotpAttempts, adminTotpSecrets, users } from "@/lib/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/platform-admin/totp-crypto";

export const maxFailedTotpAttempts = 5;
export const lockoutWindowMs = 15 * 60 * 1000;
export const lockoutDurationMs = 60 * 60 * 1000;

export function formatRecoveryCode(raw = randomBytes(5).toString("hex")) {
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 10)}`;
}

export function generateRecoveryCodes(count = 10) {
  return Array.from({ length: count }, () => formatRecoveryCode());
}

export async function hashRecoveryCodes(codes: string[]) {
  return Promise.all(codes.map((code) => argon2.hash(normaliseRecoveryCode(code))));
}

export function normaliseRecoveryCode(code: string) {
  return code.trim().toLowerCase();
}

export async function consumeRecoveryCode(
  code: string,
  hashes: string[],
  verify = argon2.verify,
) {
  const normalised = normaliseRecoveryCode(code);
  for (let index = 0; index < hashes.length; index += 1) {
    if (await verify(hashes[index], normalised)) {
      return {
        matched: true as const,
        remainingHashes: hashes.filter((_, candidateIndex) => candidateIndex !== index),
      };
    }
  }

  return { matched: false as const, remainingHashes: hashes };
}

export function shouldLockAccount(
  attempts: Array<{ success: boolean; attemptedAt: Date }>,
  now = new Date(),
) {
  const cutoff = now.getTime() - lockoutWindowMs;
  const failures = attempts.filter(
    (attempt) => !attempt.success && attempt.attemptedAt.getTime() >= cutoff,
  );
  return failures.length >= maxFailedTotpAttempts;
}

export async function getTotpSecretForUser(userId: string) {
  const [row] = await db
    .select()
    .from(adminTotpSecrets)
    .where(eq(adminTotpSecrets.userId, userId))
    .limit(1);
  return row ?? null;
}

export async function verifyUserTotp(userId: string, token: string) {
  const row = await getTotpSecretForUser(userId);
  if (!row) return false;

  return (
    await verify({
    token: token.trim(),
    secret: decryptSecret(row.secretEncrypted),
    })
  ).valid;
}

export async function enrolUserTotp({
  userId,
  secret,
  recoveryCodes,
}: {
  userId: string;
  secret: string;
  recoveryCodes: string[];
}) {
  const recoveryHashes = await hashRecoveryCodes(recoveryCodes);
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .insert(adminTotpSecrets)
      .values({
        userId,
        secretEncrypted: encryptSecret(secret),
        recoveryCodesHashed: recoveryHashes,
      })
      .onConflictDoUpdate({
        target: adminTotpSecrets.userId,
        set: {
          secretEncrypted: encryptSecret(secret),
          recoveryCodesHashed: recoveryHashes,
          enrolledAt: now,
          lastUsedAt: null,
        },
      });
    await tx
      .update(users)
      .set({ totpEnrolledAt: now, lockedUntil: null })
      .where(eq(users.id, userId));
  });

  return { userId, recoveryCodeCount: recoveryHashes.length, enrolledAt: now };
}

export async function recordTotpAttempt({
  userId,
  success,
  ip,
  now = new Date(),
}: {
  userId: string;
  success: boolean;
  ip?: string | null;
  now?: Date;
}) {
  await db.insert(adminTotpAttempts).values({
    userId,
    success,
    ip: ip ?? null,
    attemptedAt: now,
  });

  if (success) {
    await db
      .update(adminTotpSecrets)
      .set({ lastUsedAt: now })
      .where(eq(adminTotpSecrets.userId, userId));
    return { locked: false, lockedUntil: null };
  }

  const since = new Date(now.getTime() - lockoutWindowMs);
  const attempts = await db
    .select({
      success: adminTotpAttempts.success,
      attemptedAt: adminTotpAttempts.attemptedAt,
    })
    .from(adminTotpAttempts)
    .where(
      and(
        eq(adminTotpAttempts.userId, userId),
        gte(adminTotpAttempts.attemptedAt, since),
      ),
    )
    .orderBy(desc(adminTotpAttempts.attemptedAt));

  if (!shouldLockAccount(attempts, now)) {
    return { locked: false, lockedUntil: null };
  }

  const lockedUntil = new Date(now.getTime() + lockoutDurationMs);
  return { locked: true, lockedUntil };
}

export async function lockUserUntil(userId: string, lockedUntil: Date) {
  await db.update(users).set({ lockedUntil }).where(eq(users.id, userId));
  return { userId, lockedUntil };
}

export async function consumeRecoveryCodeAndResetTotp({
  userId,
  code,
}: {
  userId: string;
  code: string;
}) {
  const row = await getTotpSecretForUser(userId);
  if (!row) return { ok: false as const };

  const result = await consumeRecoveryCode(code, row.recoveryCodesHashed);
  if (!result.matched) return { ok: false as const };

  await db.transaction(async (tx) => {
    await tx.delete(adminTotpSecrets).where(eq(adminTotpSecrets.userId, userId));
    await tx
      .update(users)
      .set({ totpEnrolledAt: null, lockedUntil: null })
      .where(eq(users.id, userId));
  });

  return { ok: true as const, remainingRecoveryCodes: result.remainingHashes.length };
}
