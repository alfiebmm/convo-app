# Platform-admin — manual test checklist

Run through after CON-PLATFORM-ADMIN-QA-1 ships to prod. Roughly 10 minutes
end-to-end. Tick as you go; flag anything off in the Convo Telegram group.

Test domain: `https://convoapp.com.au/platform-admin`

## Auth + access

- [ ] **Signed-out 404.** Open `/platform-admin` in an incognito window.
      Expected: 404 page, no hint that the route exists.
- [ ] **Non-allowlisted email 404.** Sign in with a Gmail account NOT in
      `PLATFORM_STAFF_EMAILS` (e.g. a personal alt). Visit `/platform-admin`.
      Expected: 404.
- [ ] **Allowlisted email — first sign-in.** Sign in as `blake.d.mitchell@gmail.com`
      or `cameronbeach@gmail.com`. Visit `/platform-admin`.
      Expected: redirect to `/platform-admin/enrol-mfa` (only if you haven't
      enrolled yet).
- [ ] **TOTP enrolment.** Scan the QR with Google Authenticator / 1Password.
      Enter the 6-digit code. Tick the "saved recovery codes" box. Submit.
      Expected: redirect to platform-admin home, recovery codes shown once.
- [ ] **TOTP challenge on next session.** Sign out, sign back in, visit
      `/platform-admin`. Expected: redirect to `/platform-admin/challenge-mfa`,
      6-digit input. Enter the code. Expected: home page renders.
- [ ] **Lockout.** Enter 5 wrong codes in a row on the challenge page.
      Expected: redirect to `/platform-admin/locked` with a clear retry-at time.

## Tenants list (`/platform-admin/tenants`)

- [ ] **Initial paint is fast.** Click into the tenants link from home.
      Expected: header + filter form render immediately; the table area shows
      a skeleton for a beat, then the data fills in. No long blank page.
- [ ] **Search by name/slug.** Type `doggo`. Expected: only Doggo shows.
- [ ] **Search by member email.** Type `blake@doggo.com.au`.
      Expected: "Matched by member email" section appears above the main list.
- [ ] **Plan filter.** Select Starter / Growth / Scale.
      Expected: list narrows. URL has `?plan=...`.
- [ ] **Status filter.** Tick a status (e.g. `active`).
      Expected: list narrows. Soft-deleted tenants only appear when you
      explicitly tick `deleted_soft`.
- [ ] **Activity filter.** Pick "No conversations in 30 days".
      Expected: only tenants matching that window remain.
- [ ] **Sort change.** Switch sort (signup-desc → plan-asc → last-active-desc).
      Expected: order changes. On non-default sort, the Next-page link is
      hidden (this is correct — see overview.md "Limitations").
- [ ] **Clear filters.** Use the Clear button.
      Expected: list resets to default sort with all filters dropped.
- [ ] **Empty state.** Search for nonsense (`xxxnotatenant`).
      Expected: "No tenants found" copy, not a broken layout.

## Tenant detail (`/platform-admin/tenants/[tenantId]`)

- [ ] **Open Doggo.** Expected: page renders header instantly, then sections
      load (overview, conversation counts, members, settings, soft-delete
      state). Brand chrome (orange accent, zinc cards) matches the list page.
- [ ] **Owner email is a `mailto:` link** (not a broken `/users/[userId]` link).
- [ ] **Conversation counts** match what you'd expect for Doggo. 7d and 30d
      both shown.
- [ ] **Members table.** Each member has an email and a role. Table headers
      use `scope="col"` (keyboard nav highlights them when tabbed).
- [ ] **Settings JSON viewer.** Renders. If the JSON is over 8000 chars, a
      "Truncated" pill appears (won't trigger on Doggo / AgPages — they're
      under the cap).
- [ ] **Open AgPages.** Repeat the same checks.
- [ ] **Back-nav.** Browser back returns to the list with all filters intact
      via the URL.

## Loading + error states

- [ ] **Slow network.** Chrome DevTools → Network → throttle to "Slow 3G".
      Reload `/platform-admin/tenants`.
      Expected: skeleton renders immediately, data fills in once the query
      completes. No flash of unstyled content.
- [ ] **Forced error.** In DevTools, block requests to `*.supabase.co`.
      Reload tenants.
      Expected: Convo-branded "Something went wrong" card with a Retry button
      and a "Back to home" link. No stack trace. The page header / nav still
      render — error stays confined to the data section.
- [ ] **Retry.** Unblock requests, click Retry.
      Expected: data loads.

## Audit log (`/platform-admin/audit`)

- [ ] **Page loads.** Recent platform-admin actions visible (your own views
      will be in there from this checklist run).
- [ ] **Filter by action type.** Try `tenant.view`. Expected: list narrows.
- [ ] **CSV export.** Click export. Expected: CSV downloads with the filtered
      rows.
- [ ] **Click a correlation ID.** Expected: detail page renders with the full
      audit trail for that action.
- [ ] **Bogus correlation ID.** Visit `/platform-admin/audit/00000000-0000-0000-0000-000000000000`.
      Expected: an empty / not-found state (rough edge — Linear ticket filed).

## Placeholders

- [ ] **Injection events page.** Visit `/platform-admin/injection-events`.
      Expected: "Coming soon" copy, no clickable controls that look like they
      should work. No console errors.

## Cross-browser

- [ ] **Chrome (latest).** Everything above.
- [ ] **Safari (latest).** Spot-check tenants list + detail + MFA challenge.
      Expected: fonts render (Fredoka / Outfit / Inter), focus rings work,
      no layout shifts.

## Brand sanity

- [ ] No exclamation marks in any copy.
- [ ] Australian English where it shows ("organisation", "behaviour",
      "30 days" not "30d" in human copy).
- [ ] Primary orange is `#FF6B2C` (no warm peach, no hot orange).
- [ ] Body type is Inter, headings are Outfit, the wordmark (if it appears
      in the chrome) is Fredoka.

---

If anything fails, post in the Convo Telegram with the page URL + one
sentence + a screenshot. I'll triage and either patch or file a Linear
ticket.
