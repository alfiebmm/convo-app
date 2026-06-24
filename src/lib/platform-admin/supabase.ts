/**
 * Platform-admin Supabase client.
 *
 * We use anon + admin JWT (not service_role) so that defence-in-depth RLS
 * policies via `is_platform_staff()` apply. Bypassing RLS with service_role
 * would defeat the audit-gate guarantee.
 */
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

function getSessionTokenCookie(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return (
    cookieStore.get("__Secure-authjs.session-token")?.value ??
    cookieStore.get("authjs.session-token")?.value
  );
}

export async function getPlatformAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set",
    );
  }

  const cookieStore = await cookies();
  const jwt = getSessionTokenCookie(cookieStore);
  if (!jwt) throw new Error("Platform admin JWT cookie is missing");

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
