# PRD 10 — Admin lifecycle, artifacts and controlled retries

**Project:** Convo | **Product owner:** Cameron Beach | **Implementation:** Rory
**Status:** Build ready for local prototype under [shared contract](../README.md); proposed defaults, not production sign-off.
**Created / updated:** 2026-10-19 | **Risk:** Medium | **Effort:** M (planning estimate, validate during integration)
**Dependencies:** 01; consumes artifacts from 03–08 and 11

## Context / Problem

**User:** Cameron as local platform administrator. Invisible model/provider failures make the workflow expensive to debug and risky to rerun.

## Objective, key result and hypothesis

**Objective:** Reuse platform-admin to inspect each stage and retry exactly what failed.

**KR:** Every fixture failure displays stage/reason/next action; duplicate retry requests create at most one new stage output. Target: operator acceptance session; baseline: no integrated console.

**Hypothesis:** Delivering this stage with explicit evidence and failure states makes the conversation-to-approved-content loop more reliable than direct transcript-to-prose generation. This is tested locally, not evidence of SEO rankings or customer demand.

## Scope and affected surfaces

src/app/platform-admin; staff access/MFA; project adapter; audit log.

This slice includes the functional behavior, data adapter, operator/reviewer states and applicable privacy controls below. Shared security, accessibility, lifecycle and artifact requirements are normative, not optional boilerplate. Existing marketing, billing, widget redesign and production deployment are excluded.

## Functional requirements

1. Reuse existing platform-admin shell, allowlist, staff flag and MFA; seed cameronbeach1@gmail.com only in the local demo database.
2. List projects by tenant, stage, active attempt and terminal status. Display manual/live research, missing inputs, freshness and failure reason distinctly.
3. Detail view shows decision, redacted evidence, research provenance, brief, draft, information gain, gate findings, approval and export receipts.
4. Retry only allowed stages with expected revision, actor/reason and idempotency key; changing upstream output invalidates descendants and approval.
5. Do not allow retries to overwrite a published page or implicitly issue a second chargeable task. Ambiguous external outcomes require reconciliation first.
6. Log privileged actions and bounded failure diagnostics. Redact secrets, direct identifiers and full provider payloads from routine logs; show raw content only to authorised operators when necessary.

## Data, migration and rollback

Extend existing admin routes/audit conventions; no new staff auth system. Rollback removes new navigation/actions without deleting audit/artifacts.

Every changed artifact references its exact inputs and schema/workflow version. Follow the [shared artifact contract](../README.md#shared-artifact-contract); no hidden process-memory-only state or unrelated schema redesign.

## UX, security and non-functional requirements

Use the existing dashboard/admin design language. Show empty, running, needs-input and failed states with an actionable next step. Apply membership/staff checks server-side, safe rendering, tenant-scoped evidence access and redacted logs. Meet the shared mobile/keyboard requirements on changed screens. External latency is displayed as work in progress, not a frozen page.

## Analytics and monitoring

admin_project_viewed, admin_stage_retry_requested; actor/project/stage/reason/run IDs.

Record only observed values. During the first fixture session inspect failure rate, duplicate attempts and stale-artifact behavior; Cameron owns evaluation, Rory owns local fixes. Public SEO metadata is evaluated on final article/export only; internal review/admin screens remain authenticated and non-indexable.

## Pressure test

- **Riskiest assumption:** This slice improves useful approved output, not merely workflow complexity. Validate against the labelled synthetic cases before broadening scope.
- **Minimum viable cut:** Reuse platform-admin to inspect each stage and retry exactly what failed. Ship one-tenant manual path first; retain a second tenant only for isolation testing.
- **Counter-position:** Searchable artifacts and actionable errors matter more than a graph or elaborate operations dashboard.
- **Build versus research:** Existing repo primitives make local implementation justified; usefulness/approval targets remain experimental.
- **Opportunity cost:** No new marketing, bulk generation, multi-CMS publishing or AI visibility suite while validating the core loop.
- **Kill/pivot criterion:** If retry semantics are unclear, ship inspect-only first and add mutation controls after foundation concurrency checks pass.
- **Why now:** Existing Convo artifacts and the October rebuild brief provide concrete inputs; old pipeline self-scoring and missing research are insufficient.
- **Halfway failure / plan B:** If fewer than half this slice’s acceptance cases pass midway through implementation, isolate the first failing boundary, use manual operator input where safe, and do not expand automation.

## Risks and mitigations

- **Product:** More stages can burden tenants; intermediate details remain in admin unless needed for a meaningful review decision.
- **Technical:** Legacy fields and stale JSON can contradict each other; use schema validation, current dependency digests and explicit incomplete states.
- **Privacy/security:** Source text may contain PII or hostile instructions; minimise before calls, treat source text as data, and test tenant boundaries.
- **SEO/editorial:** A complete artifact is not a ranking guarantee; judge usefulness and grounded claims, not keyword density.
- **Operational:** Failed external work may have side effects; retain attempts, distinguish uncertain outcomes and avoid blind retries.

## Acceptance criteria

- [ ] Nonstaff and staff without completed MFA cannot read/admin-run a project. No development bypass is accepted in deployed builds.
- [ ] Provider timeout shows retry/manual fallback; insufficient evidence shows request-input, not blind retry.
- [ ] A repeated click or concurrent retry is deduplicated and audited; old outputs remain inspectable.
- [ ] Publishing in progress, WordPress draft created and publicly published are never presented as the same outcome.

## Test and release plan

- **Local:** Exercise one failure at each stage through the console; inspect access denial, audit entries, concurrent retries and credential redaction.
- **Integration:** Run the relevant shared 12-case set against the exact integrated commit; record commands, outcomes and unverified behavior. Fixtures are synthetic and provider transport is mocked unless explicitly marked live.
- **Staging:** Before a customer pilot, Blake or a nominated engineering reviewer checks changed auth/data/connector behavior; Cameron checks the product outcome. This is a proposed review, not a notification sent.
- **Production smoke:** Not authorised or required for the local milestone. Any later rollout starts with one approved pilot tenant behind a default-off flag and validates actual destination output.
- **Monitoring:** Inspect the first completed fixture session, then the first three reviewed positive drafts; fix blocking gaps before enabling another stage/provider.
- **Release / rollback:** Deliver as a scoped PR after prerequisites, enable locally only, and revert the feature flag/adapter for rollback. Preserve audit history; no destructive cleanup of remote content.

## Out of scope and open questions

Out: production migration/deployment, automatic public publishing, unrelated product rebuilding and unbounded batch processing. Stage-specific exclusions follow the requirements above.

No unanswered question blocks the defined local slice. Cameron owns live pilot segment and monetary caps; engineering review owns production operational suitability. Required paid configuration or WordPress test credentials may block live smoke tests but never justify fabricating a successful result.
