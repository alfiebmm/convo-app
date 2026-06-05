/**
 * CON-92 — Streaming UX configuration helpers.
 *
 * Shared between the server (/api/widget/config) and the widget bundle.
 * Keeps clamp logic in one place so a malformed dashboard value can never
 * blow up either side.
 */

export interface StreamingTunables {
  /** Minimum time the thinking indicator stays on screen before the first
   *  token renders, in ms. AC: "at least 1.5s". */
  thinkingMinMs: number;
  /** Target client-side render rate (tokens/second). Tech note:
   *  "throttle token delivery client-side to simulate natural reading
   *  pace even if inference is faster". Spec window 40-60 tps, 50 default. */
  tokensPerSecond: number;
}

export const STREAMING_DEFAULTS: StreamingTunables = {
  thinkingMinMs: 1500,
  tokensPerSecond: 50,
};

export const THINKING_MIN_MS_BOUNDS = { min: 0, max: 6000 } as const;
export const TOKENS_PER_SECOND_BOUNDS = { min: 10, max: 200 } as const;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Pick out the streaming block from arbitrary tenant settings, clamped to
 *  safe ranges. Returns an empty object (not the defaults) when nothing
 *  valid was supplied — callers can detect "tenant did not override" and
 *  omit the field from the widget payload. */
export function pickStreamingOverrides(
  input: unknown
): Partial<StreamingTunables> {
  const out: Partial<StreamingTunables> = {};
  if (!input || typeof input !== "object") return out;
  const obj = input as Record<string, unknown>;
  if (typeof obj.thinkingMinMs === "number" && isFinite(obj.thinkingMinMs)) {
    out.thinkingMinMs = clamp(
      obj.thinkingMinMs,
      THINKING_MIN_MS_BOUNDS.min,
      THINKING_MIN_MS_BOUNDS.max
    );
  }
  if (typeof obj.tokensPerSecond === "number" && isFinite(obj.tokensPerSecond)) {
    out.tokensPerSecond = clamp(
      obj.tokensPerSecond,
      TOKENS_PER_SECOND_BOUNDS.min,
      TOKENS_PER_SECOND_BOUNDS.max
    );
  }
  return out;
}

/** Resolve final, fully-defaulted tunables for the widget. */
export function resolveStreamingConfig(
  override: Partial<StreamingTunables> | null | undefined
): StreamingTunables {
  return {
    thinkingMinMs:
      override?.thinkingMinMs ?? STREAMING_DEFAULTS.thinkingMinMs,
    tokensPerSecond:
      override?.tokensPerSecond ?? STREAMING_DEFAULTS.tokensPerSecond,
  };
}
