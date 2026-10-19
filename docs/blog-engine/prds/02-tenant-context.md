# PRD 02 — Lean tenant onboarding, knowledge and voice

**Project:** Convo | **Product owner:** Cameron Beach | **Implementation:** Rory
**Status:** Build ready for local prototype under [shared contract](../README.md); proposed defaults, not production sign-off.
**Created / updated:** 2026-10-19 | **Risk:** Medium | **Effort:** M (planning estimate, validate during integration)
**Dependencies:** 01

## Context / Problem

**User:** A small-business tenant reviewer. A large settings surface is confusing, while missing approved business facts makes drafts generic or unreliable.

## Objective, key result and hypothesis

**Objective:** Collect the minimum strategy and grounded context needed for a useful article, using existing config/KB primitives.

**KR:** One synthetic tenant can complete required strategy in at most seven control groups; missing optional voice never blocks the manual demo. Baseline: existing configuration is not evaluated; target: first demo.

**Hypothesis:** Delivering this stage with explicit evidence and failure states makes the conversation-to-approved-content loop more reliable than direct transcript-to-prose generation. This is tested locally, not evidence of SEO rankings or customer demand.

## Scope and affected surfaces

tenant_seo_strategy; existing tenant settings and KB ingestion/retrieval; optional voice sample review.

This slice includes the functional behavior, data adapter, operator/reviewer states and applicable privacy controls below. Shared security, accessibility, lifecycle and artifact requirements are normative, not optional boilerplate. Existing marketing, billing, widget redesign and production deployment are excluded.

## Functional requirements

1. Expose only priority services, locations, audience, approved internal URLs, preferred CTAs, avoid topics/claims and optional voice samples; keep existing required account fields.
2. Validate approved origins and exact internal destinations; saving settings never enables a new publishing destination implicitly.
3. Retrieve tenant-owned KB evidence with source ID, passage and retrieval time. Preserve unknown service prices, guarantees and credentials as unknown.
4. Accept up to five tenant-owned voice samples by paste/manual ingestion for the demo; later crawl 3–5 approved HTTPS pages with fetch protections.
5. Extract stylistic guidance separately from facts; a tone example cannot prove a business claim. Handle conflicting or stale facts as review-required.
6. Version context snapshots; changing a fact, CTA or URL policy marks dependent artifacts stale and requires reevaluation.

## Data, migration and rollback

Extend existing strategy metadata via a typed versioned adapter. No copied production KB or background crawl on setup. Rollback ignores new optional fields and retains old strategy.

Every changed artifact references its exact inputs and schema/workflow version. Follow the [shared artifact contract](../README.md#shared-artifact-contract); no hidden process-memory-only state or unrelated schema redesign.

## UX, security and non-functional requirements

Use the existing dashboard/admin design language. Show empty, running, needs-input and failed states with an actionable next step. Apply membership/staff checks server-side, safe rendering, tenant-scoped evidence access and redacted logs. Meet the shared mobile/keyboard requirements on changed screens. External latency is displayed as work in progress, not a frozen page.

## Analytics and monitoring

tenant_strategy_saved, context_snapshot_created; versions and evidence counts only.

Record only observed values. During the first fixture session inspect failure rate, duplicate attempts and stale-artifact behavior; Cameron owns evaluation, Rory owns local fixes. Public SEO metadata is evaluated on final article/export only; internal review/admin screens remain authenticated and non-indexable.

## Pressure test

- **Riskiest assumption:** This slice improves useful approved output, not merely workflow complexity. Validate against the labelled synthetic cases before broadening scope.
- **Minimum viable cut:** Collect the minimum strategy and grounded context needed for a useful article, using existing config/KB primitives. Ship one-tenant manual path first; retain a second tenant only for isolation testing.
- **Counter-position:** Voice crawling can wait; manually supplied samples demonstrate whether style grounding helps.
- **Build versus research:** Existing repo primitives make local implementation justified; usefulness/approval targets remain experimental.
- **Opportunity cost:** No new marketing, bulk generation, multi-CMS publishing or AI visibility suite while validating the core loop.
- **Kill/pivot criterion:** If a draft cannot make a useful verified claim from the KB, return needs_input instead of compensating with generic or invented copy.
- **Why now:** Existing Convo artifacts and the October rebuild brief provide concrete inputs; old pipeline self-scoring and missing research are insufficient.
- **Halfway failure / plan B:** If fewer than half this slice’s acceptance cases pass midway through implementation, isolate the first failing boundary, use manual operator input where safe, and do not expand automation.

## Risks and mitigations

- **Product:** More stages can burden tenants; intermediate details remain in admin unless needed for a meaningful review decision.
- **Technical:** Legacy fields and stale JSON can contradict each other; use schema validation, current dependency digests and explicit incomplete states.
- **Privacy/security:** Source text may contain PII or hostile instructions; minimise before calls, treat source text as data, and test tenant boundaries.
- **SEO/editorial:** A complete artifact is not a ranking guarantee; judge usefulness and grounded claims, not keyword density.
- **Operational:** Failed external work may have side effects; retain attempts, distinguish uncertain outcomes and avoid blind retries.

## Acceptance criteria

- [ ] Tenant UI has no provider/model/prompt/SEO scoring settings. All seven control groups have save/validation behavior.
- [ ] A blank voice corpus generates neutral Australian English, with no invented awards, team size or superlatives.
- [ ] Tenant A cannot upload, retrieve or attach Tenant B evidence. Conflicting prices are surfaced, not silently chosen.
- [ ] Unsafe sample fetch URLs and non-approved CTA destinations are rejected before retrieval or rendering.

## Test and release plan

- **Local:** Check settings save/reload, wrong-tenant retrieval, empty samples, conflicting facts, invalid URLs and a 375 px keyboard-only settings pass.
- **Integration:** Run the relevant shared 12-case set against the exact integrated commit; record commands, outcomes and unverified behavior. Fixtures are synthetic and provider transport is mocked unless explicitly marked live.
- **Staging:** Before a customer pilot, Blake or a nominated engineering reviewer checks changed auth/data/connector behavior; Cameron checks the product outcome. This is a proposed review, not a notification sent.
- **Production smoke:** Not authorised or required for the local milestone. Any later rollout starts with one approved pilot tenant behind a default-off flag and validates actual destination output.
- **Monitoring:** Inspect the first completed fixture session, then the first three reviewed positive drafts; fix blocking gaps before enabling another stage/provider.
- **Release / rollback:** Deliver as a scoped PR after prerequisites, enable locally only, and revert the feature flag/adapter for rollback. Preserve audit history; no destructive cleanup of remote content.

## Out of scope and open questions

Out: production migration/deployment, automatic public publishing, unrelated product rebuilding and unbounded batch processing. Stage-specific exclusions follow the requirements above.

No unanswered question blocks the defined local slice. Cameron owns live pilot segment and monetary caps; engineering review owns production operational suitability. Required paid configuration or WordPress test credentials may block live smoke tests but never justify fabricating a successful result.
