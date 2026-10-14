# Convo Blog Engine Rebuild Roadmap

Status: prototype roadmap for the Rankability-inspired rebuild.
Audience: Blake, Cameron, and whoever is slicing the engineering work.

## Product Direction

Convo should treat each worthwhile conversation as a research-backed content project, not as a direct transcript-to-article prompt.

The core flow is:

1. Conversation produces a content signal.
2. Convo decides whether to ignore, create, update, or refresh existing content.
3. Research provider enriches the opportunity with keywords, SERP themes, related questions, and competitor gaps.
4. Editorial brief locks the article strategy before drafting.
5. Article model renders a visually reviewable, publish-ready article.
6. Quality gates check source grounding, SEO coverage, modules, links, and tenant constraints.
7. Admin or tenant reviewer approves.
8. Publisher exports to WordPress draft first, with later CMS providers behind the same interface.

The wedge is conversation-led SEO. Rankability is the workflow reference, but Convo's advantage is that it starts from actual customer questions.

## Existing Code To Reuse

Use the current repo as a foundation:

- `blog_posts` as the generated article / content project record.
- `blog_decision_logs` as the create/update/skip audit trail.
- `blog_editorial_briefs` as the reviewable brief artifact.
- `tenant_seo_strategy` as the lean tenant SEO configuration.
- `src/lib/pipeline/classify-conversation` for conversation classification.
- `src/lib/pipeline/editorial-brief` for keyword/module/CTA/link planning.
- `src/lib/blog/create.ts` and `src/lib/blog/update.ts` for draft generation and update drafts.
- `src/app/dashboard/content` for tenant review.
- `src/app/platform-admin` for founder/admin oversight.

Do not add a parallel `content_projects` table until the existing blog tables hit a real modelling limit. For now, use a typed service layer that presents the Content Project lifecycle while persisting into the existing tables.

## Tenant Customisation

Keep tenant-side controls intentionally small:

- Priority services.
- Priority locations.
- Target audiences/personas.
- Approved internal URLs.
- Preferred CTAs.
- Avoid topics, claims, and keywords.
- Brand/voice samples later, ideally via crawl of 3-5 real tenant posts.

Do not expose SERP tuning, provider selection, prompt controls, model settings, scoring weights, or publishing internals to tenants in v1. Those belong in admin or code until the workflow is stable.

## Local Admin

For this prototype, use `cameronbeach1@gmail.com` as a platform admin.

The repo already has a production-style platform-admin gate:

- `PLATFORM_STAFF_EMAILS` must include `cameronbeach1@gmail.com`.
- The matching `users` row must have `is_platform_staff = true`.
- TOTP enrolment still applies unless explicitly bypassed in a local-only seed or dev fixture.

## PR Roadmap

### PR 1: Roadmap and Architecture Contract

Goal: Make the rebuild direction reviewable before code sprawls.

Scope:

- Add this roadmap.
- Document how existing tables map to the Content Project concept.
- Lock the PR sequence and v1/non-v1 boundaries.

Verification:

- Docs-only review.

### PR 2: Content Project Service Layer

Goal: Add a typed application layer that represents the lifecycle without a new table.

Scope:

- Add `src/lib/blog/content-projects/`.
- Define lifecycle states: `candidate_detected`, `researching`, `brief_ready`, `drafting`, `uniqueness_pass`, `optimization_pass`, `review_ready`, `approved`, `published_or_exported`, `skipped`, `failed`.
- Map lifecycle state from `blog_posts.status`, `blog_decision_logs.action`, and `blog_editorial_briefs`.
- Add a read model for admin and dashboard surfaces.
- Add tests for create/update/skip/failure mappings.

Keep out:

- New database tables.
- Provider calls.
- UI changes beyond optional link stubs.

### PR 3: Research Provider Interface And Manual Provider

Goal: Separate research from writing.

Scope:

- Add `src/lib/blog/research/`.
- Define provider interface for keyword ideas, SERP competitors, entities, questions, and gaps.
- Add manual/mock provider for local prototype and tests.
- Persist research artifacts into `blog_decision_logs.metadata` or `blog_editorial_briefs.missingDataFallbacks` until a dedicated artifact table is justified.
- Add tests for provider fallbacks and no-subscription operation.

Keep out:

- Live DataForSEO credentials.
- SERP scraping.
- Draft generation changes.

### PR 4: DataForSEO Provider

Goal: Add first live research provider behind the interface.

Scope:

- Add env-driven DataForSEO client.
- Use low-cost endpoints for keyword ideas, volume/difficulty, SERP top results, and related questions.
- Add timeout, retry, and error classification.
- Store raw provider metadata in a bounded artifact shape.
- Add tests with fixture responses.

Keep out:

- Tenant-facing provider controls.
- Billing automation.

### PR 5: Research-Backed Brief Builder

Goal: Make the brief the strategy artifact.

Scope:

- Feed research artifacts into `buildEditorialBrief`.
- Extend the brief with SERP themes, content gaps, competitor angles, related questions, and required proof points.
- Keep existing tenant SEO strategy fields lean.
- Add validation that briefs do not invent tenant facts or unsupported claims.

Keep out:

- Article drafting prompt rewrites beyond passing the richer brief.

### PR 6: Article Block Model And Renderer

Goal: Move from blob content toward a reviewable article object.

Scope:

- Formalise supported blocks: hero, intro, section, FAQ, callout, quote/proof, comparison table, numbered steps, checklist, CTA, internal links, schema suggestions.
- Add renderer for dashboard preview and WordPress/export HTML.
- Keep Markdown export as a fallback.
- Add tests for renderer output and unsupported block handling.

Keep out:

- Complex media/image generation.

### PR 7: Uniqueness And Information Gain Pass

Goal: Add the Convo-specific advantage.

Scope:

- Add a pass that extracts customer questions, tenant answers, objections, local detail, service constraints, policies, proof points, and examples.
- Require a visible "why this article is unique" artifact in the review panel.
- Add quality checks that fail generic articles when the source conversation has specific evidence.

Keep out:

- Automatic external fact claims.

### PR 8: Optimisation And Quality Gates

Goal: Make quality measurable before review.

Scope:

- Add coverage checks against the brief and research.
- Extend current keyword/module/link validation.
- Add grounding checks, internal-link-only enforcement, missing proof warnings, and publish readiness score.
- Make failures visible in dashboard/admin without auto-publishing.

Keep out:

- Ranking/performance reporting.

### PR 9: Admin Blog Engine Console

Goal: Give founders/operators a control panel.

Scope:

- Add platform-admin blog engine view.
- Show content projects by lifecycle state.
- Show research/brief/draft/eval artifacts.
- Add retry/reprocess controls with audit logging.
- Add local admin seed/runbook for `cameronbeach1@gmail.com`.

Keep tenant side simple:

- Tenant dashboard sees review, edit, approve, publish/export.
- Admin sees provider details, failures, prompts/artifacts, and ops controls.

### PR 10: WordPress Draft Publishing

Goal: Ship the first real export path.

Scope:

- Publish approved articles as WordPress drafts.
- Support HTML/block output from the article model.
- Record publish/export history.
- Add rollback/retry notes.

Keep out:

- Multi-CMS publishing.
- Auto-publish.

### PR 11: Tenant Voice Corpus

Goal: Make articles sound tenant-specific.

Scope:

- Crawl or ingest 3-5 tenant posts.
- Store voice/style samples.
- Add few-shot voice references to drafting/rewrite prompts.
- Keep the tenant UI to review/replace samples only.

Keep out:

- Full brand voice studio.

### PR 12: Reporting Foundation

Goal: Avoid blocking future AI/search visibility reporting.

Scope:

- Persist structured artifacts and publish history.
- Add fields/interfaces needed for future GSC, Ahrefs, AI Overview, ChatGPT/Gemini/Perplexity visibility.
- Add admin-only status placeholders.

Keep out:

- Full reporting dashboard.
- Sentiment/citation tracking.

## Prototype Acceptance Criteria

- A conversation can be converted into a reviewable content project.
- The project records decision, research, brief, draft, quality gates, and publish/export status.
- Local/manual research works without paid provider credentials.
- Admin can inspect the project lifecycle and retry failures.
- Tenant customisation stays limited to strategy, links, CTAs, and voice samples.
- The article preview is visually reviewable before WordPress export.
- No non-tenant links can pass publishing validation.

## Open Questions

- Which DataForSEO endpoints should be paid for first: keyword ideas only, or keyword plus SERP top results?
- Should v1 support refresh-existing-content, or only create-new plus skip-covered?
- For WordPress, is draft post with rendered HTML enough for v1, or do we need Gutenberg block fidelity immediately?
- Should the uniqueness pass run before first draft, after first draft, or both?
- Which tenant should be the canonical local prototype: AgPages, Doggo, or a neutral demo tenant?
