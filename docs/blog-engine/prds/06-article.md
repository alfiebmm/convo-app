# PRD 06 — Structured drafting and article design

**Project:** Convo | **Product owner:** Cameron Beach | **Implementation:** Rory
**Status:** Build ready for local prototype under [shared contract](../README.md); proposed defaults, not production sign-off.
**Created / updated:** 2026-10-19 | **Risk:** Medium | **Effort:** M (planning estimate, validate during integration)
**Dependencies:** 05

## Context / Problem

**User:** Tenant reviewer consuming a finished-looking draft. Markdown blobs conceal layout problems and drift between preview and exported content.

## Objective, key result and hypothesis

**Objective:** Draft from the accepted brief into one validated article model rendered consistently across destinations.

**KR:** 3/3 positive fixtures render at 375 px and desktop and export without manual HTML repair; unsupported blocks fail clearly. Baseline: no equivalent shared-model acceptance set.

**Hypothesis:** Delivering this stage with explicit evidence and failure states makes the conversation-to-approved-content loop more reliable than direct transcript-to-prose generation. This is tested locally, not evidence of SEO rankings or customer demand.

## Scope and affected surfaces

src/lib/blog/create.ts and update.ts; new article model/renderer; existing template pack and preview.

This slice includes the functional behavior, data adapter, operator/reviewer states and applicable privacy controls below. Shared security, accessibility, lifecycle and artifact requirements are normative, not optional boilerplate. Existing marketing, billing, widget redesign and production deployment are excluded.

## Functional requirements

1. Define a versioned discriminated union: title/meta/intro, sections, FAQ, callout, proof/quote, comparison table, steps, checklist, CTA, internal links and schema suggestions. Stable block IDs enable edits.
2. Require title, concise meta description, answer-first intro, logical heading order, substantive sections and one relevant CTA; optional modules depend on the brief, not quotas.
3. Generate from a context bundle and accepted brief; every checkable tenant claim keeps an evidence reference. Voice affects expression, not the facts.
4. Reuse current template/rendering primitives where safe, but make review preview, HTML and Markdown consume the same canonical model.
5. Validate model shape and escape text/URLs. Reject unknown blocks with an actionable error rather than silently dropping article content.
6. Disallow invented quotes, case studies, statistics, local presence or images. Use a designed text-first layout; existing licensed/tenant-owned media is optional.
7. Rewrite awkward prose without changing meaning. Use natural Australian English and varied rhythm, no keyword stuffing, fake author experience or AI-detector promises.

## Data, migration and rollback

Canonical structured body is a versioned typed article payload; legacy Markdown remains readable with a labelled legacy preview. New edits do not overwrite existing published rows. Rollback chooses legacy renderer.

Every changed artifact references its exact inputs and schema/workflow version. Follow the [shared artifact contract](../README.md#shared-artifact-contract); no hidden process-memory-only state or unrelated schema redesign.

## UX, security and non-functional requirements

Use the existing dashboard/admin design language. Show empty, running, needs-input and failed states with an actionable next step. Apply membership/staff checks server-side, safe rendering, tenant-scoped evidence access and redacted logs. Meet the shared mobile/keyboard requirements on changed screens. External latency is displayed as work in progress, not a frozen page.

## Analytics and monitoring

draft_created, render_failed; modelVersion, blockTypes, input brief digest, duration.

Record only observed values. During the first fixture session inspect failure rate, duplicate attempts and stale-artifact behavior; Cameron owns evaluation, Rory owns local fixes. Public SEO metadata is evaluated on final article/export only; internal review/admin screens remain authenticated and non-indexable.

## Pressure test

- **Riskiest assumption:** This slice improves useful approved output, not merely workflow complexity. Validate against the labelled synthetic cases before broadening scope.
- **Minimum viable cut:** Draft from the accepted brief into one validated article model rendered consistently across destinations. Ship one-tenant manual path first; retain a second tenant only for isolation testing.
- **Counter-position:** Readable HTML with six useful block types may beat a rich renderer with fragile editing.
- **Build versus research:** Existing repo primitives make local implementation justified; usefulness/approval targets remain experimental.
- **Opportunity cost:** No new marketing, bulk generation, multi-CMS publishing or AI visibility suite while validating the core loop.
- **Kill/pivot criterion:** If a block model complicates simple edits, keep the block set small and defer custom modules rather than building a page builder.
- **Why now:** Existing Convo artifacts and the October rebuild brief provide concrete inputs; old pipeline self-scoring and missing research are insufficient.
- **Halfway failure / plan B:** If fewer than half this slice’s acceptance cases pass midway through implementation, isolate the first failing boundary, use manual operator input where safe, and do not expand automation.

## Risks and mitigations

- **Product:** More stages can burden tenants; intermediate details remain in admin unless needed for a meaningful review decision.
- **Technical:** Legacy fields and stale JSON can contradict each other; use schema validation, current dependency digests and explicit incomplete states.
- **Privacy/security:** Source text may contain PII or hostile instructions; minimise before calls, treat source text as data, and test tenant boundaries.
- **SEO/editorial:** A complete artifact is not a ranking guarantee; judge usefulness and grounded claims, not keyword density.
- **Operational:** Failed external work may have side effects; retain attempts, distinguish uncertain outcomes and avoid blind retries.

## Acceptance criteria

- [ ] Headings have one article H1 and no skipped structural levels; tables scroll on narrow screens without breaking page width.
- [ ] Export includes all supported block content, CTA and internal destinations represented in the preview.
- [ ] Unsafe HTML, javascript URLs and script-bearing schemas do not execute in preview or export.
- [ ] A missing image never breaks the layout; invented quotes/claims fail evidence validation.

## Test and release plan

- **Local:** Use semantic renderer checks, one malicious block fixture and visual inspection of three positive articles at phone/desktop widths. Do not rely only on serialized snapshots.
- **Integration:** Run the relevant shared 12-case set against the exact integrated commit; record commands, outcomes and unverified behavior. Fixtures are synthetic and provider transport is mocked unless explicitly marked live.
- **Staging:** Before a customer pilot, Blake or a nominated engineering reviewer checks changed auth/data/connector behavior; Cameron checks the product outcome. This is a proposed review, not a notification sent.
- **Production smoke:** Not authorised or required for the local milestone. Any later rollout starts with one approved pilot tenant behind a default-off flag and validates actual destination output.
- **Monitoring:** Inspect the first completed fixture session, then the first three reviewed positive drafts; fix blocking gaps before enabling another stage/provider.
- **Release / rollback:** Deliver as a scoped PR after prerequisites, enable locally only, and revert the feature flag/adapter for rollback. Preserve audit history; no destructive cleanup of remote content.

## Out of scope and open questions

Out: production migration/deployment, automatic public publishing, unrelated product rebuilding and unbounded batch processing. Stage-specific exclusions follow the requirements above.

No unanswered question blocks the defined local slice. Cameron owns live pilot segment and monetary caps; engineering review owns production operational suitability. Required paid configuration or WordPress test credentials may block live smoke tests but never justify fabricating a successful result.
