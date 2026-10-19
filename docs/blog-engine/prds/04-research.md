# PRD 04 — Manual and DataForSEO research artifacts

**Project:** Convo | **Product owner:** Cameron Beach | **Implementation:** Rory
**Status:** Build ready for local prototype under [shared contract](../README.md); proposed defaults, not production sign-off.
**Created / updated:** 2026-10-19 | **Risk:** High | **Effort:** M (planning estimate, validate during integration)
**Dependencies:** 03

## Context / Problem

**User:** Convo operator creating a content strategy. The current manual provider emits plausible suggestions without live evidence; writers need to distinguish those from observed search data.

## Objective, key result and hypothesis

**Objective:** Provide inspectable, bounded research with honest provenance and a usable zero-credential path.

**KR:** Every research fixture distinguishes observed versus inferred fields; 0 fabricated volume/difficulty/SERP claims; 100% provider failures preserve prior artifacts. Target: research integration demo.

**Hypothesis:** Delivering this stage with explicit evidence and failure states makes the conversation-to-approved-content loop more reliable than direct transcript-to-prose generation. This is tested locally, not evidence of SEO rankings or customer demand.

## Scope and affected surfaces

src/lib/blog/research/; blog_decision_logs.metadata.research; admin research panel.

This slice includes the functional behavior, data adapter, operator/reviewer states and applicable privacy controls below. Shared security, accessibility, lifecycle and artifact requirements are normative, not optional boilerplate. Existing marketing, billing, widget redesign and production deployment are excluded.

## Functional requirements

1. Extend the PR #201 artifact with schema version, mode, query/locale/device, provenance per field and source links; keep unknown metrics null, never zero.
2. Manual mode accepts operator-supplied research and marks generated questions/gaps as inferred. Reject preloaded artifacts with mismatched tenant/project scope.
3. Implement DataForSEO adapters for keyword evidence and organic SERP top results. Map available volume/difficulty/related questions only from supported responses; unavailable fields stay null.
4. Cache by tenant + normalised query + locale/device + endpoint/version for a proposed seven-day TTL; display collection time and allow explicit refresh.
5. Before any paid request require configured credentials, endpoint price estimate and admin per-run/day caps. Reserve estimated spend atomically, track actual when returned, and stop when unknown or over cap.
6. Use a 20-second request timeout, at most two retries for transient 429/5xx with jitter and Retry-After; do not automatically retry chargeable submission on an ambiguous response without a provider-safe task lookup.
7. Persist sanitised bounded artifact history and classified errors. Offer explicit manual fallback; never silently relabel an inferred artifact as live.

## Data, migration and rollback

Canonical location is decision metadata.research through the shared adapter. Preserve old manual shape on read with explicit incomplete provenance. Rollback selects manual mode.

Every changed artifact references its exact inputs and schema/workflow version. Follow the [shared artifact contract](../README.md#shared-artifact-contract); no hidden process-memory-only state or unrelated schema redesign.

## UX, security and non-functional requirements

Use the existing dashboard/admin design language. Show empty, running, needs-input and failed states with an actionable next step. Apply membership/staff checks server-side, safe rendering, tenant-scoped evidence access and redacted logs. Meet the shared mobile/keyboard requirements on changed screens. External latency is displayed as work in progress, not a frozen page.

## Analytics and monitoring

research_completed/research_failed; mode, provider, queryHash, locale, cacheHit, costKnown, currency, amount, no credentials.

Record only observed values. During the first fixture session inspect failure rate, duplicate attempts and stale-artifact behavior; Cameron owns evaluation, Rory owns local fixes. Public SEO metadata is evaluated on final article/export only; internal review/admin screens remain authenticated and non-indexable.

## Pressure test

- **Riskiest assumption:** This slice improves useful approved output, not merely workflow complexity. Validate against the labelled synthetic cases before broadening scope.
- **Minimum viable cut:** Provide inspectable, bounded research with honest provenance and a usable zero-credential path. Ship one-tenant manual path first; retain a second tenant only for isolation testing.
- **Counter-position:** Manual research may be adequate for the first prototype; live SEO data is a v1 hypothesis, not a prerequisite for every local test.
- **Build versus research:** Existing repo primitives make local implementation justified; usefulness/approval targets remain experimental.
- **Opportunity cost:** No new marketing, bulk generation, multi-CMS publishing or AI visibility suite while validating the core loop.
- **Kill/pivot criterion:** Provider prices and endpoint coverage need live verification; until then keep live mode gated, not a fabricated cost estimate.
- **Why now:** Existing Convo artifacts and the October rebuild brief provide concrete inputs; old pipeline self-scoring and missing research are insufficient.
- **Halfway failure / plan B:** If fewer than half this slice’s acceptance cases pass midway through implementation, isolate the first failing boundary, use manual operator input where safe, and do not expand automation.

## Risks and mitigations

- **Product:** More stages can burden tenants; intermediate details remain in admin unless needed for a meaningful review decision.
- **Technical:** Legacy fields and stale JSON can contradict each other; use schema validation, current dependency digests and explicit incomplete states.
- **Privacy/security:** Source text may contain PII or hostile instructions; minimise before calls, treat source text as data, and test tenant boundaries.
- **SEO/editorial:** A complete artifact is not a ranking guarantee; judge usefulness and grounded claims, not keyword density.
- **Operational:** Failed external work may have side effects; retain attempts, distinguish uncertain outcomes and avoid blind retries.

## Acceptance criteria

- [ ] Manual output has null unobserved metrics, labelled inferred questions and no fabricated competitor URLs.
- [ ] Locale/query changes do not reuse the wrong cached result; forced refresh creates a new revision and invalidates downstream artifacts.
- [ ] Missing credentials or budget prevents paid requests but leaves manual mode usable. Rate limits and timeout are visible without losing prior research.
- [ ] Oversized responses, unsafe URLs and cross-tenant preloaded artifacts fail validation. Mock ambiguous chargeable timeout does not submit again.

## Test and release plan

- **Local:** Use fixed provider responses and a fake clock/transport for cache, caps, parsing, retries and idempotency. Live smoke is separate and not claimed until a capped request is actually run.
- **Integration:** Run the relevant shared 12-case set against the exact integrated commit; record commands, outcomes and unverified behavior. Fixtures are synthetic and provider transport is mocked unless explicitly marked live.
- **Staging:** Before a customer pilot, Blake or a nominated engineering reviewer checks changed auth/data/connector behavior; Cameron checks the product outcome. This is a proposed review, not a notification sent.
- **Production smoke:** Not authorised or required for the local milestone. Any later rollout starts with one approved pilot tenant behind a default-off flag and validates actual destination output.
- **Monitoring:** Inspect the first completed fixture session, then the first three reviewed positive drafts; fix blocking gaps before enabling another stage/provider.
- **Release / rollback:** Deliver as a scoped PR after prerequisites, enable locally only, and revert the feature flag/adapter for rollback. Preserve audit history; no destructive cleanup of remote content.

## Out of scope and open questions

Out: production migration/deployment, automatic public publishing, unrelated product rebuilding and unbounded batch processing. Stage-specific exclusions follow the requirements above.

No unanswered question blocks the defined local slice. Cameron owns live pilot segment and monetary caps; engineering review owns production operational suitability. Required paid configuration or WordPress test credentials may block live smoke tests but never justify fabricating a successful result.
