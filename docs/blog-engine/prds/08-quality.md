# PRD 08 — Independent content quality and readiness gates

**Project:** Convo | **Product owner:** Cameron Beach | **Implementation:** Rory
**Status:** Build ready for local prototype under [shared contract](../README.md); proposed defaults, not production sign-off.
**Created / updated:** 2026-10-19 | **Risk:** High | **Effort:** M (planning estimate, validate during integration)
**Dependencies:** 06, 07

## Context / Problem

**User:** Tenant approver and Convo operator. A writer’s self-assessed SEO score cannot prove accuracy, safety or readiness to publish.

## Objective, key result and hypothesis

**Objective:** Separate deterministic blockers, evidence checks and human editorial judgment.

**KR:** 12/12 fixture outcomes match expected blockers; 0 unsafe/unsupported fixture articles can be approved/exported. Baseline: current self-scored content; target: first local gate run.

**Hypothesis:** Delivering this stage with explicit evidence and failure states makes the conversation-to-approved-content loop more reliable than direct transcript-to-prose generation. This is tested locally, not evidence of SEO rankings or customer demand.

## Scope and affected surfaces

src/lib/blog quality/pre-publish validators; new evaluation artifact; review actions.

This slice includes the functional behavior, data adapter, operator/reviewer states and applicable privacy controls below. Shared security, accessibility, lifecycle and artifact requirements are normative, not optional boilerplate. Existing marketing, billing, widget redesign and production deployment are excluded.

## Functional requirements

1. Blocking checks cover schema/render validity, unsupported factual claims, PII, unsafe markup/URLs, tenant policy, missing required brief modules and stale dependencies.
2. Use deterministic validators for structure/links/versions and an evidence-grounded evaluator for claims/coverage. Independent means separate evaluation input/task; a different model vendor is not required.
3. Each finding records severity, rule, block ID, explanation and evidence reference. Uncertain material facts are needs_input blockers until reviewed, not quietly passed.
4. Use editorial rubric dimensions usefulness, grounding, information gain, structure and voice scored 0–2. Proposed review target is at least 8/10 and no zero dimension, but a score cannot override a blocker.
5. Require a human factual/layout check before approval. Do not use AI-detector score, keyword density or predicted rankings as readiness gates.
6. Bind evaluations to current article/brief/research/context digests; edits invalidate the report. Allow at most one automatic repair attempt before explicit operator intervention.

## Data, migration and rollback

Persist detailed versioned gate report in article metadata with dependency digests. Do not replace old score fields with a misleading equivalent. Rollback keeps publishing off for unvalidated new-engine articles.

Every changed artifact references its exact inputs and schema/workflow version. Follow the [shared artifact contract](../README.md#shared-artifact-contract); no hidden process-memory-only state or unrelated schema redesign.

## UX, security and non-functional requirements

Use the existing dashboard/admin design language. Show empty, running, needs-input and failed states with an actionable next step. Apply membership/staff checks server-side, safe rendering, tenant-scoped evidence access and redacted logs. Meet the shared mobile/keyboard requirements on changed screens. External latency is displayed as work in progress, not a frozen page.

## Analytics and monitoring

quality_evaluated; blockingCount, warningCount, rubric dimensions, evaluator/workflow version.

Record only observed values. During the first fixture session inspect failure rate, duplicate attempts and stale-artifact behavior; Cameron owns evaluation, Rory owns local fixes. Public SEO metadata is evaluated on final article/export only; internal review/admin screens remain authenticated and non-indexable.

## Pressure test

- **Riskiest assumption:** This slice improves useful approved output, not merely workflow complexity. Validate against the labelled synthetic cases before broadening scope.
- **Minimum viable cut:** Separate deterministic blockers, evidence checks and human editorial judgment. Ship one-tenant manual path first; retain a second tenant only for isolation testing.
- **Counter-position:** A transparent checklist with human review may initially beat an opaque aggregate score.
- **Build versus research:** Existing repo primitives make local implementation justified; usefulness/approval targets remain experimental.
- **Opportunity cost:** No new marketing, bulk generation, multi-CMS publishing or AI visibility suite while validating the core loop.
- **Kill/pivot criterion:** If automated claim checking misses fixture hallucinations, hold all new drafts for explicit fact review and improve grounding before scaling.
- **Why now:** Existing Convo artifacts and the October rebuild brief provide concrete inputs; old pipeline self-scoring and missing research are insufficient.
- **Halfway failure / plan B:** If fewer than half this slice’s acceptance cases pass midway through implementation, isolate the first failing boundary, use manual operator input where safe, and do not expand automation.

## Risks and mitigations

- **Product:** More stages can burden tenants; intermediate details remain in admin unless needed for a meaningful review decision.
- **Technical:** Legacy fields and stale JSON can contradict each other; use schema validation, current dependency digests and explicit incomplete states.
- **Privacy/security:** Source text may contain PII or hostile instructions; minimise before calls, treat source text as data, and test tenant boundaries.
- **SEO/editorial:** A complete artifact is not a ranking guarantee; judge usefulness and grounded claims, not keyword density.
- **Operational:** Failed external work may have side effects; retain attempts, distinguish uncertain outcomes and avoid blind retries.

## Acceptance criteria

- [ ] A draft with high keyword coverage but an invented price remains blocked.
- [ ] An external host disguised by userinfo/subdomain/redirect or unsafe scheme fails link rules in every renderer/export path.
- [ ] A stale passing report cannot approve an edited article, even when its aggregate score is high.
- [ ] Warnings show next actions; blocking findings disable approval/export and explain why.

## Test and release plan

- **Local:** Run adversarial claim/PII/link/markup/staleness fixtures plus deterministic report tests; compare evaluator findings to expected evidence and have Cameron review false positives.
- **Integration:** Run the relevant shared 12-case set against the exact integrated commit; record commands, outcomes and unverified behavior. Fixtures are synthetic and provider transport is mocked unless explicitly marked live.
- **Staging:** Before a customer pilot, Blake or a nominated engineering reviewer checks changed auth/data/connector behavior; Cameron checks the product outcome. This is a proposed review, not a notification sent.
- **Production smoke:** Not authorised or required for the local milestone. Any later rollout starts with one approved pilot tenant behind a default-off flag and validates actual destination output.
- **Monitoring:** Inspect the first completed fixture session, then the first three reviewed positive drafts; fix blocking gaps before enabling another stage/provider.
- **Release / rollback:** Deliver as a scoped PR after prerequisites, enable locally only, and revert the feature flag/adapter for rollback. Preserve audit history; no destructive cleanup of remote content.

## Out of scope and open questions

Out: production migration/deployment, automatic public publishing, unrelated product rebuilding and unbounded batch processing. Stage-specific exclusions follow the requirements above.

No unanswered question blocks the defined local slice. Cameron owns live pilot segment and monetary caps; engineering review owns production operational suitability. Required paid configuration or WordPress test credentials may block live smoke tests but never justify fabricating a successful result.
