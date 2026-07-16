/**
 * Supabase clients for server-side operations.
 *
 * getSupabaseClient() is service-role only and should stay limited to paths
 * that explicitly need elevated storage/system access.
 */
import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const missingJwtSecretMessage =
  "Supabase JWT secret not configured. Pull from Supabase project -> settings -> API -> JWT Secret and add to 1P + Vercel env as SUPABASE_JWT_SECRET.";

function base64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function mintSupabaseJwt({
  userId,
  tenantId,
  secret = process.env.SUPABASE_JWT_SECRET,
  now = Math.floor(Date.now() / 1000),
}: {
  userId: string;
  tenantId?: string;
  secret?: string;
  now?: number;
}) {
  if (!secret) {
    throw new Error(missingJwtSecretMessage);
  }

  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    sub: userId,
    role: "authenticated",
    aud: "authenticated",
    iat: now,
    exp: now + 60,
    ...(tenantId ? { tenant_id: tenantId } : {}),
  };
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(
    JSON.stringify(payload),
  )}`;
  const signature = createHmac("sha256", secret).update(unsigned).digest();

  return `${unsigned}.${base64Url(signature)}`;
}

export function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function getAuthenticatedSupabaseClient({
  userId,
  tenantId,
}: {
  userId: string;
  tenantId: string;
}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set",
    );
  }

  const jwt = mintSupabaseJwt({ userId, tenantId });

  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    },
  });
}
