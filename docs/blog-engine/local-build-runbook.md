# Local build and verification handoff

Updated 2026-10-19. This is the implementation runbook, not evidence that the app has been started successfully.

## Current checkout and integration

The PRD branch starts from the roadmap branch. It intentionally does **not** contain PR #200 or #201 implementations. Review and integrate those two branches into the local implementation branch before wiring a pipeline. They each branch from the same earlier main; do not assume they are a stack. Reconcile later main changes deliberately rather than replacing the current marketing checkout.

Implementation location: a dedicated worktree under `~/Projects/worktrees/convo-blog-engine/`; never discard changes in `~/Projects/convo-app`.

## Prerequisites

1. `npm ci` using this repository's lockfile and supported Node version. Existing scripts: `dev`, `build`, `typecheck`, `lint`, `test`, `migrate`.
2. A disposable local/test database compatible with the existing Drizzle/Postgres migrations. Confirm host/database environment is not a production target before any migration or seed.
3. Configure environment names from `.env.example`; do not copy real values into docs or commit `.env.local`. Runtime code accepts `AUTH_SECRET` or `NEXTAUTH_SECRET`; existing example uses `NEXTAUTH_SECRET` and `NEXTAUTH_URL`. Verify the app's actual OAuth callback/cookie handling on localhost rather than disabling auth.
4. Local admin setup needs `PLATFORM_STAFF_EMAILS` containing Cameron's requested email, the matching `users.is_platform_staff` flag in the disposable DB, and existing MFA/encryption configuration. There is no new local auth bypass or seed script delivered in this docs milestone.
5. Existing generation provider configuration is needed for real model output. A saved synthetic draft fixture can exercise render/review checks without provider credentials, but must be labelled fixture output, not generated live.
6. Manual research requires no paid SEO credentials. Live DataForSEO and a WordPress test site are separate optional smoke-test prerequisites. A manual-only run does not prove live v1 acceptance.

## First integrated vertical slice

- Integrate/read the foundation code; fix the lifecycle issues in the [shared contract](README.md#lifecycle-corrections-required-before-integration).
- Add the typed storage/orchestration adapter and stable project identity before UI retries.
- Seed synthetic tenant context and import [fixture manifest](fixtures/acceptance-cases.json).
- Start with the grounded service question: decision → manual research → brief → structured draft → information gain → quality → tenant review → HTML export receipt.
- Implement minimum admin inspection alongside that path. No unbounded queue, bulk generation or automatic WordPress calls.
- Then add live research and draft connector smoke tests after the manual path works.

## Verification record required per implementation PR

Record commit, branch, environment mode, commands actually run, exit status, relevant fixture IDs, screenshots inspected, unresolved blockers and live integrations not exercised. The JSON file contains case definitions only; an implementation harness and generated artifacts do not exist yet.

Use focused stage tests first, then `npm run typecheck`, affected lint checks and the relevant existing test suite on the integrated commit. `npm run build` validates bundling, not tenant isolation or successful provider calls. Any existing suite failures must be listed separately from newly introduced failures. No runtime test is required for this documentation-only PR.

Before calling the prototype runnable, verify clean setup, authenticated Cameron admin, two-tenant isolation, restart recovery, a complete manual content loop, narrow/desktop preview and downloaded HTML. For WordPress, verify the actual test-site draft and theme; mocks alone cannot prove it.

## Review packet

Deliver demo URL only after a server has actually started and been checked. Include one useful article, one held evidence gap and one retry failure example, with current approval and export states. Do not expose the development server publicly as part of this local build.

The portable workflow source lives in workspace `skills/convo-blog-workflow/`; this PR includes an identical snapshot under `.agents/skills/convo-blog-workflow/`. Treat repository copies as reviewed snapshots; update both deliberately when changing the general workflow. Tenant/project implementation facts belong in these repository docs, not the reusable skill.
