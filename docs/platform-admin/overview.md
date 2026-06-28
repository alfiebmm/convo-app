# Platform Admin — overview

Plain-English explainer of what the `/platform-admin` surface actually does today, who it's for, and where the data comes from. Lives at `docs/platform-admin/overview.md` so it sits next to the code.

## Who it's for

Convo staff only. As of June 2026 that's Blake and Cam.

Two gates protect every route under `/platform-admin/*`:

1. **Email allowlist** — `PLATFORM_STAFF_EMAILS` is a comma-separated list checked by middleware on every request. Anyone not on the list gets a 404 (deliberately — we don't confirm the surface exists).
2. **TOTP MFA (CON-219)** — a registered Google account is not enough on its own. On first sign-in, staff are pushed through `/platform-admin/enrol-mfa` to add a TOTP authenticator. On every subsequent session, they pass a challenge at `/platform-admin/challenge-mfa` before the rest of the surface unlocks. Sensitive actions (suspend tenant, plan change, PII reveal, etc.) require a fresh step-up challenge on top of that.

Auth itself is standard NextAuth v5 + Google OAuth — same identity provider as the tenant dashboard, but with the allowlist and MFA layered on top.

## What each page does

### `/platform-admin` (Home)

Landing page. Renders three branded surface cards — Tenants (live), Audit log (live), Injection events (coming soon) — plus an "operating notes" block that re-states the read-only-first, audit-by-default, no-screenshots posture. Today's date and the signed-in admin email are surfaced at the top so it's obvious which account is in use.

### `/platform-admin/tenants` (Tenants list)

Searchable, filterable list of every Convo tenant.

- **Search** matches against name, slug, domain, and member email. Email-shaped queries also produce a separate "Matched by member email" panel.
- **Filters**: plan (multi-select), status (multi-select), inactivity (no conversations in 30 or 90 days).
- **Sort**: signup newest/oldest, name A-Z / Z-A, plan, status, last conversation, 30-day conversation count.
- **Pagination**: cursor-based, but only enabled on signup-desc and signup-asc sorts (the cursor predicate `(t.created_at, t.id) <` doesn't match the other orderings, so we hide the next-page link and explain why instead of silently skipping rows).
- **Empty state**: explicit "No tenants match these filters" row.
- Skeleton loader paints immediately while the query runs; filter chrome stays interactive.

### `/platform-admin/tenants/[tenantId]` (Tenant detail)

Per-tenant drill-in with five tabs:

- **Profile** — name, slug, domain, plan, signup date, owner (mailto link), Stripe customer ID, status pill, settings JSON preview (truncated past 8000 chars), and a team-members table.
- **Usage** — placeholder; shipping in CON-223 (ADMIN-5).
- **Activity** — chronological feed of plan changes, member joins/leaves, conversations, and admin audit events for this tenant.
- **Support notes** — placeholder; CON-223.
- **Danger zone** — Suspend / Reactivate / Soft-delete. Buttons are visibly disabled with a "Soon" pill — these wire up in CON-225 (ADMIN-8). Existing suspension or soft-delete metadata is rendered when present.

### `/platform-admin/audit` (Admin audit log)

Filterable view of every platform-admin action.

- Filters: actor, action (multi-select), target type, status (intent / outcome:success / outcome:error), target ID, correlation ID, date range.
- Each row shows actor, action, target, status, and a clickable correlation ID. Expand "Details" to see before/after state, metadata, reason, and support context.
- Export CSV button posts the same filters to `/platform-admin/audit/export`.

### `/platform-admin/audit/[correlationId]`

Single-correlation drill-in: every audit row tied to one correlation ID, in order. Used to trace a multi-step intent → outcome chain.

### `/platform-admin/injection-events`

**Placeholder.** Renders a "Convo staff only — dashboard coming soon" card. The `platform_injection_events` table is already in place; the listing UI ships in a follow-up ticket.

### `/platform-admin/enrol-mfa`, `/platform-admin/challenge-mfa`, `/platform-admin/locked`

MFA lifecycle pages. `enrol-mfa` runs once per admin to register a TOTP authenticator. `challenge-mfa` is hit on every new admin session (and on step-up for sensitive actions). `locked` is the dead-end after too many failed challenges; a separate cooldown clears it.

## How auth works (high level)

- Sign-in: Google OAuth via NextAuth v5, JWT session cookies (`__Secure-` prefix on HTTPS).
- Middleware verifies the session with `getToken({ secureCookie: true })`, checks the email against `PLATFORM_STAFF_EMAILS`, and 404s anything that doesn't match.
- Inside the layout, `requirePlatformStaff()` re-checks `users.is_platform_staff = true` against Postgres (defence in depth — the allowlist alone isn't authoritative).
- Step-up MFA: sensitive actions call `requireStepUp(action)`, which checks for a short-lived signed cookie issued at challenge time; missing or stale → redirect to `/platform-admin/challenge-mfa?stepUp=…`.
- No secrets are surfaced in the DOM. Error boundary renders the Next.js error digest only; full stack traces stay in server logs.

## How tenant data is scoped

- Every query runs through a minted user JWT keyed to the signed-in admin and is sent to Supabase as that user, so Postgres RLS is the actual gate.
- Tenant tables expose a `is_platform_staff()` SQL predicate that returns true for the user when their row in `users` has `is_platform_staff = true`. RLS policies treat that predicate as a bypass for read paths the admin surface needs (tenants, members, conversations summaries, audit log). Mutating policies still require the regular intent + step-up + audit flow.
- A wrong-credential failure (e.g. a missing JWT) returns no rows — by design — rather than leaking via a 500.

## Where the data comes from

| Surface                               | Source tables (Postgres)                                                       |
|---------------------------------------|--------------------------------------------------------------------------------|
| Tenants list                          | `tenants` + LATERAL aggregates from `tenant_members`, `conversations`          |
| Tenant detail (profile + members)     | `tenants`, `tenant_members`, `users` (owner email)                             |
| Tenant detail (activity timeline)     | UNION over `tenant_members`, `conversations`, `admin_audit_log` for the tenant |
| Tenant detail (settings JSON)         | `tenants.settings` (JSONB)                                                     |
| Audit log                             | `admin_audit_log`                                                              |
| Audit correlation view                | `admin_audit_log` filtered by `correlation_id`                                 |
| Injection events (placeholder)        | `platform_injection_events` (schema present; UI pending)                       |

Every admin page view that reads tenant data writes an `intent` row to `admin_audit_log` via the `withAuditLog` wrapper, then logs an `outcome:success` or `outcome:error` paired by `correlation_id`. That pairing is the trail Cam or Blake follows when someone asks "who looked at tenant X on Tuesday?".

## Limitations and known placeholders

- **Audit log on tenant detail tabs** — Usage and Support notes tabs are stubs. Real metrics + notes land in CON-223 (ADMIN-5).
- **Danger zone buttons** — Suspend / Reactivate / Soft-delete are visibly disabled with a "Soon" pill. Wire-up is CON-225 (ADMIN-8).
- **Stripe deep-link** — "Open in Stripe" on the profile tab is disabled until CON-222.
- **Owner deep-link** — Owner email is a `mailto:` because the `/platform-admin/users/[userId]` surface doesn't exist yet (separate follow-up).
- **Injection events** — page renders a placeholder card. Data fetch + listing UI is a future ticket.
- **Pagination on non-signup sorts** — deliberately disabled (see Tenants list above). Not a bug — narrow the filters or switch sort to paginate.
- **MRR column** — removed from the tenant list. Every row was a hardcoded em-dash; it goes back once billing data is real (CON-223+).

## What's coming

- **CON-222** — Stripe deep-link, plan-change action, billing audit rows.
- **CON-223 (ADMIN-5)** — real usage metrics and support notes on tenant detail.
- **CON-225 (ADMIN-8)** — Suspend / Reactivate / Soft-delete actions.
- **Injection events UI** — list, filter by tenant + pattern, drill-in.
- **User detail surface** — `/platform-admin/users/[userId]` for owner / member deep-links.
