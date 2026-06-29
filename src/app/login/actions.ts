"use server";

import { cookies } from "next/headers";
import { signIn } from "@/lib/auth";
import {
  AUTH_FLOW_COOKIE,
  AUTH_FLOW_COOKIE_MAX_AGE_SECONDS,
} from "@/lib/auth/flow";

/**
 * Server action triggered by the "Continue with Google" button on
 * `/login`. Sets the short-lived `convo_auth_flow=login` cookie so the
 * NextAuth `signIn` callback can refuse to silently provision a new
 * user/tenant, then kicks off the Google OAuth dance.
 */
export async function startGoogleLogin(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_FLOW_COOKIE, "login", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: AUTH_FLOW_COOKIE_MAX_AGE_SECONDS,
  });

  await signIn("google", { redirectTo: "/dashboard" });
}
