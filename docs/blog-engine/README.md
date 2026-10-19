# Convo local rebuild: product and delivery contract

Owner: Cameron Beach (Product). Implementation: Rory. Engineering review: Blake, not yet assigned or notified.
Updated: 2026-10-19. Status: ready for local implementation with the proposed defaults below; not production approval.

## Outcome

Turn real customer questions into grounded, visually reviewable articles. Preserve the useful chat, auth, tenancy, knowledge and admin foundations; replace weak content stages rather than rebuilding unrelated product surfaces.

The first local demo serves Cameron as operator and a small-business tenant reviewer. Use synthetic AgPages-shaped content, not copied customer conversations. Initial commercial niche is not locked by this prototype. Dental/health claims require a separately agreed expert-review policy before a live pilot.

## What actually exists

- [PR #199](https://github.com/alfiebmm/convo-app/pull/199): architecture/12-slice roadmap.
- [PR #200](https://github.com/alfiebmm/convo-app/pull/200): pure Content Project read model. Not an orchestrator or persistence service.
- [PR #201](https://github.com/alfiebmm/convo-app/pull/201): research interface/manual implementation. Not a live provider or persisted research pipeline.

All three were open on 2026-10-19. They are separate branches, not an integrated working prototype. Historical test results do not verify the new integration. Current user marketing edits in the primary checkout must remain untouched.

## Proposed local defaults, not historical decisions

1. New articles plus explicit skip/covered decisions first. Detect refresh opportunities, but hold them for operator review; do not overwrite existing pages.
2. Manual research is the zero-paid-credential demo path. DataForSEO keyword + organic SERP research is required for live v1 research acceptance. No claim that manual suggestions are measured search data.
3. HTML and Markdown export first; WordPress draft creation next. Gutenberg-specific block fidelity is deferred. No auto-publishing.
4. Extract information gain before drafting and check its preservation afterward.
5. Voice samples are optional. Missing samples use restrained Australian English without invented brand characteristics.
6. Technical/provider/model settings remain admin-only. Use existing configured generation adapters; no model migration or new API subscription is required by these specs.
7. Prototype quality targets below are hypotheses to evaluate, not observed performance or commercial promises.

## PRDs and dependencies

| ID | Outcome | Depends on | Original roadmap |
|---|---|---|---|
| [01](prds/01-foundation.md) | Local platform and trustworthy lifecycle | none | PR 2 |
| [02](prds/02-tenant-context.md) | Minimal tenant strategy and knowledge/voice | 01 | PR 11 + existing config |
| [03](prds/03-opportunity.md) | Conversation opportunity decisions | 01, 02 | existing classifier |
| [04](prds/04-research.md) | Inspectable manual/live research | 03 | PR 3–4 |
| [05](prds/05-brief.md) | Reviewable editorial strategy | 02, 04 | PR 5 |
| [06](prds/06-article.md) | Structured draft and visual renderer | 05 | PR 6 |
| [07](prds/07-information-gain.md) | Tenant-specific information gain | 05, 06 | PR 7 |
| [08](prds/08-quality.md) | Independent readiness gates | 06, 07 | PR 8 |
| [09](prds/09-tenant-review.md) | Simple review/edit/approve flow | 06, 08 | tenant half of PR 9 |
| [10](prds/10-admin.md) | Inspectable operations and retry | 01; artifacts as delivered | admin half of PR 9 |
| [11](prds/11-publishing.md) | Approved exports and WordPress drafts | 08, 09 | PR 10 |
| [12](prds/12-reporting.md) | Honest outcome and cost evidence | 01, 11 | PR 12 |

Build order: integrate foundations → manual vertical slice (02–09, HTML export and minimum admin inspection) → live DataForSEO → WordPress draft → voice ingestion and reporting polish. Research provider must land before research-backed brief acceptance. Do not open a dozen empty implementation PRs; create each when its diff and checks exist.

## Shared artifact contract

Every stage output carries `schemaVersion`, `tenantId`, stable `projectId`, `artifactId`, `revision`, `inputArtifactIds`, `inputDigest`, `createdAt`, `runId`, and `status` (`complete`, `needs_input`, `failed`). Research adds provider/mode, query, locale, queried time and evidence provenance. Generated outputs record prompt/workflow version and model identifier, not secrets. Evaluation and approval reference the exact article revision/digest.

Keep artifacts in existing typed metadata/brief storage for the prototype, with schema validation at read/write boundaries. Canonical research location: `blog_decision_logs.metadata.research`; article/run/evaluation references: typed `blog_posts.metadata.contentProject`; brief content in `blog_editorial_briefs` through an explicit adapter. Do not use `missingDataFallbacks` as an untyped research blob. If no blog row exists yet, stage/run metadata lives alongside the decision. Define a stable project ID in metadata once; do not derive a changing ID from whichever row happens to exist.

Create a documented storage adapter, not arbitrary JSON writers throughout the app. Preserve revision history and immutable run IDs; redact provider payloads and limit stored raw research to 100 KB per artifact for the prototype. Reject oversized input with an actionable error. A dedicated artifact table is a later migration if JSON history grows beyond bounded prototype use; do not promise unlimited JSON history.

### Lifecycle corrections required before integration

The PR #200 fallback currently treats `publishing` as `published_or_exported`, any draft as `review_ready`, and explicit metadata as stronger than failures. These are known gaps, not accepted behavior.

- Expose active operation and terminal outcome separately. In-flight publishing is not success.
- `review_ready` requires a rendered draft plus a current passing blocking-gate report.
- Failure takes precedence over stale lifecycle metadata. Missing legacy artifacts produce `needsReview`/incomplete indicators, not fabricated completion.
- Approval is bound to current content digest, brief/research/strategy versions and current gate report. Edits or changed upstream inputs invalidate downstream artifacts and approval.
- Project success is export receipt or confirmed WordPress response with destination ID/status. Export does not mean publicly published.
- Same input digest + stage + workflow version is idempotent; retries create attempts, not duplicate articles or approvals. Use a database transaction and expected-revision check for writes, never process-memory locks alone.

## Shared non-functional requirements

Tenant membership and ownership are checked server-side on reads, writes and stage execution; platform operations require real staff authorization and retain existing MFA. Never infer authorization from a supplied tenant ID. Minimise PII before model/provider calls; public article evidence must be anonymised. Retrieved pages, chat and KB text are data, never system instructions. Fetches use HTTPS host allowlists/SSRF protections with private-network, redirect and credential rejection. Render text safely; allow only supported markup.

Tenant pages retain the existing dashboard pattern, keyboard navigation, labelled controls and a usable 375 px layout. Prototype target: fixture project detail loads within 2 seconds on the developer machine, excluding external generation; show running/error states for background work. Record actual timings without asserting a guarantee. Writes are revision-checked; interrupted runs are visible and retryable.

## Evaluation contract

Create 12 synthetic cases: grounded new article; duplicate; covered question; no signal; missing tenant evidence; unsupported price/claim; transcript PII; prompt injection; wrong-tenant access; provider failure; malicious link/markup; stale approval and ambiguous publish retry. Some cases exercise multiple scenarios. Store expected decision/blockers with each fixture.

Targets for the first completed demo: 12/12 expected decisions/blockers, zero unsupported factual claims in the three positive-path article fixtures, 3/3 structured previews and HTML exports without manual HTML repair, and 0 external publishes. Cameron's review hypothesis: at least 2/3 positive drafts acceptable with no factual rewrite and under 10 minutes editorial work each. Baseline is unmeasured; capture current-pipeline output on those same synthetic inputs before comparing. Do not use rankings or AI-detector scores as local acceptance metrics.

## Release and evidence

Local implementation only. Keep existing production behavior unchanged behind a server-side feature flag, default off. No production migrations, paid requests, public pages or customer messages are necessary for the documentation/fixture milestone. Any live integration uses configured credentials and explicit demo action; WordPress destination must be a test site until a live publish is separately authorized.

Each implementation PR lists delivered requirements, focused checks actually run, known gaps and rollback. Broad existing test/build results apply only to the exact integrated commit tested. Blake is a proposed engineering reviewer, not someone already contacted. No automatic deployment is requested by this contract.

## Remaining decisions

Cameron owns commercial segment, paid cost ceilings and live pilot choice. Proposed defaults unblock local implementation. Before paid requests, the admin must supply a per-run/per-day monetary cap; missing cap blocks live research but not manual mode. Before a customer launch, confirm expert-review policy, retention policy, production queue/locking design and WordPress styling on the pilot theme. These are release gates, not reasons to pause the local build.
