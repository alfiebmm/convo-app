# PRD 11 — Approved HTML/Markdown export and WordPress drafts

**Project:** Convo | **Product owner:** Cameron Beach | **Implementation:** Rory
**Status:** Build ready for local prototype under [shared contract](../README.md); proposed defaults, not production sign-off.
**Created / updated:** 2026-10-19 | **Risk:** High | **Effort:** M (planning estimate, validate during integration)
**Dependencies:** 08, 09

## Context / Problem

**User:** Tenant approving content and Convo operator verifying delivery. A successful HTTP attempt does not prove correct content arrived, and retries may create duplicate posts.

## Objective, key result and hypothesis

**Objective:** Export the approved article consistently and create a traceable WordPress draft without public publication.

**KR:** 3/3 positive exports match approved revision; repeated submission creates one destination draft; 0 public posts are created. Baseline: new renderer/export path unverified; target: publishing demo.

**Hypothesis:** Delivering this stage with explicit evidence and failure states makes the conversation-to-approved-content loop more reliable than direct transcript-to-prose generation. This is tested locally, not evidence of SEO rankings or customer demand.

## Scope and affected surfaces

existing WordPress connector/settings; shared renderer; export action; publish receipt storage.

This slice includes the functional behavior, data adapter, operator/reviewer states and applicable privacy controls below. Shared security, accessibility, lifecycle and artifact requirements are normative, not optional boilerplate. Existing marketing, billing, widget redesign and production deployment are excluded.

## Functional requirements

1. Before export or connector call recheck tenant access, approval digest, current gate report, allowed destination and content revision in one consistent snapshot.
2. Render HTML and Markdown from the approved canonical model; include safe metadata and schema suggestions, not active scripts or fabricated schema claims.
3. WordPress calls create status=draft only. Store destination site/post ID, URL, status, content digest, request key and confirmed response time; distinguish exported from live published.
4. Use approved HTTPS WordPress destination and encrypted server-side credentials; prevent private-network/redirect host escape. Destination API credentials are never embedded in generated files.
5. Create a durable publish attempt before sending. On timeout after possible creation, reconcile by stored destination ID or provider-safe idempotency marker before any resend; if uncertain, hold for operator verification.
6. A repeat approved revision returns its receipt rather than creating another post. Changed content needs reapproval and an explicit update/create choice; no automatic overwrite of live content.
7. If the pilot theme alters layout, show a destination preview and record the mismatch; do not claim WordPress visual fidelity from Convo preview alone.

## Data, migration and rollback

Reuse connector and draft/publish history with typed receipt metadata. Rollback disables connector/export feature; do not automatically delete remote drafts or published content.

Every changed artifact references its exact inputs and schema/workflow version. Follow the [shared artifact contract](../README.md#shared-artifact-contract); no hidden process-memory-only state or unrelated schema redesign.

## UX, security and non-functional requirements

Use the existing dashboard/admin design language. Show empty, running, needs-input and failed states with an actionable next step. Apply membership/staff checks server-side, safe rendering, tenant-scoped evidence access and redacted logs. Meet the shared mobile/keyboard requirements on changed screens. External latency is displayed as work in progress, not a frozen page.

## Analytics and monitoring

export_completed, wordpress_attempted/confirmed/reconciliation_required; destination ID/status, digest and duration, no credentials.

Record only observed values. During the first fixture session inspect failure rate, duplicate attempts and stale-artifact behavior; Cameron owns evaluation, Rory owns local fixes. Public SEO metadata is evaluated on final article/export only; internal review/admin screens remain authenticated and non-indexable.

## Pressure test

- **Riskiest assumption:** This slice improves useful approved output, not merely workflow complexity. Validate against the labelled synthetic cases before broadening scope.
- **Minimum viable cut:** Export the approved article consistently and create a traceable WordPress draft without public publication. Ship one-tenant manual path first; retain a second tenant only for isolation testing.
- **Counter-position:** Downloadable HTML is a valid first local milestone if test-site credentials are unavailable.
- **Build versus research:** Existing repo primitives make local implementation justified; usefulness/approval targets remain experimental.
- **Opportunity cost:** No new marketing, bulk generation, multi-CMS publishing or AI visibility suite while validating the core loop.
- **Kill/pivot criterion:** WordPress has no generic guaranteed idempotency; hold uncertain attempts rather than promising exactly-once behavior across network failure.
- **Why now:** Existing Convo artifacts and the October rebuild brief provide concrete inputs; old pipeline self-scoring and missing research are insufficient.
- **Halfway failure / plan B:** If fewer than half this slice’s acceptance cases pass midway through implementation, isolate the first failing boundary, use manual operator input where safe, and do not expand automation.

## Risks and mitigations

- **Product:** More stages can burden tenants; intermediate details remain in admin unless needed for a meaningful review decision.
- **Technical:** Legacy fields and stale JSON can contradict each other; use schema validation, current dependency digests and explicit incomplete states.
- **Privacy/security:** Source text may contain PII or hostile instructions; minimise before calls, treat source text as data, and test tenant boundaries.
- **SEO/editorial:** A complete artifact is not a ranking guarantee; judge usefulness and grounded claims, not keyword density.
- **Operational:** Failed external work may have side effects; retain attempts, distinguish uncertain outcomes and avoid blind retries.

## Acceptance criteria

- [ ] HTML/Markdown files reflect the same approved text, modules and destinations as the preview.
- [ ] Missing approval, edited content or failed gate blocks export and WordPress calls server-side.
- [ ] Mock timeout-after-create followed by retry results in one draft or held reconciliation, never an unconditional second POST.
- [ ] A test WordPress response is recorded as draft sent, not public success; rollback requires an explicit operator action.

## Test and release plan

- **Local:** Check renderer/export fixtures and mocked connector success/401/429/ambiguous timeout. A real test-site draft and visual inspection are separate live checks and must be labelled unverified until run.
- **Integration:** Run the relevant shared 12-case set against the exact integrated commit; record commands, outcomes and unverified behavior. Fixtures are synthetic and provider transport is mocked unless explicitly marked live.
- **Staging:** Before a customer pilot, Blake or a nominated engineering reviewer checks changed auth/data/connector behavior; Cameron checks the product outcome. This is a proposed review, not a notification sent.
- **Production smoke:** Not authorised or required for the local milestone. Any later rollout starts with one approved pilot tenant behind a default-off flag and validates actual destination output.
- **Monitoring:** Inspect the first completed fixture session, then the first three reviewed positive drafts; fix blocking gaps before enabling another stage/provider.
- **Release / rollback:** Deliver as a scoped PR after prerequisites, enable locally only, and revert the feature flag/adapter for rollback. Preserve audit history; no destructive cleanup of remote content.

## Out of scope and open questions

Out: production migration/deployment, automatic public publishing, unrelated product rebuilding and unbounded batch processing. Stage-specific exclusions follow the requirements above.

No unanswered question blocks the defined local slice. Cameron owns live pilot segment and monetary caps; engineering review owns production operational suitability. Required paid configuration or WordPress test credentials may block live smoke tests but never justify fabricating a successful result.
