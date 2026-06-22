/**
 * POST /api/error-log  (CON-error-logging)
 *
 * Client-side bridge into `logDashboardError`. Called by
 * `app/dashboard/error.tsx` when the client error boundary catches an
 * exception thrown by a dashboard server component, so we can capture the
 * Vercel `error.digest` alongside whatever client-side context the boundary
 * has.
 *
 * Auth: NextAuth session required. The route is matched by `middleware.ts`
 * (it's under `/api/` and not in the public allow-list), but middleware
 * only checks for the session cookie. We re-check the actual session here
 * to avoid trusting a presence-only cookie probe.
 *
 * Returns 204 on success (even if the underlying log write fails —
 * `logDashboardError` swallows failures by contract so the client never
 * loops on a logging outage).
 *
 * Privacy: the helper sanitises `requestMeta`. The body is small (digest,
 * message, stack, route, requestMeta). We do NOT log the request body to
 * the dashboard_errors row — only the parsed structured fields below.
 */
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { logDashboardError } from "@/lib/errors/log";

// Cap the request body so a misbehaving client can't blow our memory or our
// downstream row size. The helper truncates again, but we belt-and-brace here.
const MAX_BODY_BYTES = 64 * 1024;

interface ErrorLogBody {
  digest?: unknown;
  errorClass?: unknown;
  message?: unknown;
  stack?: unknown;
  route?: unknown;
  requestMeta?: unknown;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Read with a size guard.
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  if (raw.length > MAX_BODY_BYTES) {
    raw = raw.slice(0, MAX_BODY_BYTES);
  }

  let body: ErrorLogBody = {};
  try {
    body = raw ? (JSON.parse(raw) as ErrorLogBody) : {};
  } catch {
    // Malformed body — capture nothing, but still return 204 so the
    // client doesn't retry-storm us.
    return new NextResponse(null, { status: 204 });
  }

  // Synthesise an Error-shaped object so `logDashboardError` can pull the
  // class / message / stack out via the normal extraction path.
  const synthetic = new Error(
    typeof body.message === "string" && body.message.length > 0
      ? body.message
      : "client-error-boundary"
  );
  // Preserve the client-reported error class on the synthetic so the
  // captured row reflects e.g. `TypeError` rather than `Error`.
  if (typeof body.errorClass === "string" && body.errorClass.length > 0) {
    Object.defineProperty(synthetic, "constructor", {
      value: { name: body.errorClass },
      enumerable: false,
      configurable: true,
      writable: true,
    });
  }
  if (typeof body.stack === "string") {
    synthetic.stack = body.stack;
  }

  await logDashboardError(synthetic, {
    route: typeof body.route === "string" ? body.route : "/dashboard/error",
    userId: session.user.id,
    digest: typeof body.digest === "string" ? body.digest : undefined,
    requestMeta:
      body.requestMeta && typeof body.requestMeta === "object"
        ? (body.requestMeta as Record<string, unknown>)
        : { source: "client-error-boundary" },
  });

  return new NextResponse(null, { status: 204 });
}
