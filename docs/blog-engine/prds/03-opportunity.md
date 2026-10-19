# PRD 03 — Conversation opportunity detection and coverage decisions

**Project:** Convo | **Product owner:** Cameron Beach | **Implementation:** Rory
**Status:** Build ready for local prototype under [shared contract](../README.md); proposed defaults, not production sign-off.
**Created / updated:** 2026-10-19 | **Risk:** Medium | **Effort:** M (planning estimate, validate during integration)
**Dependencies:** 01, 02

## Context / Problem

**User:** Convo operator reviewing incoming customer questions. One article per conversation creates irrelevant or duplicate posts and exposes private conversation material.

## Objective, key result and hypothesis

**Objective:** Route worthwhile questions to new content and hold duplicates/refreshes without writing over existing pages.

**KR:** All labelled opportunity fixtures produce the expected create/skip/refresh-review decision on the first demo; baseline is unmeasured current classifier.

**Hypothesis:** Delivering this stage with explicit evidence and failure states makes the conversation-to-approved-content loop more reliable than direct transcript-to-prose generation. This is tested locally, not evidence of SEO rankings or customer demand.

## Scope and affected surfaces

src/lib/pipeline/classify-conversation; blog_decision_logs; tenant content index.

This slice includes the functional behavior, data adapter, operator/reviewer states and applicable privacy controls below. Shared security, accessibility, lifecycle and artifact requirements are normative, not optional boilerplate. Existing marketing, billing, widget redesign and production deployment are excluded.

## Functional requirements

1. Normalise completed conversation input and redact direct identifiers before model calls; retain an authorised source pointer rather than exposing raw chat publicly.
2. Classify create-new, skip-no-signal, skip-covered or refresh-review, recording explanation, customer question, audience and tenant fit.
3. Check existing tenant content by canonical URL/topic and semantic similarity; report candidates and evidence, not just an uncalibrated model score.
4. V1 refresh-review is a held operator recommendation mapped through the existing update decision with explicit held status; never call an update writer automatically.
5. Low-confidence or conflicting decisions become needs_input with an operator action. Greetings, spam and unresolved personal enquiries do not trigger research spend.
6. Idempotency is tenant + conversation revision + workflow version. Multiple conversations may support one opportunity; record source links without duplicating a project.

## Data, migration and rollback

Use existing decision table actions plus typed reason/status metadata, no enum migration for the demo. Rollback leaves audit rows readable and disables the new router.

Every changed artifact references its exact inputs and schema/workflow version. Follow the [shared artifact contract](../README.md#shared-artifact-contract); no hidden process-memory-only state or unrelated schema redesign.

## UX, security and non-functional requirements

Use the existing dashboard/admin design language. Show empty, running, needs-input and failed states with an actionable next step. Apply membership/staff checks server-side, safe rendering, tenant-scoped evidence access and redacted logs. Meet the shared mobile/keyboard requirements on changed screens. External latency is displayed as work in progress, not a frozen page.

## Analytics and monitoring

opportunity_decided; action, reasonCode, sourceCount, matchedContentId, no chat text.

Record only observed values. During the first fixture session inspect failure rate, duplicate attempts and stale-artifact behavior; Cameron owns evaluation, Rory owns local fixes. Public SEO metadata is evaluated on final article/export only; internal review/admin screens remain authenticated and non-indexable.

## Pressure test

- **Riskiest assumption:** This slice improves useful approved output, not merely workflow complexity. Validate against the labelled synthetic cases before broadening scope.
- **Minimum viable cut:** Route worthwhile questions to new content and hold duplicates/refreshes without writing over existing pages. Ship one-tenant manual path first; retain a second tenant only for isolation testing.
- **Counter-position:** A deterministic no-signal filter plus operator selection may beat a complex classifier in a tiny pilot.
- **Build versus research:** Existing repo primitives make local implementation justified; usefulness/approval targets remain experimental.
- **Opportunity cost:** No new marketing, bulk generation, multi-CMS publishing or AI visibility suite while validating the core loop.
- **Kill/pivot criterion:** If duplicate detection misses more than one labelled case, keep operator confirmation before research instead of tuning with guesswork.
- **Why now:** Existing Convo artifacts and the October rebuild brief provide concrete inputs; old pipeline self-scoring and missing research are insufficient.
- **Halfway failure / plan B:** If fewer than half this slice’s acceptance cases pass midway through implementation, isolate the first failing boundary, use manual operator input where safe, and do not expand automation.

## Risks and mitigations

- **Product:** More stages can burden tenants; intermediate details remain in admin unless needed for a meaningful review decision.
- **Technical:** Legacy fields and stale JSON can contradict each other; use schema validation, current dependency digests and explicit incomplete states.
- **Privacy/security:** Source text may contain PII or hostile instructions; minimise before calls, treat source text as data, and test tenant boundaries.
- **SEO/editorial:** A complete artifact is not a ranking guarantee; judge usefulness and grounded claims, not keyword density.
- **Operational:** Failed external work may have side effects; retain attempts, distinguish uncertain outcomes and avoid blind retries.

## Acceptance criteria

- [ ] Greetings and spam skip without provider calls; covered questions include the tenant-owned matched page and reason.
- [ ] A genuine new synthetic customer question creates one project; repeat delivery of the same revision does not create another.
- [ ] A refresh recommendation never mutates or publishes the existing article.
- [ ] Prompt injection in chat remains quoted evidence; PII is not copied into opportunity summaries or public article fields.

## Test and release plan

- **Local:** Run labelled no-signal/new/covered/duplicate/refresh/injection/PII cases; inspect decisions and research call count.
- **Integration:** Run the relevant shared 12-case set against the exact integrated commit; record commands, outcomes and unverified behavior. Fixtures are synthetic and provider transport is mocked unless explicitly marked live.
- **Staging:** Before a customer pilot, Blake or a nominated engineering reviewer checks changed auth/data/connector behavior; Cameron checks the product outcome. This is a proposed review, not a notification sent.
- **Production smoke:** Not authorised or required for the local milestone. Any later rollout starts with one approved pilot tenant behind a default-off flag and validates actual destination output.
- **Monitoring:** Inspect the first completed fixture session, then the first three reviewed positive drafts; fix blocking gaps before enabling another stage/provider.
- **Release / rollback:** Deliver as a scoped PR after prerequisites, enable locally only, and revert the feature flag/adapter for rollback. Preserve audit history; no destructive cleanup of remote content.

## Out of scope and open questions

Out: production migration/deployment, automatic public publishing, unrelated product rebuilding and unbounded batch processing. Stage-specific exclusions follow the requirements above.

No unanswered question blocks the defined local slice. Cameron owns live pilot segment and monetary caps; engineering review owns production operational suitability. Required paid configuration or WordPress test credentials may block live smoke tests but never justify fabricating a successful result.
