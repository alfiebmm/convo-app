/**
 * CON-149 (linking-policy lock-in, Cam 5 Jun 2026):
 *
 *   "Generated content links ONLY to `tenant.domain`. No third-party
 *    hyperlinks, ever. No tenant-configurable toggle."
 *
 * This module implements the post-generation URL-host check. It is a pure
 * function (no I/O, no state) that scans every hyperlink in a generated
 * payload and reports any link whose host is not the tenant's own domain.
 *
 * Two intended call sites (wired in a follow-up PR — this file is the
 * primitive, not the wiring):
 *
 *   1. Article generator (`src/lib/pipeline/generate-article.ts`)
 *      — run on `body` (markdown) post-generation. On failure: regenerate
 *      with a tightened prompt, max N retries, then fail the case.
 *
 *   2. Chatbot reply finaliser (`src/app/api/chat/route.ts`)
 *      — run on the full streamed response *before* the final SSE flush.
 *      Cheap (a few hundred microseconds for typical replies). On failure:
 *      strip the offending anchor(s) and replace with a plain text label,
 *      OR drop the reply and emit a soft fallback — call-site decides.
 *
 * What counts as a "link":
 *
 *   - Markdown:     `[label](url)` and `[label](url "title")`
 *   - HTML anchor:  `<a href="url">…</a>` (case-insensitive, single or
 *                   double-quoted, plus unquoted forms)
 *   - Bare URLs:    `http(s)://…` not inside a markdown/HTML link. Treated
 *                   as a finding (LLMs love dropping bare URLs as "see X").
 *
 * What does NOT count (intentionally not flagged):
 *
 *   - Relative paths (`/about`, `./foo`, `#anchor`, `mailto:`, `tel:`).
 *     These either don't have a host or aren't navigable hyperlinks.
 *   - URLs inside fenced code blocks (```…```). Code samples are content,
 *     not links the visitor will follow.
 *   - URLs inside inline code (`` `…` ``). Same rationale.
 *
 * Host matching rules:
 *
 *   - Exact match on `tenant.domain` (case-insensitive).
 *   - Subdomain match: any `*.tenant.domain` is allowed. e.g. tenant
 *     `doggo.com.au` permits `app.doggo.com.au`, `blog.doggo.com.au`.
 *   - Protocol-relative URLs (`//host/path`) are parsed and the host
 *     checked the same way.
 *   - IPv4/IPv6 literals never match a domain — always flagged.
 *
 * Acceptance fixtures + the runnable spec live in
 * `src/lib/guardrails/__tests__/link-host.test.ts`. Run with
 * `npx tsx src/lib/guardrails/__tests__/link-host.test.ts`.
 */

export interface LinkHostFinding {
  /** What kind of link form the host violated through. */
  kind: "markdown" | "html-anchor" | "bare-url";
  /** Raw href / URL as it appeared in the source. */
  href: string;
  /** Parsed host, or null if the URL was malformed (still a finding). */
  host: string | null;
  /** 0-indexed character offset into the original input. */
  index: number;
  /** Short reason for the rejection. */
  reason: "non-tenant-host" | "malformed-url" | "non-http-protocol";
}

export interface LinkHostResult {
  ok: boolean;
  findings: LinkHostFinding[];
}

/**
 * Inputs sanitised on construction:
 *   - Tenant domain stripped of protocol, port, and trailing slash.
 *   - Lowercased for comparison.
 */
function normaliseTenantDomain(raw: string): string {
  let d = raw.trim().toLowerCase();
  // Strip protocol if someone passed a URL.
  d = d.replace(/^https?:\/\//, "");
  // Strip a leading "www." — the policy is about the tenant's domain
  // boundary, and `www.doggo.com.au` and `doggo.com.au` are the same site.
  d = d.replace(/^www\./, "");
  // Strip path / port / query / fragment if any.
  d = d.split("/")[0].split(":")[0].split("?")[0].split("#")[0];
  return d;
}

function hostAllowed(host: string | null, tenantDomain: string): boolean {
  if (!host) return false;
  const h = host.toLowerCase().replace(/^www\./, "");
  if (h === tenantDomain) return true;
  // Subdomain: must end with `.tenantDomain` (not just contain it, to avoid
  // `tenant.com.au.evil.example` smuggling).
  if (h.endsWith("." + tenantDomain)) return true;
  return false;
}

/**
 * Mask spans we never want to scan: fenced code blocks and inline code.
 * Returns the input with those spans replaced by spaces so character
 * offsets stay aligned for the downstream regex sweeps.
 */
function maskCodeSpans(input: string): string {
  let out = input;
  // Fenced code blocks (``` … ```), non-greedy, multiline.
  out = out.replace(/```[\s\S]*?```/g, (m) => " ".repeat(m.length));
  // Inline code (`…`), non-greedy, single-line. Avoid escaped backticks.
  out = out.replace(/`[^`\n]*`/g, (m) => " ".repeat(m.length));
  return out;
}

function parseHost(href: string): { host: string | null; protocolOk: boolean } {
  // Reject obvious non-hyperlink protocols up front.
  // We allow http/https only. mailto:/tel: are filtered earlier as relative.
  const protoMatch = /^([a-z][a-z0-9+.\-]*):/i.exec(href);
  if (protoMatch) {
    const proto = protoMatch[1].toLowerCase();
    if (proto !== "http" && proto !== "https") {
      return { host: null, protocolOk: false };
    }
  }
  try {
    // URL needs a base for protocol-relative + path-only inputs, but here
    // we only call parseHost on inputs we've already classified as absolute.
    const u = new URL(href);
    return { host: u.hostname || null, protocolOk: true };
  } catch {
    return { host: null, protocolOk: true };
  }
}

function isRelativeOrNonNavigable(href: string): boolean {
  if (!href) return true;
  const h = href.trim();
  if (h === "" || h === "#" || h.startsWith("#")) return true;
  if (h.startsWith("/") && !h.startsWith("//")) return true; // /about — same origin
  if (h.startsWith("./") || h.startsWith("../")) return true;
  // Common non-navigable schemes.
  if (/^(mailto|tel|sms|javascript):/i.test(h)) return true;
  return false;
}

/**
 * Scan content for any hyperlink whose host is not the tenant's domain
 * (or a subdomain of it). Pure function. No throw — returns a result
 * with `ok=false` and the list of findings instead.
 */
export function validateOutputLinks(
  content: string,
  tenantDomain: string
): LinkHostResult {
  const findings: LinkHostFinding[] = [];
  if (typeof content !== "string" || content.length === 0) {
    return { ok: true, findings };
  }
  if (typeof tenantDomain !== "string" || tenantDomain.trim() === "") {
    // Defensive: a config-load failure should have caught this upstream.
    // We refuse to validate without a known tenant domain rather than
    // silently pass content through.
    throw new Error(
      "validateOutputLinks: tenantDomain is required and must be a non-empty string"
    );
  }

  const tenant = normaliseTenantDomain(tenantDomain);
  const masked = maskCodeSpans(content);

  const recordHref = (
    kind: LinkHostFinding["kind"],
    href: string,
    index: number
  ): void => {
    if (isRelativeOrNonNavigable(href)) return;
    // Protocol-relative URLs ("//host/path") — give them an https: base
    // so URL() can parse them.
    const probe = href.startsWith("//") ? "https:" + href : href;
    const { host, protocolOk } = parseHost(probe);
    if (!protocolOk) {
      findings.push({
        kind,
        href,
        host: null,
        index,
        reason: "non-http-protocol",
      });
      return;
    }
    if (!host) {
      findings.push({
        kind,
        href,
        host: null,
        index,
        reason: "malformed-url",
      });
      return;
    }
    if (!hostAllowed(host, tenant)) {
      findings.push({
        kind,
        href,
        host,
        index,
        reason: "non-tenant-host",
      });
    }
  };

  // ---- 1. Markdown links: [label](url) and [label](url "title") ----
  // Allow nested parens in label by being non-greedy, and tolerate
  // whitespace between `]` and `(`.
  const mdRe = /\[([^\]]*)\]\s*\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = mdRe.exec(masked)) !== null) {
    recordHref("markdown", m[2], m.index);
  }

  // ---- 2. HTML anchors: <a … href="…" …> (case-insensitive) ----
  const aRe = /<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>/gi;
  while ((m = aRe.exec(masked)) !== null) {
    const href = m[1] ?? m[2] ?? m[3] ?? "";
    recordHref("html-anchor", href, m.index);
  }

  // ---- 3. Bare URLs not inside the above (best-effort, low false-pos) ----
  // We do this on a doubly-masked variant where we ALSO blank out the spans
  // already matched as markdown/anchor links, so we don't double-count.
  let bareMasked = masked;
  // Re-run the same regexes to compute spans to mask.
  mdRe.lastIndex = 0;
  while ((m = mdRe.exec(masked)) !== null) {
    bareMasked =
      bareMasked.slice(0, m.index) +
      " ".repeat(m[0].length) +
      bareMasked.slice(m.index + m[0].length);
  }
  aRe.lastIndex = 0;
  while ((m = aRe.exec(masked)) !== null) {
    bareMasked =
      bareMasked.slice(0, m.index) +
      " ".repeat(m[0].length) +
      bareMasked.slice(m.index + m[0].length);
  }

  // Bare http(s) URL — stop at whitespace or common terminators.
  const bareRe = /\bhttps?:\/\/[^\s<>"'`)\]]+/gi;
  while ((m = bareRe.exec(bareMasked)) !== null) {
    // Trim trailing punctuation that typically isn't part of the URL.
    const raw = m[0].replace(/[.,;:!?]+$/, "");
    recordHref("bare-url", raw, m.index);
  }

  // Sort findings by offset for deterministic output.
  findings.sort((a, b) => a.index - b.index);

  return { ok: findings.length === 0, findings };
}
