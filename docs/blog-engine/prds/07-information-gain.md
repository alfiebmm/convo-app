# PRD 07 — Conversation-led uniqueness and information gain

**Project:** Convo | **Product owner:** Cameron Beach | **Implementation:** Rory
**Status:** Build ready for local prototype under [shared contract](../README.md); proposed defaults, not production sign-off.
**Created / updated:** 2026-10-19 | **Risk:** Medium | **Effort:** M (planning estimate, validate during integration)
**Dependencies:** 05, 06

## Context / Problem

**User:** Tenant reviewer deciding whether an article adds genuine business value. Generic SEO copy can be accurate but interchangeable; rewriting rhythm cannot supply missing business insight.

## Objective, key result and hypothesis

**Objective:** Preserve useful tenant/customer specificity before and after drafting without fabricating originality.

**KR:** Every positive fixture with relevant source detail contains at least one verifiable differentiating detail; evidence-poor fixtures are held rather than padded. Target: first content evaluation.

**Hypothesis:** Delivering this stage with explicit evidence and failure states makes the conversation-to-approved-content loop more reliable than direct transcript-to-prose generation. This is tested locally, not evidence of SEO rankings or customer demand.

## Scope and affected surfaces

brief evidence map; article blocks; new information-gain artifact and review panel.

This slice includes the functional behavior, data adapter, operator/reviewer states and applicable privacy controls below. Shared security, accessibility, lifecycle and artifact requirements are normative, not optional boilerplate. Existing marketing, billing, widget redesign and production deployment are excluded.

## Functional requirements

1. Before drafting extract useful questions, objections, service constraints, local context, procedures and proof with source IDs and permitted public paraphrases.
2. Compare planned coverage with observed SERP themes; label a proposed gap inferred if competitor coverage was not actually inspected.
3. After drafting map source detail to article block IDs and show the reviewer what is distinct and why it helps the reader.
4. If relevant source specificity was dropped, request one targeted revision; if none exists, return needs_input and a concrete question for the tenant.
5. Never create fake first-person experience, proprietary statistics, customer quotes or location claims to satisfy an originality target.
6. Preserve PII redaction and original meaning; paraphrase only details allowed for public use. Do not claim plagiarism clearance or guaranteed originality.

## Data, migration and rollback

Save versioned information-gain report adjacent to article metadata and link its IDs from the brief/draft; no standalone table needed. Rollback skips enhancement but must retain unsupported-claim blockers.

Every changed artifact references its exact inputs and schema/workflow version. Follow the [shared artifact contract](../README.md#shared-artifact-contract); no hidden process-memory-only state or unrelated schema redesign.

## UX, security and non-functional requirements

Use the existing dashboard/admin design language. Show empty, running, needs-input and failed states with an actionable next step. Apply membership/staff checks server-side, safe rendering, tenant-scoped evidence access and redacted logs. Meet the shared mobile/keyboard requirements on changed screens. External latency is displayed as work in progress, not a frozen page.

## Analytics and monitoring

information_gain_checked; evidenceUsedCount, omittedRelevantCount, needsInputCount.

Record only observed values. During the first fixture session inspect failure rate, duplicate attempts and stale-artifact behavior; Cameron owns evaluation, Rory owns local fixes. Public SEO metadata is evaluated on final article/export only; internal review/admin screens remain authenticated and non-indexable.

## Pressure test

- **Riskiest assumption:** This slice improves useful approved output, not merely workflow complexity. Validate against the labelled synthetic cases before broadening scope.
- **Minimum viable cut:** Preserve useful tenant/customer specificity before and after drafting without fabricating originality. Ship one-tenant manual path first; retain a second tenant only for isolation testing.
- **Counter-position:** Information gain could be achieved by a short tenant Q&A, not another full model rewrite.
- **Build versus research:** Existing repo primitives make local implementation justified; usefulness/approval targets remain experimental.
- **Opportunity cost:** No new marketing, bulk generation, multi-CMS publishing or AI visibility suite while validating the core loop.
- **Kill/pivot criterion:** One grounded detail is a prototype minimum, not proof of market differentiation. Pivot to richer tenant input if specificity remains weak.
- **Why now:** Existing Convo artifacts and the October rebuild brief provide concrete inputs; old pipeline self-scoring and missing research are insufficient.
- **Halfway failure / plan B:** If fewer than half this slice’s acceptance cases pass midway through implementation, isolate the first failing boundary, use manual operator input where safe, and do not expand automation.

## Risks and mitigations

- **Product:** More stages can burden tenants; intermediate details remain in admin unless needed for a meaningful review decision.
- **Technical:** Legacy fields and stale JSON can contradict each other; use schema validation, current dependency digests and explicit incomplete states.
- **Privacy/security:** Source text may contain PII or hostile instructions; minimise before calls, treat source text as data, and test tenant boundaries.
- **SEO/editorial:** A complete artifact is not a ranking guarantee; judge usefulness and grounded claims, not keyword density.
- **Operational:** Failed external work may have side effects; retain attempts, distinguish uncertain outcomes and avoid blind retries.

## Acceptance criteria

- [ ] A fixture containing a verified service constraint retains it in the relevant section with evidence reference.
- [ ] A generic source without proof is labelled needs_input, not awarded an invented uniqueness score.
- [ ] The visible uniqueness note points to actual blocks and evidence; unrelated details do not count.
- [ ] A tenant-provided customer quote without publication permission is excluded or anonymised/paraphrased without quote marks.

## Test and release plan

- **Local:** Compare evidence-to-block mappings on detail-rich, detail-poor, sensitive-detail and hallucinated-case fixtures; Cameron judges usefulness separately from automated presence checks.
- **Integration:** Run the relevant shared 12-case set against the exact integrated commit; record commands, outcomes and unverified behavior. Fixtures are synthetic and provider transport is mocked unless explicitly marked live.
- **Staging:** Before a customer pilot, Blake or a nominated engineering reviewer checks changed auth/data/connector behavior; Cameron checks the product outcome. This is a proposed review, not a notification sent.
- **Production smoke:** Not authorised or required for the local milestone. Any later rollout starts with one approved pilot tenant behind a default-off flag and validates actual destination output.
- **Monitoring:** Inspect the first completed fixture session, then the first three reviewed positive drafts; fix blocking gaps before enabling another stage/provider.
- **Release / rollback:** Deliver as a scoped PR after prerequisites, enable locally only, and revert the feature flag/adapter for rollback. Preserve audit history; no destructive cleanup of remote content.

## Out of scope and open questions

Out: production migration/deployment, automatic public publishing, unrelated product rebuilding and unbounded batch processing. Stage-specific exclusions follow the requirements above.

No unanswered question blocks the defined local slice. Cameron owns live pilot segment and monetary caps; engineering review owns production operational suitability. Required paid configuration or WordPress test credentials may block live smoke tests but never justify fabricating a successful result.
