/**
 * CON-239 \u2014 Platform staff tenant impersonation.
 *
 * Platform staff can pick "Impersonate this tenant" on a tenant detail
 * page. We mint a short-lived signed cookie that scopes downstream
 * tenant-aware queries (`getCurrentTenant`, etc.) to that tenant
 * regardless of the user's own membership state.
 *
 * The cookie is a tiny HMAC-signed payload, mirroring the pattern in
 * `admin-session-core.ts`. We deliberately do NOT reuse the admin
 * session JWT \u2014 impersonation has a separate lifecycle and its own
 * audit events (`impersonation.start` / `impersonation.end`).
 *
 * Lifetime: 60 minutes. After that the cookie expires and the staff
 * member must re-impersonate. This matches the operational pattern:
 * staff debug a tenant, see what they need, stop \u2014 they do not stay
 * logged in as the tenant for hours.
 */

const encoder = new TextEncoder();

export const impersonationCookieName = "platform_admin_impersonation";
export const impersonationTtlSeconds = 60 * 60;

export type ImpersonationPayload = {
  /** Staff user id performing the impersonation. */
  staffUserId: string;
  /** Staff user email (rendered in the banner). */
  staffEmail: string;
  /** Target tenant id whose data the staff member will see. */
  tenantId: string;
  /** Unix seconds at which the impersonation was minted. */
  issuedAt: number;
};

function getAuthSecret(
  secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
) {
  if (!secret) {
    throw new Error(
      "AUTH_SECRET is required to sign platform-admin impersonation cookies",
    );
  }
  return secret;
}

function base64UrlEncode(value: string | Uint8Array) {
  const bytes =
    typeof value === "string" ? encoder.encode(value) : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(
    Math.ceil(value.length / 4) * 4,
    "=",
  );
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmacSha256(input: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(input)),
  );
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function mintImpersonationCookie(
  payload: Omit<ImpersonationPayload, "issuedAt"> & { issuedAt?: number },
  secret = getAuthSecret(),
): Promise<string> {
  const issuedAt = payload.issuedAt ?? Math.floor(Date.now() / 1000);
  const body = base64UrlEncode(
    JSON.stringify({ ...payload, issuedAt }),
  );
  const sig = base64UrlEncode(await hmacSha256(body, secret));
  return `${body}.${sig}`;
}

export async function verifyImpersonationCookie(
  token: string | undefined | null,
  secret = getAuthSecret(),
  now: () => number = () => Math.floor(Date.now() / 1000),
): Promise<ImpersonationPayload | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expected = base64UrlEncode(await hmacSha256(body, secret));
  if (!timingSafeEqual(sig, expected)) return null;

  let parsed: ImpersonationPayload;
  try {
    const json = new TextDecoder().decode(base64UrlDecode(body));
    parsed = JSON.parse(json) as ImpersonationPayload;
  } catch {
    return null;
  }

  if (
    typeof parsed.staffUserId !== "string" ||
    typeof parsed.staffEmail !== "string" ||
    typeof parsed.tenantId !== "string" ||
    typeof parsed.issuedAt !== "number"
  ) {
    return null;
  }

  if (now() - parsed.issuedAt > impersonationTtlSeconds) return null;
  return parsed;
}

export function getImpersonationCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: impersonationTtlSeconds,
  };
}
