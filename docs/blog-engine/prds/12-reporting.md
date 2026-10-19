# PRD 12 — Workflow outcomes, cost and delivery evidence

**Project:** Convo | **Product owner:** Cameron Beach | **Implementation:** Rory
**Status:** Build ready for local prototype under [shared contract](../README.md); proposed defaults, not production sign-off.
**Created / updated:** 2026-10-19 | **Risk:** Medium | **Effort:** M (planning estimate, validate during integration)
**Dependencies:** 01, 11

## Context / Problem

**User:** Cameron evaluating whether Convo is worth piloting. Counting generated articles hides skips, editing effort, provider failures and unpublished exports.

## Objective, key result and hypothesis

**Objective:** Measure the local content loop honestly without building a ranking dashboard.

**KR:** After the fixture run, reconcile all 12 case outcomes and distinguish generated/approved/exported/WordPress-draft/public counts; unknown costs are never reported as zero. Baseline: no comparable fixture ledger.

**Hypothesis:** Delivering this stage with explicit evidence and failure states makes the conversation-to-approved-content loop more reliable than direct transcript-to-prose generation. This is tested locally, not evidence of SEO rankings or customer demand.

## Scope and affected surfaces

project/run event adapter; admin summary; artifact and publish receipt history.

This slice includes the functional behavior, data adapter, operator/reviewer states and applicable privacy controls below. Shared security, accessibility, lifecycle and artifact requirements are normative, not optional boilerplate. Existing marketing, billing, widget redesign and production deployment are excluded.

## Functional requirements

1. Record stage attempts, durations, observed usage/cost where supplied, mode and provider, workflow versions, failure reasons and review actions.
2. Count outcomes by stable project ID and revision so retries do not inflate production counts; show skips, needs-input and failures separately.
3. Distinguish approved, downloaded/exported, remote draft confirmed and live publication confirmed. No rankings, leads or traffic are inferred from generation.
4. Compare three positive fixture drafts with current pipeline baseline using the same synthetic inputs: factual edits, reviewer time, usefulness and layout problems.
5. Expose a lightweight admin summary and a downloadable evidence ledger with source artifact/run IDs, known/unknown spend and currency.
6. Keep future GSC/search visibility adapters possible using canonical URL, destination IDs, publish dates and content revisions. Do not implement new analytics credentials or AI visibility tracking.

## Data, migration and rollback

Use bounded structured event/audit metadata or current event store; do not add a warehouse. Retention remains local synthetic-only until pilot policy is agreed. Rollback hides summary while retaining audit history.

Every changed artifact references its exact inputs and schema/workflow version. Follow the [shared artifact contract](../README.md#shared-artifact-contract); no hidden process-memory-only state or unrelated schema redesign.

## UX, security and non-functional requirements

Use the existing dashboard/admin design language. Show empty, running, needs-input and failed states with an actionable next step. Apply membership/staff checks server-side, safe rendering, tenant-scoped evidence access and redacted logs. Meet the shared mobile/keyboard requirements on changed screens. External latency is displayed as work in progress, not a frozen page.

## Analytics and monitoring

prototype_evaluation_recorded; fixtureId, projectId, approval/export outcome, edit minutes, known/unknown cost.

Record only observed values. During the first fixture session inspect failure rate, duplicate attempts and stale-artifact behavior; Cameron owns evaluation, Rory owns local fixes. Public SEO metadata is evaluated on final article/export only; internal review/admin screens remain authenticated and non-indexable.

## Pressure test

- **Riskiest assumption:** This slice improves useful approved output, not merely workflow complexity. Validate against the labelled synthetic cases before broadening scope.
- **Minimum viable cut:** Measure the local content loop honestly without building a ranking dashboard. Ship one-tenant manual path first; retain a second tenant only for isolation testing.
- **Counter-position:** A spreadsheet-quality ledger answers the prototype decision more cheaply than a reporting product.
- **Build versus research:** Existing repo primitives make local implementation justified; usefulness/approval targets remain experimental.
- **Opportunity cost:** No new marketing, bulk generation, multi-CMS publishing or AI visibility suite while validating the core loop.
- **Kill/pivot criterion:** If the measurement burden exceeds reviewing three drafts, use a simple evidence ledger first and defer charts.
- **Why now:** Existing Convo artifacts and the October rebuild brief provide concrete inputs; old pipeline self-scoring and missing research are insufficient.
- **Halfway failure / plan B:** If fewer than half this slice’s acceptance cases pass midway through implementation, isolate the first failing boundary, use manual operator input where safe, and do not expand automation.

## Risks and mitigations

- **Product:** More stages can burden tenants; intermediate details remain in admin unless needed for a meaningful review decision.
- **Technical:** Legacy fields and stale JSON can contradict each other; use schema validation, current dependency digests and explicit incomplete states.
- **Privacy/security:** Source text may contain PII or hostile instructions; minimise before calls, treat source text as data, and test tenant boundaries.
- **SEO/editorial:** A complete artifact is not a ranking guarantee; judge usefulness and grounded claims, not keyword density.
- **Operational:** Failed external work may have side effects; retain attempts, distinguish uncertain outcomes and avoid blind retries.

## Acceptance criteria

- [ ] One failed attempt plus successful retry counts as one project and two attempts.
- [ ] Missing token/provider price data produces unknown cost and never a misleading $0 total.
- [ ] Manual fixtures and live provider runs can be filtered separately.
- [ ] Summary totals reconcile to project artifacts/receipts; full chat text and customer identifiers are absent from exported ledger.

## Test and release plan

- **Local:** Run ledger reconciliation on deterministic synthetic timestamps and retry cases, then manually compare the three baseline/new draft pairs. No traffic/retention claims from local fixtures.
- **Integration:** Run the relevant shared 12-case set against the exact integrated commit; record commands, outcomes and unverified behavior. Fixtures are synthetic and provider transport is mocked unless explicitly marked live.
- **Staging:** Before a customer pilot, Blake or a nominated engineering reviewer checks changed auth/data/connector behavior; Cameron checks the product outcome. This is a proposed review, not a notification sent.
- **Production smoke:** Not authorised or required for the local milestone. Any later rollout starts with one approved pilot tenant behind a default-off flag and validates actual destination output.
- **Monitoring:** Inspect the first completed fixture session, then the first three reviewed positive drafts; fix blocking gaps before enabling another stage/provider.
- **Release / rollback:** Deliver as a scoped PR after prerequisites, enable locally only, and revert the feature flag/adapter for rollback. Preserve audit history; no destructive cleanup of remote content.

## Out of scope and open questions

Out: production migration/deployment, automatic public publishing, unrelated product rebuilding and unbounded batch processing. Stage-specific exclusions follow the requirements above.

No unanswered question blocks the defined local slice. Cameron owns live pilot segment and monetary caps; engineering review owns production operational suitability. Required paid configuration or WordPress test credentials may block live smoke tests but never justify fabricating a successful result.
