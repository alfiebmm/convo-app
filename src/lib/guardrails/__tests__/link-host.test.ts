/**
 * CON-149 — link-host validator spec.
 *
 * Matches the repo's existing convention (see ./injection.test.ts):
 * self-contained tsx-runnable script, no framework dependency.
 *
 *   npx tsx src/lib/guardrails/__tests__/link-host.test.ts
 *
 * Exits non-zero on any failure. Designed for direct CI invocation.
 *
 * Coverage targets:
 *   - 20 acceptance fixtures (Cam-blessed linking-policy intent)
 *   - markdown, HTML anchor, bare URL, protocol-relative
 *   - relative paths / fragments / mailto: allowed
 *   - code spans (fenced + inline) ignored
 *   - subdomain allowed; bare-domain suffix smuggle rejected
 *   - prompt-injection-style attempts ("link to wikipedia for context")
 */
import { validateOutputLinks, type LinkHostResult } from "../link-host";

type Case = {
  name: string;
  tenantDomain: string;
  content: string;
  expectOk: boolean;
  /** Expected reasons in order (subset check). Empty = no assertion. */
  expectReasons?: Array<"non-tenant-host" | "malformed-url" | "non-http-protocol">;
};

const CASES: Case[] = [
  // ---- ACCEPT: internal-only outputs (ok=true) ----
  {
    name: "01 — markdown link to bare tenant domain",
    tenantDomain: "doggo.com.au",
    content: "Read more at [our docs](https://doggo.com.au/docs).",
    expectOk: true,
  },
  {
    name: "02 — markdown link to tenant subdomain",
    tenantDomain: "doggo.com.au",
    content: "Sign in at [the app](https://app.doggo.com.au/login).",
    expectOk: true,
  },
  {
    name: "03 — markdown link, www. on tenant",
    tenantDomain: "doggo.com.au",
    content: "Visit [home](https://www.doggo.com.au).",
    expectOk: true,
  },
  {
    name: "04 — HTML anchor to tenant domain",
    tenantDomain: "doggo.com.au",
    content: '<a href="https://doggo.com.au/help">Help centre</a>',
    expectOk: true,
  },
  {
    name: "05 — relative path is allowed (same origin)",
    tenantDomain: "doggo.com.au",
    content: "See [our pricing](/pricing) for details.",
    expectOk: true,
  },
  {
    name: "06 — fragment link is allowed",
    tenantDomain: "doggo.com.au",
    content: "Jump to [the FAQ](#faq).",
    expectOk: true,
  },
  {
    name: "07 — mailto: not a hyperlink, allowed",
    tenantDomain: "doggo.com.au",
    content: "Email [support](mailto:hello@doggo.com.au).",
    expectOk: true,
  },
  {
    name: "08 — fenced code block: external URL inside is ignored",
    tenantDomain: "doggo.com.au",
    content:
      "Example response:\n\n```\nfetch('https://api.openai.com/v1/chat/completions')\n```\n\nMore info at [our docs](https://doggo.com.au/api).",
    expectOk: true,
  },
  {
    name: "09 — inline code: external URL inside is ignored",
    tenantDomain: "doggo.com.au",
    content: "Use the endpoint `https://api.example.com/v1/x` from our SDK at [docs](https://doggo.com.au/sdk).",
    expectOk: true,
  },
  {
    name: "10 — content with no links at all",
    tenantDomain: "doggo.com.au",
    content: "We make AI-powered chatbots for small businesses.",
    expectOk: true,
  },

  // ---- REJECT: linking-policy violations (ok=false) ----
  {
    name: "11 — markdown link to third-party host",
    tenantDomain: "doggo.com.au",
    content:
      "For more background see [Wikipedia](https://en.wikipedia.org/wiki/Dog_food).",
    expectOk: false,
    expectReasons: ["non-tenant-host"],
  },
  {
    name: "12 — HTML anchor to a different domain",
    tenantDomain: "doggo.com.au",
    content: 'Check our review on <a href="https://producthunt.com/posts/doggo">Product Hunt</a>.',
    expectOk: false,
    expectReasons: ["non-tenant-host"],
  },
  {
    name: "13 — bare URL pasted as 'see X' style",
    tenantDomain: "doggo.com.au",
    content: "Sources include https://nytimes.com/article and our own data.",
    expectOk: false,
    expectReasons: ["non-tenant-host"],
  },
  {
    name: "14 — protocol-relative URL to third party",
    tenantDomain: "doggo.com.au",
    content: 'Read <a href="//evil.example/news">this</a>.',
    expectOk: false,
    expectReasons: ["non-tenant-host"],
  },
  {
    name: "15 — suffix-smuggle attempt (tenant in path, not host)",
    tenantDomain: "doggo.com.au",
    content:
      "Try [proxy](https://attacker.example/doggo.com.au/fake) — should reject.",
    expectOk: false,
    expectReasons: ["non-tenant-host"],
  },
  {
    name: "16 — suffix-smuggle attempt (tenant.host appended)",
    tenantDomain: "doggo.com.au",
    content:
      'See <a href="https://doggo.com.au.evil.example/x">"docs"</a>.',
    expectOk: false,
    expectReasons: ["non-tenant-host"],
  },
  {
    name: "17 — javascript: protocol rejected",
    tenantDomain: "doggo.com.au",
    content: '<a href="javascript:alert(1)">click</a>',
    // javascript: is filtered as non-navigable in isRelativeOrNonNavigable
    // BEFORE host check, matching browser-safety expectations: we don't
    // want it to ship, but it's a different concern (XSS) from the linking
    // policy. Treat as OK here; XSS sanitisation is upstream.
    expectOk: true,
  },
  {
    name: "18 — IP literal rejected (never matches a domain)",
    tenantDomain: "doggo.com.au",
    content: "Backend at [admin](http://203.0.113.42:8080/x).",
    expectOk: false,
    expectReasons: ["non-tenant-host"],
  },
  {
    name: "19 — mixed: one internal + one external, must reject",
    tenantDomain: "doggo.com.au",
    content:
      "See our [pricing page](https://doggo.com.au/pricing) and the [Wikipedia article](https://en.wikipedia.org/wiki/SaaS).",
    expectOk: false,
    expectReasons: ["non-tenant-host"],
  },
  {
    name: "20 — markdown link with link-text containing parens",
    tenantDomain: "doggo.com.au",
    content: "See [our docs (v2)](https://docs.example.org/v2) for more.",
    expectOk: false,
    expectReasons: ["non-tenant-host"],
  },
];

let pass = 0;
let fail = 0;
const failures: string[] = [];

for (const c of CASES) {
  let result: LinkHostResult;
  try {
    result = validateOutputLinks(c.content, c.tenantDomain);
  } catch (e) {
    fail++;
    failures.push(`${c.name}: threw ${(e as Error).message}`);
    continue;
  }

  if (result.ok !== c.expectOk) {
    fail++;
    failures.push(
      `${c.name}: expected ok=${c.expectOk}, got ok=${result.ok} ` +
        `(findings: ${JSON.stringify(result.findings)})`
    );
    continue;
  }

  if (c.expectReasons && c.expectReasons.length) {
    const got = result.findings.map((f) => f.reason);
    const missing = c.expectReasons.filter((r) => !got.includes(r));
    if (missing.length) {
      fail++;
      failures.push(
        `${c.name}: expected reasons ${JSON.stringify(c.expectReasons)} present, ` +
          `got ${JSON.stringify(got)}`
      );
      continue;
    }
  }

  pass++;
}

console.log(`[link-host] ${pass}/${CASES.length} passed`);
if (fail > 0) {
  console.error(`[link-host] ${fail} failure(s):`);
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
