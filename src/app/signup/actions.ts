"use server";

import { cookies } from "next/headers";
import { signIn } from "@/lib/auth";
import {
  AUTH_FLOW_COOKIE,
  AUTH_FLOW_COOKIE_MAX_AGE_SECONDS,
} from "@/lib/auth/flow";

/**
 * Server action triggered by the "Continue with Google" button on
 * `/signup`. Sets the short-lived `convo_auth_flow=signup` cookie so the
 * NextAuth `signIn` callback knows to allow user/tenant provisioning
 * (or bounce an existing user back to the dashboard with a welcome-back
 * toast), then kicks off the Google OAuth dance.
 */
export async function startGoogleSignup(formData: FormData): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_FLOW_COOKIE, "signup", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: AUTH_FLOW_COOKIE_MAX_AGE_SECONDS,
  });

  const plan = parsePlan(formData.get("plan"));
  const interval = parseInterval(formData.get("interval"));
  const params = new URLSearchParams();
  if (plan) params.set("plan", plan);
  params.set("interval", interval);

  await signIn("google", { redirectTo: `/onboarding?${params.toString()}` });
}

function parsePlan(value: FormDataEntryValue | null) {
  if (value === "starter" || value === "growth" || value === "scale") {
    return value;
  }
  return null;
}

function parseInterval(value: FormDataEntryValue | null) {
  return value === "month" ? "month" : "year";
}
