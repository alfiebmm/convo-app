/**
 * Platform-admin Supabase client.
 *
 * We mint a short-lived Supabase-signed JWT from the already-verified
 * NextAuth session, then use anon + that JWT so RLS policies via
 * `is_platform_staff()` apply. Bypassing RLS with service_role would defeat
 * the audit-gate guarantee.
 */
import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { requirePlatformStaff } from "@/lib/platform-admin/access";

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
  secret = process.env.SUPABASE_JWT_SECRET,
  now = Math.floor(Date.now() / 1000),
}: {
  userId: string;
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
  };
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(
    JSON.stringify(payload),
  )}`;
  const signature = createHmac("sha256", secret).update(unsigned).digest();

  return `${unsigned}.${base64Url(signature)}`;
}

export async function getPlatformAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set",
    );
  }

  const { user } = await requirePlatformStaff();
  const jwt = mintSupabaseJwt({ userId: user.id });

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
