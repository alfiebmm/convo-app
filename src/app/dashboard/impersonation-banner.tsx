/**
 * CON-239 \u2014 Visible "you are impersonating" banner.
 *
 * Renders ONLY when a valid `platform_admin_impersonation` cookie is
 * present and bound to the current user. Reads from cookies in the
 * dashboard layout (server component) \u2014 the Stop button posts to
 * `stopImpersonationAction`, which is the only path that touches the
 * cookie.
 */
import { cookies } from "next/headers";
import {
  impersonationCookieName,
  verifyImpersonationCookie,
} from "@/lib/platform-admin/impersonation";
import { stopImpersonationAction } from "./impersonation-actions";

export async function ImpersonationBanner() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(impersonationCookieName)?.value;
  const payload = await verifyImpersonationCookie(raw);
  if (!payload) return null;

  return (
    <div
      role="status"
      className="border-b border-amber-300 bg-amber-100 px-6 py-2 text-sm text-amber-900"
    >
      <div className="flex items-center justify-between gap-4">
        <span>
          Viewing as staff:{" "}
          <span className="font-semibold">{payload.staffEmail}</span>
        </span>
        <form action={stopImpersonationAction}>
          <button
            type="submit"
            className="rounded-md border border-amber-400 bg-white px-3 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-50"
          >
            Stop impersonating
          </button>
        </form>
      </div>
    </div>
  );
}
