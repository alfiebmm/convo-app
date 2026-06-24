export const adminSessionCookieName = "__Secure-authjs.admin-session-token";
export const adminStepUpCookieName = "__Secure-authjs.admin-stepup-token";

const encoder = new TextEncoder();
const slidingTtlSeconds = 8 * 60 * 60;
const hardCapSeconds = 24 * 60 * 60;
const refreshAfterSeconds = 60 * 60;
const stepUpTtlSeconds = 5 * 60;

export type AdminSessionPayload = {
  userId: string;
  totpVerifiedAt: number;
  originalMintedAt: number;
};

export type AdminStepUpPayload = {
  userId: string;
  action: string;
  issuedAt: number;
};

function getAuthSecret(secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET) {
  if (!secret) throw new Error("AUTH_SECRET is required to sign admin session cookies");
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

async function signJwt(payload: Record<string, unknown>, secret: string) {
  const header = { alg: "HS256", typ: "JWT" };
  const unsigned = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(
    JSON.stringify(payload),
  )}`;
  const signature = await hmacSha256(unsigned, secret);
  return `${unsigned}.${base64UrlEncode(signature)}`;
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyJwt(token: string, secret: string) {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) return null;

  const expected = base64UrlEncode(await hmacSha256(`${header}.${payload}`, secret));
  if (!timingSafeEqual(signature, expected)) return null;

  try {
    return JSON.parse(new TextDecoder().decode(base64UrlDecode(payload))) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}

export function getAdminSessionCookieOptions(maxAge = slidingTtlSeconds) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "strict" as const,
    path: "/platform-admin",
    maxAge,
  };
}

export async function mintAdminSession(
  userId: string,
  {
    now = Math.floor(Date.now() / 1000),
    originalMintedAt = now,
    secret = getAuthSecret(),
  }: {
    now?: number;
    originalMintedAt?: number;
    secret?: string;
  } = {},
) {
  return signJwt(
    {
      sub: userId,
      totpVerifiedAt: now,
      originalMintedAt,
      exp: now + slidingTtlSeconds,
    },
    secret,
  );
}

export async function verifyAdminSession(
  token: string,
  {
    now = Math.floor(Date.now() / 1000),
    secret = getAuthSecret(),
  }: { now?: number; secret?: string } = {},
): Promise<AdminSessionPayload | null> {
  const payload = await verifyJwt(token, secret);
  if (!payload) return null;

  const userId = typeof payload.sub === "string" ? payload.sub : null;
  const totpVerifiedAt =
    typeof payload.totpVerifiedAt === "number" ? payload.totpVerifiedAt : null;
  const originalMintedAt =
    typeof payload.originalMintedAt === "number" ? payload.originalMintedAt : null;
  const exp = typeof payload.exp === "number" ? payload.exp : null;

  if (!userId || !totpVerifiedAt || !originalMintedAt || !exp) return null;
  if (exp <= now) return null;
  if (originalMintedAt + hardCapSeconds <= now) return null;

  return { userId, totpVerifiedAt, originalMintedAt };
}

export function shouldRefreshAdminSession(
  session: AdminSessionPayload,
  now = Math.floor(Date.now() / 1000),
) {
  return now - session.totpVerifiedAt >= refreshAfterSeconds;
}

export async function refreshAdminSessionToken(
  session: AdminSessionPayload,
  {
    now = Math.floor(Date.now() / 1000),
    secret = getAuthSecret(),
  }: { now?: number; secret?: string } = {},
) {
  return mintAdminSession(session.userId, {
    now,
    originalMintedAt: session.originalMintedAt,
    secret,
  });
}

export async function mintStepUpSession(
  userId: string,
  action: string,
  {
    now = Math.floor(Date.now() / 1000),
    secret = getAuthSecret(),
  }: { now?: number; secret?: string } = {},
) {
  return signJwt({ sub: userId, action, issuedAt: now, exp: now + stepUpTtlSeconds }, secret);
}

export async function verifyStepUpSession(
  token: string,
  action: string,
  {
    now = Math.floor(Date.now() / 1000),
    secret = getAuthSecret(),
  }: { now?: number; secret?: string } = {},
): Promise<AdminStepUpPayload | null> {
  const payload = await verifyJwt(token, secret);
  if (!payload) return null;
  const userId = typeof payload.sub === "string" ? payload.sub : null;
  const cookieAction = typeof payload.action === "string" ? payload.action : null;
  const issuedAt = typeof payload.issuedAt === "number" ? payload.issuedAt : null;
  const exp = typeof payload.exp === "number" ? payload.exp : null;

  if (!userId || !cookieAction || !issuedAt || !exp) return null;
  if (cookieAction !== action || exp <= now || issuedAt + stepUpTtlSeconds <= now) {
    return null;
  }

  return { userId, action: cookieAction, issuedAt };
}
