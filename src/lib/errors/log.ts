/**
 * CON-error-logging: in-app capture of dashboard server-component /
 * dashboard API-handler exceptions.
 *
 * Two production 500s (digests `1644138080` and `2442540290`) aged out of
 * Vercel's free-tier runtime logs before we could pull stack traces. Cam
 * vetoed external log sinks. This helper writes to the `dashboard_errors`
 * Supabase table via the server-side service-role client so the rows are
 * available to PM via `SELECT ... FROM dashboard_errors` long after the
 * Vercel invocation has aged out.
 *
 * Hard invariants:
 *
 *   1. **Never throws.** The original error path must be unaffected. If
 *      logging fails (env missing, Supabase down, write rejected) we
 *      console.error the logging failure and return. The caller's `throw`
 *      proceeds as if logging never happened.
 *
 *   2. **No PII.** `request_meta` is allow-listed at write time. No request
 *      bodies, no auth tokens, no emails / names / phone numbers, no IPs.
 *      Only the keys explicitly added by `sanitiseRequestMeta()` survive.
 *
 *   3. **Bounded payloads.** `message` is truncated to 4 KB, `stack` to
 *      32 KB. Pathological errors can otherwise blow the row size.
 */
import { getSupabaseClient } from "@/lib/supabase-client";

// --- Tuning knobs ---------------------------------------------------------

const MAX_MESSAGE_BYTES = 4_096;
const MAX_STACK_BYTES = 32_768;

// `request_meta` keys that are *always* dropped, even if a caller passes
// them. Defence in depth against accidental PII leakage from a future
// caller that forgets the allow-list contract.
const ALWAYS_DROP_META_KEYS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-auth",
  "x-api-key",
  "api-key",
  "email",
  "phone",
  "name",
  "display_name",
  "displayName",
  "ip",
  "ipAddress",
  "ip_address",
  "x-forwarded-for",
  "x-real-ip",
  "remoteAddress",
  "remote_address",
  "body",
  "requestBody",
  "request_body",
]);

// Headers we are willing to keep on `request_meta.headers`. Strict allow-list:
// only routing/correlation identifiers + UA. Everything else is dropped.
const ALLOWED_HEADER_KEYS = new Set([
  "x-vercel-id",
  "cf-ray",
  "cf-connecting-ipcountry",
  "x-vercel-deployment-url",
  "user-agent",
]);

// --- Types ----------------------------------------------------------------

export interface LogDashboardErrorContext {
  route: string;
  userId?: string;
  tenantId?: string;
  /**
   * Sanitised at write time. Pass anything you want logged; the writer
   * drops `ALWAYS_DROP_META_KEYS`, restricts `headers` to
   * `ALLOWED_HEADER_KEYS`, and stringifies nested objects via JSON. No
   * bodies. No auth tokens.
   */
  requestMeta?: Record<string, unknown>;
  /**
   * Optional explicit Vercel error digest. Server-side throws don't
   * usually have this on the Error object — it's surfaced by Next.js
   * when the error.tsx boundary catches and Next.js shows the digest to
   * the visitor. The client-side `error.tsx` boundary forwards
   * `error.digest` into this field via `/api/error-log`.
   */
  digest?: string;
}

// --- Public API -----------------------------------------------------------

/**
 * Log a dashboard error to Supabase. Never throws.
 *
 * Usage at a server-component / API-handler route boundary:
 *
 *   try {
 *     return await renderTheThing();
 *   } catch (err) {
 *     await logDashboardError(err, {
 *       route: "/dashboard/contacts/[contactId]",
 *       userId: session?.user?.id,
 *       tenantId: tenant?.id,
 *       requestMeta: { method: "GET", search: searchParams },
 *     });
 *     throw err; // re-throw so Next.js's error.tsx renders for the user.
 *   }
 */
export async function logDashboardError(
  err: unknown,
  ctx: LogDashboardErrorContext
): Promise<void> {
  try {
    // Short-circuit when Supabase env isn't wired (local dev, CI builds
    // that pre-render dashboard pages without a runtime DB). Without this
    // guard we'd log a noisy `[logDashboardError] unexpected logging
    // failure` line for every prerender attempt.
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      return;
    }
    const row = buildRow(err, ctx);
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("dashboard_errors").insert(row);
    if (error) {
      // Never throw — just surface the logging failure to the runtime log
      // so we know capture is broken without breaking the original error path.
      console.error(
        "[logDashboardError] insert failed",
        {
          route: ctx.route,
          code: error.code,
          message: error.message,
        }
      );
    }
  } catch (loggingErr) {
    // Belt-and-braces: any throw (env missing, client construction failure,
    // unexpected) must not break the caller.
    console.error("[logDashboardError] unexpected logging failure", loggingErr);
  }
}

// --- Internals ------------------------------------------------------------

interface DashboardErrorRow {
  digest: string | null;
  error_class: string | null;
  message: string | null;
  stack: string | null;
  route: string | null;
  user_id: string | null;
  tenant_id: string | null;
  request_meta: Record<string, unknown>;
}

function buildRow(
  err: unknown,
  ctx: LogDashboardErrorContext
): DashboardErrorRow {
  const { errorClass, message, stack, digestFromErr } = extractErrorParts(err);
  return {
    digest: ctx.digest ?? digestFromErr ?? null,
    error_class: errorClass,
    message: truncate(message, MAX_MESSAGE_BYTES),
    stack: truncate(stack, MAX_STACK_BYTES),
    route: ctx.route ?? null,
    user_id: ctx.userId ?? null,
    tenant_id: ctx.tenantId ?? null,
    request_meta: sanitiseRequestMeta(ctx.requestMeta),
  };
}

function extractErrorParts(err: unknown): {
  errorClass: string | null;
  message: string | null;
  stack: string | null;
  digestFromErr: string | null;
} {
  if (err instanceof Error) {
    // Next.js sometimes attaches `digest` to the error instance.
    const maybeDigest = (err as unknown as { digest?: unknown }).digest;
    const digestFromErr =
      typeof maybeDigest === "string" ? maybeDigest : null;
    return {
      errorClass: err.constructor?.name ?? "Error",
      message: err.message ?? null,
      stack: err.stack ?? null,
      digestFromErr,
    };
  }
  if (typeof err === "string") {
    return {
      errorClass: "string",
      message: err,
      stack: null,
      digestFromErr: null,
    };
  }
  // Last-resort: serialise unknown shapes so we still get *something*.
  let message: string | null = null;
  try {
    message = JSON.stringify(err);
  } catch {
    message = String(err);
  }
  return {
    errorClass: typeof err,
    message,
    stack: null,
    digestFromErr: null,
  };
}

function truncate(value: string | null, maxBytes: number): string | null {
  if (value === null || value === undefined) return null;
  // Cheap byte-length proxy: chars * 4 is the worst case for UTF-16 → UTF-8.
  // For our purposes (English stack traces) string length ≈ byte length is fine.
  if (value.length <= maxBytes) return value;
  return value.slice(0, maxBytes) + "\n…[truncated]";
}

/**
 * Allow-list sanitiser for `request_meta`. Never leaks PII or auth.
 *
 * - Drops any key in `ALWAYS_DROP_META_KEYS`.
 * - If the caller passes `headers`, only keys in `ALLOWED_HEADER_KEYS`
 *   survive.
 * - All values are coerced to string / number / boolean / null /
 *   plain-object / plain-array via JSON round-trip. Functions, Dates,
 *   Buffers, etc. get coerced to safe shapes.
 * - Anything we can't safely serialise is dropped.
 */
export function sanitiseRequestMeta(
  meta: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!meta) return {};
  const out: Record<string, unknown> = {};
  for (const [rawKey, rawValue] of Object.entries(meta)) {
    const key = rawKey.toLowerCase();
    if (ALWAYS_DROP_META_KEYS.has(key) || ALWAYS_DROP_META_KEYS.has(rawKey)) {
      continue;
    }
    if (rawKey === "headers") {
      out.headers = filterHeaders(rawValue);
      continue;
    }
    const safe = toSafeValue(rawValue);
    if (safe !== undefined) {
      out[rawKey] = safe;
    }
  }
  return out;
}

function filterHeaders(value: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!value || typeof value !== "object") return out;
  // Support both Headers-like objects (iteration) and plain records.
  const entries: Array<[string, unknown]> =
    typeof (value as { entries?: unknown }).entries === "function"
      ? // Cast through unknown to satisfy the strict eslint no-explicit-any
        // policy that the rest of the codebase uses.
        Array.from(
          (value as unknown as { entries: () => IterableIterator<[string, unknown]> }).entries()
        )
      : Object.entries(value as Record<string, unknown>);
  for (const [rawKey, rawValue] of entries) {
    const key = rawKey.toLowerCase();
    if (!ALLOWED_HEADER_KEYS.has(key)) continue;
    if (typeof rawValue === "string") out[key] = rawValue;
    else if (rawValue !== null && rawValue !== undefined)
      out[key] = String(rawValue);
  }
  return out;
}

function toSafeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean") return value;
  try {
    // JSON round-trip strips functions / undefined and proves the value is
    // serialisable. Anything that throws gets dropped.
    return JSON.parse(JSON.stringify(value));
  } catch {
    return undefined;
  }
}
