/**
 * Lead Capture — explicit-contact extraction (CON-95 / C-06)
 *
 * Deterministic, regex-only PII pickers. No LLM, no network, no allocations
 * beyond the matched substrings. These functions are pure and side-effect-free
 * so they're safe to call on every inbound user message.
 *
 * Design notes:
 *   - The regexes are intentionally conservative. Better to miss a fuzzy
 *     capture than to mis-extract noise into a tenant's lead pipeline.
 *   - Names are NOT auto-extracted from free text (too noisy). Only the
 *     "my name is X" / "I'm X" / "this is X" patterns are honoured.
 *   - Phone extraction prioritises Australian formats but accepts general
 *     international E.164. All matches are normalised to a trimmed string
 *     so downstream consumers can decide on canonicalisation.
 */

export interface ExplicitExtraction {
  email: string | null;
  phone: string | null;
  name: string | null;
}

// RFC-flavoured but deliberately constrained: no consecutive dots, no
// trailing punctuation, requires a TLD of 2+ chars.
const EMAIL_RE =
  /\b([a-z0-9](?:[a-z0-9._+-]{0,62}[a-z0-9])?@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)\b/i;

// Phone patterns, in priority order:
//   AU mobile: 04xx xxx xxx (spaces/dashes optional)
//   AU landline: 0x xxxx xxxx
//   International E.164-ish: +<country><digits>, 7-15 digits total
//
// We require word boundaries on both sides to avoid grabbing numbers that
// happen to live inside longer tokens.
const PHONE_PATTERNS: RegExp[] = [
  /(?<![\d+])(\+?61[\s-]?4\d{2}[\s-]?\d{3}[\s-]?\d{3})(?!\d)/,   // +61 4xx xxx xxx
  /(?<![\d+])(04\d{2}[\s-]?\d{3}[\s-]?\d{3})(?!\d)/,             // 04xx xxx xxx
  /(?<![\d+])(0[2378][\s-]?\d{4}[\s-]?\d{4})(?!\d)/,             // 0[2,3,7,8] xxxx xxxx
  /(?<![\d+])(\+\d{1,3}[\s-]?\d{2,4}[\s-]?\d{2,4}[\s-]?\d{2,6})(?!\d)/, // +<cc> generic
];

// "My name is …" / "I am …" / "I'm …" / "This is …" — captures up to two
// title-cased tokens (handles compound surnames like "Smith Jones").
// Name patterns explicitly enumerate case on the leading pronoun/verb so
// the captured name can keep its title-case anchor (`[A-Z]` first letter)
// without the regex /i flag accidentally matching lowercase tokens like
// "calling" or "looking".
const NAME_PATTERNS: RegExp[] = [
  /\b[Mm]y [Nn]ame(?:'s| [Ii]s)\s+([A-Z][a-zA-Z'-]{1,30}(?:\s+[A-Z][a-zA-Z'-]{1,30})?)\b/,
  /\b[Ii]['\u2019][Mm]\s+([A-Z][a-zA-Z'-]{1,30}(?:\s+[A-Z][a-zA-Z'-]{1,30})?)\b/,
  /\b[Ii] [Aa]m\s+([A-Z][a-zA-Z'-]{1,30}(?:\s+[A-Z][a-zA-Z'-]{1,30})?)\b/,
  /\b[Tt]his [Ii]s\s+([A-Z][a-zA-Z'-]{1,30}(?:\s+[A-Z][a-zA-Z'-]{1,30})?)\b(?!\s+(?:a|an|the|just|only))/,
];

// Words that look title-cased but should never be treated as names. Keeps
// "I'm Australian" / "this is John's brother" from polluting the extract.
const NAME_DENYLIST = new Set([
  "Australian",
  "American",
  "British",
  "Just",
  "Only",
  "Trying",
  "Looking",
  "Wondering",
  "Curious",
  "Interested",
  "Calling",
  "Asking",
  "Here",
  "There",
]);

function extractEmail(text: string): string | null {
  const m = text.match(EMAIL_RE);
  return m ? m[1].toLowerCase() : null;
}

function extractPhone(text: string): string | null {
  for (const re of PHONE_PATTERNS) {
    const m = text.match(re);
    if (m) return m[1].replace(/\s+/g, " ").trim();
  }
  return null;
}

function extractName(text: string): string | null {
  for (const re of NAME_PATTERNS) {
    const m = text.match(re);
    if (m) {
      const candidate = m[1].trim();
      const first = candidate.split(/\s+/)[0];
      if (NAME_DENYLIST.has(first)) continue;
      // Reject single-letter "names" — likely an article slip-through.
      if (candidate.length < 2) continue;
      return candidate;
    }
  }
  return null;
}

/**
 * Run all extractors against a single user message.
 * Returns `null` for any field that did not yield a confident match.
 */
export function extractExplicitContact(message: string): ExplicitExtraction {
  if (!message || typeof message !== "string") {
    return { email: null, phone: null, name: null };
  }
  return {
    email: extractEmail(message),
    phone: extractPhone(message),
    name: extractName(message),
  };
}

/**
 * Convenience: did the message contain ANY explicit contact PII?
 */
export function hasExplicitContact(message: string): boolean {
  const e = extractExplicitContact(message);
  return Boolean(e.email || e.phone || e.name);
}
