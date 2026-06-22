/**
 * CON-error-logging: route-boundary wrappers.
 *
 * Thin helpers that take a server-component render function or an API-
 * handler function and wrap it in a try/catch that calls
 * `logDashboardError` and then rethrows. Two reasons we don't just inline
 * the try/catch at every call site:
 *
 *   1. The wrap-then-rethrow pattern is mechanical and easy to get
 *      subtly wrong (e.g. forgetting to rethrow, swallowing the original
 *      error, or accidentally double-logging on retry). Centralising
 *      makes the pattern auditable.
 *
 *   2. The wrappers attach the route template at the call site once, so
 *      every captured row carries a stable route identifier without the
 *      caller having to remember to pass it.
 */
import { logDashboardError } from "./log";

// --- Server-component (page.tsx) wrapper ---------------------------------

/**
 * Wrap a dashboard `page.tsx` default export. Usage:
 *
 *   async function PageImpl({ params }: { params: ... }) {
 *     ...the existing body...
 *   }
 *
 *   export default withDashboardErrorLogging(PageImpl, {
 *     route: "/dashboard/contacts/[contactId]",
 *   });
 *
 * Logs once on throw, then rethrows so Next.js's error.tsx still
 * renders for the user.
 */
export function withDashboardErrorLogging<
  TArgs extends unknown[],
  TResult,
>(
  fn: (...args: TArgs) => Promise<TResult>,
  ctx: { route: string }
): (...args: TArgs) => Promise<TResult> {
  return async function wrapped(...args: TArgs): Promise<TResult> {
    try {
      return await fn(...args);
    } catch (err) {
      // Best-effort tenant/user extraction would require duplicating the
      // auth-context resolution that the page itself does. We deliberately
      // skip it here: the captured row will carry the route + stack + the
      // class of error, which is enough to triage. If a caller wants to
      // attach tenant_id / user_id, it can call `logDashboardError`
      // directly from inside its own try/catch.
      await logDashboardError(err, {
        route: ctx.route,
        requestMeta: { kind: "server-component" },
      });
      throw err;
    }
  };
}

// --- API-handler wrapper -------------------------------------------------

/**
 * Wrap a Next.js Route Handler (`GET`/`POST`/etc.) so any throw is
 * captured before the framework's default 500 path.
 *
 * Usage:
 *
 *   async function handler(req: NextRequest) { ... }
 *   export const GET = withApiErrorLogging(handler, {
 *     route: "/api/cases/[caseId]",
 *   });
 *
 * `request` is read non-destructively: only headers + method + the parsed
 * URL search params are surfaced into `request_meta`. The request body is
 * NEVER read here — doing so would consume the stream before the handler
 * even runs.
 */
export function withApiErrorLogging<
  TArgs extends unknown[],
  TResult,
>(
  fn: (...args: TArgs) => Promise<TResult>,
  ctx: { route: string }
): (...args: TArgs) => Promise<TResult> {
  return async function wrapped(...args: TArgs): Promise<TResult> {
    try {
      return await fn(...args);
    } catch (err) {
      const maybeRequest = args[0];
      const meta =
        maybeRequest instanceof Request
          ? safeExtractApiMeta(maybeRequest)
          : {};
      await logDashboardError(err, {
        route: ctx.route,
        requestMeta: { kind: "api-handler", ...meta },
      });
      throw err;
    }
  };
}

function safeExtractApiMeta(request: Request): Record<string, unknown> {
  try {
    const url = new URL(request.url);
    // Search-param KEYS only — values may carry PII (e.g. `?email=...`).
    const searchKeys: string[] = [];
    for (const key of url.searchParams.keys()) {
      if (!searchKeys.includes(key)) searchKeys.push(key);
    }
    return {
      method: request.method,
      pathname: url.pathname,
      searchKeys,
      headers: request.headers, // sanitiser will allow-list
    };
  } catch {
    return {};
  }
}
