# CON-149 — Linking-policy audit (12 Jun 2026)

Audit prep for the two implementation tickets that will land Cam's 5 Jun lock-in:

> Generated content links **only** to `tenant.domain`. No third-party hyperlinks, ever. Knowledge synthesis may draw from any reputable source. No tenant-configurable toggle.
> Enforced via (a) prompt-level rules in `ARTICLE_PROMPT` + chatbot `GLOBAL_RULES`, (b) post-generation URL-host check.

This file documents the **as-is** state on `main` (HEAD as of this PR) so the implementation tickets carry concrete deltas, not abstract intent.

## Surface 1 — `ARTICLE_PROMPT` (content pipeline)

**File:** `src/lib/pipeline/generate-article.ts:21`

**Current state:** `ARTICLE_PROMPT` contains **zero linking guidance**. There is no clause forbidding non-tenant URLs, no "only link to {tenant.domain}", and no mention of invented URLs at all. The 22 Apr "AgPages URL whitelist + 'NEVER invent URLs'" fix recorded in `MEMORY.md` must have lived in a tenant-specific persona override, not the base prompt — and it is not reachable from this code path.

**Tenant domain is not passed to the prompt.** The `generateArticle()` signature takes `tenantId`, not the tenant record. Adding the linking rule requires loading the tenant row at call time and interpolating `tenant.domain` into the prompt.

**Required delta (ticket A):**

1. Load the tenant row in `generateArticle()` (or pass `tenant.domain` in via the call site — pipeline `process` route).
2. Add a hard-rule block at the top of `ARTICLE_PROMPT`:
   ```
   # HARD RULES — Linking
   - When linking, link ONLY to URLs on https://{tenant.domain} (or any subdomain).
   - Never link to any other domain. Never invent URLs. If you don't know the exact internal URL, use a relative path or no link at all.
   - You may draw on factual knowledge from any source. Do not cite or link to sources.
   ```
3. Invoke `validateOutputLinks()` (this PR) on the generated `body` and any other markdown fields. On finding(s): retry generation with a strengthened reminder (max 2 attempts), then fail the case with a structured error.
4. Add an acceptance fixture to the pipeline test harness that prompt-injects a "link to wikipedia for context" instruction and verifies the regenerator + validator reject it.

## Surface 2 — `GLOBAL_RULES` (chatbot)

**File:** `src/lib/guardrails.ts:141`

**Current state:** `GLOBAL_RULES` covers response length, clarifying questions, and CON-98 prompt-injection defence. **Zero linking guidance.** No URL rules, no hyperlink rules, no mention of tenant.domain.

**Tenant domain IS already available** in `buildSystemPrompt` (used at lines 216, 247) — it's interpolated into the persona block as `tenant.domain`. So the rule can be appended without a signature change.

**Required delta (ticket A, same ticket — they're one block):**

1. Append a "Linking" section to `GLOBAL_RULES`:
   ```
   ## Linking
   When linking, link only to URLs on https://{tenant.domain} (this tenant's own site, including subdomains). Never link to any other domain. Never invent URLs. Prefer a relative path (e.g. `/pricing`) or no link at all when the exact internal URL is unknown.
   You may draw on factual knowledge from any source, but do not cite or link to those sources in your reply.
   ```
   Note: `GLOBAL_RULES` is currently a const — needs to become a function `getGlobalRules(tenant)` (or be split into a static block + a per-tenant footer). Cleaner option: keep `GLOBAL_RULES` static and have `buildSystemPrompt` append the per-tenant linking clause after `GLOBAL_RULES` is included.
2. Invoke `validateOutputLinks()` (this PR) on the streamed response **before the final SSE flush**. The chat route streams via SSE in `/api/chat/route.ts`; the natural place is after the full response is accumulated for the leakage scan (existing pattern at `route.ts:427` calls `scanOutputForLeakage`). On finding(s): strip the offending anchor markup and replace with the link text, OR (cleaner) regenerate. Call-site decides; recommend strip-on-finalise as the first cut to keep latency predictable.

## Surface 3 — settings / config

No tenant setting today named anything like `internal_links_only`, `linking_policy`, `outbound_links_allowed`. Confirmed via:

```
$ grep -rE "links?_(only|allowed|policy)|outbound_link|allow_external" src/
# (no matches)
```

No removal needed — we're aligned by accident. The implementation tickets must NOT add a setting; the rule is hard-coded.

## Surface 4 — brand system / docs

`glasshouse/clients/convo/brand-system.md` is workspace-only (lives in my workspace, not the convo-app repo). Documentation pass is a workspace-write, not a code PR. Ticket B (acceptance test) covers it as a one-line "confirm no contradictory guidance" check.

## What this PR ships

- **`src/lib/guardrails/link-host.ts`** — the `validateOutputLinks(content, tenantDomain)` primitive. Pure function. 20 acceptance fixtures green (`npx tsx src/lib/guardrails/__tests__/link-host.test.ts`). NOT wired into either call site yet — wiring is ticket A.
- **`src/lib/guardrails/__tests__/link-host.test.ts`** — the spec. Matches the repo's existing tsx-runnable convention.
- **This document** — `docs/con-149-linking-policy-audit.md`. Carries the audit findings into the implementation tickets.

## What this PR does NOT do

- **Does not modify `ARTICLE_PROMPT` or `GLOBAL_RULES`.** Per SOUL.md ("prompt-engineering shifts on the chatbot's `GLOBAL_RULES` … options + trade-offs + recommendation to Blake. He decides."). Audit findings above are the recommendation; the actual prompt edits land under ticket A with Blake sign-off.
- **Does not wire the validator into `/api/chat` or `generateArticle`.** That's ticket A — the wiring + prompt edits must ship together so the policy is enforced end-to-end in one merge.
- **Does not add CI for the new tsx test.** Repo convention is hand-run; adding a CI step is a separate workflow change (could fold into the migrations-lint CI later if Blake/Cam want it).

## Suggested tickets

- **CON-XXX (A)** — "Linking policy: prompt edits + validator wiring". Owner: Cam (touches prompts + chat SSE path). Estimated 1-2 days.
- **CON-XXX (B)** — "Linking policy: acceptance fixtures + injection-resistance regression". Owner: me. Estimated 1 day, depends on A merging first.
