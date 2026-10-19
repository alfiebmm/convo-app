# PRD 01 — Local platform and Content Project lifecycle

**Project:** Convo | **Product owner:** Cameron Beach | **Implementation:** Rory
**Status:** Build ready for local prototype under [shared contract](../README.md); proposed defaults, not production sign-off.
**Created / updated:** 2026-10-19 | **Risk:** High | **Effort:** M (planning estimate, validate during integration)
**Dependencies:** none

## Context / Problem

**User:** Cameron operating the local prototype. Existing read-only project mapping cannot run or safely resume the workflow. Separate branches and legacy statuses can falsely imply completion.

## Objective, key result and hypothesis

**Objective:** Integrate the existing foundation branches into a dedicated local worktree with no production database access.

**KR:** All 12 acceptance fixtures retain stable project identity, correct stage state and tenant isolation after restart. Baseline: unverified read-only mapping; target: first integrated demo.

**Hypothesis:** Delivering this stage with explicit evidence and failure states makes the conversation-to-approved-content loop more reliable than direct transcript-to-prose generation. This is tested locally, not evidence of SEO rankings or customer demand.

## Scope and affected surfaces

src/lib/blog/content-projects/; existing Drizzle schema; server-side pipeline adapter; local env/seed runbook.

This slice includes the functional behavior, data adapter, operator/reviewer states and applicable privacy controls below. Shared security, accessibility, lifecycle and artifact requirements are normative, not optional boilerplate. Existing marketing, billing, widget redesign and production deployment are excluded.

## Functional requirements

1. Integrate PR #200 and #201 only after reviewing their actual diffs; keep marketing changes and current main checkout untouched.
2. Persist a stable project ID, versioned stage artifacts and run attempts through existing table adapters; rehydrating must not change IDs when the first blog row appears.
3. Enforce permitted transitions and missing-artifact indicators. Failure beats stale metadata; publishing is in progress, not success; draft alone is not review-ready.
4. Use expected-revision transactions and a durable stage idempotency key; concurrent identical requests produce one output with separate attempt logs.
5. Create synthetic demo tenant and second isolation tenant in a dedicated local/test DB. Seed Cameron’s allowlisted email and is_platform_staff flag locally; preserve real login and MFA.
6. Expose interrupted stages after restart. Re-run only the affected stage, invalidate descendants and preserve prior artifacts for comparison.

## Data, migration and rollback

Local bootstrap uses existing migrations only on a confirmed disposable DB. No broad backfill; legacy rows stay readable but explicitly incomplete. Revert feature flag/read adapter to restore old UI.

Every changed artifact references its exact inputs and schema/workflow version. Follow the [shared artifact contract](../README.md#shared-artifact-contract); no hidden process-memory-only state or unrelated schema redesign.

## UX, security and non-functional requirements

Use the existing dashboard/admin design language. Show empty, running, needs-input and failed states with an actionable next step. Apply membership/staff checks server-side, safe rendering, tenant-scoped evidence access and redacted logs. Meet the shared mobile/keyboard requirements on changed screens. External latency is displayed as work in progress, not a frozen page.

## Analytics and monitoring

foundation_stage_transition, stage_attempt_failed; record project/run/stage/revision and duration, no transcript.

Record only observed values. During the first fixture session inspect failure rate, duplicate attempts and stale-artifact behavior; Cameron owns evaluation, Rory owns local fixes. Public SEO metadata is evaluated on final article/export only; internal review/admin screens remain authenticated and non-indexable.

## Pressure test

- **Riskiest assumption:** This slice improves useful approved output, not merely workflow complexity. Validate against the labelled synthetic cases before broadening scope.
- **Minimum viable cut:** Integrate the existing foundation branches into a dedicated local worktree with no production database access. Ship one-tenant manual path first; retain a second tenant only for isolation testing.
- **Counter-position:** A DB-backed state adapter may be more than a demo needs; keep one sequential orchestrator, no new queue product.
- **Build versus research:** Existing repo primitives make local implementation justified; usefulness/approval targets remain experimental.
- **Opportunity cost:** No new marketing, bulk generation, multi-CMS publishing or AI visibility suite while validating the core loop.
- **Kill/pivot criterion:** If the existing JSON shapes cannot represent bounded revision history safely, stop the storage adapter slice and propose a small artifact migration rather than ad-hoc writes.
- **Why now:** Existing Convo artifacts and the October rebuild brief provide concrete inputs; old pipeline self-scoring and missing research are insufficient.
- **Halfway failure / plan B:** If fewer than half this slice’s acceptance cases pass midway through implementation, isolate the first failing boundary, use manual operator input where safe, and do not expand automation.

## Risks and mitigations

- **Product:** More stages can burden tenants; intermediate details remain in admin unless needed for a meaningful review decision.
- **Technical:** Legacy fields and stale JSON can contradict each other; use schema validation, current dependency digests and explicit incomplete states.
- **Privacy/security:** Source text may contain PII or hostile instructions; minimise before calls, treat source text as data, and test tenant boundaries.
- **SEO/editorial:** A complete artifact is not a ranking guarantee; judge usefulness and grounded claims, not keyword density.
- **Operational:** Failed external work may have side effects; retain attempts, distinguish uncertain outcomes and avoid blind retries.

## Acceptance criteria

- [ ] Unauthenticated and wrong-tenant project reads/writes are denied; database credentials are never returned to the client.
- [ ] Restart between research and brief restores the same ID and artifacts; two simultaneous run requests create one output.
- [ ] A publishing row remains in progress; a failed row with stale approved metadata remains failed; legacy drafts show incomplete checks.
- [ ] Local setup from clean checkout reaches authenticated dashboard and seeded tenant with documented commands, without touching production.

## Test and release plan

- **Local:** Use two-tenant integration fixtures plus restart/concurrency tests against a disposable database; verify fresh setup manually.
- **Integration:** Run the relevant shared 12-case set against the exact integrated commit; record commands, outcomes and unverified behavior. Fixtures are synthetic and provider transport is mocked unless explicitly marked live.
- **Staging:** Before a customer pilot, Blake or a nominated engineering reviewer checks changed auth/data/connector behavior; Cameron checks the product outcome. This is a proposed review, not a notification sent.
- **Production smoke:** Not authorised or required for the local milestone. Any later rollout starts with one approved pilot tenant behind a default-off flag and validates actual destination output.
- **Monitoring:** Inspect the first completed fixture session, then the first three reviewed positive drafts; fix blocking gaps before enabling another stage/provider.
- **Release / rollback:** Deliver as a scoped PR after prerequisites, enable locally only, and revert the feature flag/adapter for rollback. Preserve audit history; no destructive cleanup of remote content.

## Out of scope and open questions

Out: production migration/deployment, automatic public publishing, unrelated product rebuilding and unbounded batch processing. Stage-specific exclusions follow the requirements above.

No unanswered question blocks the defined local slice. Cameron owns live pilot segment and monetary caps; engineering review owns production operational suitability. Required paid configuration or WordPress test credentials may block live smoke tests but never justify fabricating a successful result.
