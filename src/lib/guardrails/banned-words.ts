/**
 * Banned-Word / Forbidden-Phrase Filter (CON-90)
 *
 * Post-processes assistant output to redact:
 *   1. tenant-configured `ai_persona.banned_words`
 *   2. tenant-configured `exclusion_list`
 *
 * Matching is case-insensitive whole-word/whole-phrase. Matches are
 * replaced with `[redacted]` so the redaction itself is human-readable
 * and never trips the model's own format expectations.
 *
 * Two surfaces:
 *   - `filterText(text, terms)` — one-shot, used in tests + for the
 *     full-buffer fallback path.
 *   - `createStreamingFilter(terms)` — stateful, tail-buffered
 *     streaming filter used in the chat SSE loop so we never emit a
 *     partial banned term before redacting it.
 */

const ESCAPE_RE = /[-/\\^$*+?.()|[\]{}]/g;

function escapeRegex(s: string): string {
  return s.replace(ESCAPE_RE, "\\$&");
}

/**
 * Normalise + dedupe the merged term list. Empty / whitespace-only
 * entries are dropped. Casing is preserved on the input side; matching
 * is always case-insensitive.
 */
export function collectBannedTerms(
  bannedWords: readonly string[] | undefined,
  exclusionList: readonly string[] | undefined,
): string[] {
  const out = new Set<string>();
  for (const list of [bannedWords ?? [], exclusionList ?? []]) {
    for (const raw of list) {
      if (typeof raw !== "string") continue;
      const trimmed = raw.trim();
      if (!trimmed) continue;
      out.add(trimmed);
    }
  }
  return Array.from(out);
}

/**
 * Build a single combined regex that matches ANY of the banned terms
 * as a whole word/phrase, case-insensitive. Returns null when there
 * are no terms to match (caller can skip filtering entirely).
 *
 * Word-boundary semantics: `\b` is used at each end. For multi-word
 * phrases the boundary only constrains the first and last token,
 * which is the correct behaviour — "medical advice" should match
 * "see medical advice now" but not "biomedicaladvicey".
 */
export function buildBannedRegex(terms: readonly string[]): RegExp | null {
  // Filter empty / whitespace-only terms defensively so a stray "" in
  // tenant config never produces a regex that matches every
  // word-boundary in the stream (which would be catastrophic for the
  // tail-buffered filter built on top of this).
  const cleaned = terms.filter((t) => typeof t === "string" && t.trim().length > 0);
  if (!cleaned.length) return null;
  // Sort longest-first so multi-word phrases win over their substrings
  // when terms overlap (e.g. "medical advice" beats "medical").
  const sorted = [...cleaned].sort((a, b) => b.length - a.length);
  const alternation = sorted.map(escapeRegex).join("|");
  return new RegExp(`\\b(?:${alternation})\\b`, "gi");
}

export const REDACTION = "[redacted]";

/**
 * One-shot filter — convenience wrapper for tests and any non-streaming
 * call sites.
 */
export function filterText(
  text: string,
  terms: readonly string[],
): { output: string; redactionCount: number } {
  const regex = buildBannedRegex(terms);
  if (!regex) return { output: text, redactionCount: 0 };
  let count = 0;
  const output = text.replace(regex, () => {
    count += 1;
    return REDACTION;
  });
  return { output, redactionCount: count };
}

// ─── Streaming filter ────────────────────────────────────────

export interface StreamingFilter {
  /** Feed a streamed chunk. Returns the prefix that is now safe to emit. */
  push(chunk: string): string;
  /** Drain remaining buffered text at end-of-stream. */
  flush(): string;
  /** Total redactions performed across the stream. */
  redactionCount(): number;
}

/**
 * Tail-buffered streaming filter.
 *
 * Maintains a rolling tail (the last `tailSize` characters of the
 * accumulated stream) that has not yet been flushed downstream. Any
 * text BEFORE the tail is guaranteed safe to emit, because no banned
 * term — even the longest — can span the boundary between "emitted"
 * and "buffered". Tail size = longest banned term length + a small
 * safety margin.
 *
 * If no banned terms are configured (post-merge, post-trim), the
 * filter is a pure passthrough — zero buffering, zero overhead. This
 * guarantee is enforced at the `buildBannedRegex` boundary: an empty
 * or all-whitespace terms list returns `null`, which short-circuits
 * here before any buffering state is allocated.
 */
export function createStreamingFilter(
  terms: readonly string[],
): StreamingFilter {
  const regex = buildBannedRegex(terms);
  if (!regex) {
    // Passthrough — zero overhead, zero buffering.
    return {
      push: (chunk: string) => chunk,
      flush: () => "",
      redactionCount: () => 0,
    };
  }

  // Captured non-null so the closures below don't need to re-narrow.
  const activeRegex: RegExp = regex;
  const maxTermLen = terms.reduce((m, t) => Math.max(m, t.length), 0);
  // Tail holds enough characters that any banned phrase (or near-miss
  // with leading word-boundary char) fits entirely. +8 covers
  // surrounding whitespace / punctuation needed for `\b`.
  const tailSize = maxTermLen + 8;
  // Matches any Unicode whitespace — used to pick the safe/tail cut
  // point. Previously this was a bare ASCII space, which meant streams
  // separated only by newlines (paragraph breaks, lists, code blocks)
  // could buffer indefinitely until end-of-stream flush.
  const WS_RE = /\s/g;

  let buffer = "";
  let count = 0;

  /**
   * Find the last whitespace position at or before `before` (exclusive
   * upper bound). Returns -1 when there is no whitespace in that range.
   * Mirrors `String.prototype.lastIndexOf` semantics but for any
   * whitespace character, not just ASCII space.
   */
  function lastWhitespaceBefore(s: string, before: number): number {
    for (let i = before - 1; i >= 0; i--) {
      const c = s.charCodeAt(i);
      // Fast path for the common ASCII whitespace cases.
      if (c === 0x20 || c === 0x0a || c === 0x0d || c === 0x09) return i;
      // Fall through to the full Unicode test for everything else.
      WS_RE.lastIndex = 0;
      if (WS_RE.test(s[i])) return i;
    }
    return -1;
  }

  function scanAndStrip(): string {
    // We scan everything BEFORE the last `tailSize` characters — BUT we
    // additionally pull the safe/tail boundary back to the last
    // whitespace within the safe region, so a banned phrase that
    // starts inside the safe region and extends into the tail is never
    // split between the emitted prefix and the buffered tail.
    if (buffer.length <= tailSize) return "";
    let safeLen = buffer.length - tailSize;
    // Pull back to the last whitespace at or before `safeLen`. If no
    // whitespace exists in the safe region, buffer everything until we
    // see one (or until flush()).
    const lastWs = lastWhitespaceBefore(buffer, safeLen);
    if (lastWs < 0) return "";
    safeLen = lastWs;
    if (safeLen <= 0) return "";
    const safePart = buffer.slice(0, safeLen);
    const tail = buffer.slice(safeLen);
    const r = new RegExp(activeRegex.source, activeRegex.flags);
    const filtered = safePart.replace(r, () => {
      count += 1;
      return REDACTION;
    });
    buffer = tail;
    return filtered;
  }

  return {
    push(chunk: string) {
      if (!chunk) return "";
      buffer += chunk;
      return scanAndStrip();
    },
    flush() {
      if (!buffer) return "";
      const r = new RegExp(activeRegex.source, activeRegex.flags);
      const filtered = buffer.replace(r, () => {
        count += 1;
        return REDACTION;
      });
      buffer = "";
      return filtered;
    },
    redactionCount: () => count,
  };
}
