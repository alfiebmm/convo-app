# Forum Config Examples — four-slice forumConfig contract

Until all four `forumConfig.*` slices (`follow_up`, `ai_persona`,
`qualifying_questions`, `allowed_topics`) are populated, no `case` event will
fire for the tenant. `/api/chat` still answers normally, but the follow-up
re-evaluation pipeline silently skips until the four-slice contract is met.

Seed future tenants with `scripts/seed-tenant-forum-config.ts`; do not apply
these blocks with ad hoc SQL.

Production-ready example configurations for the `forum.config.json` →
`follow_up` block introduced in [CON-157](https://linear.app/convo-app-au/issue/CON-157) (Epic A1).

These examples ship under Epic A3 ([CON-159](https://linear.app/convo-app-au/issue/CON-159))
as part of the Configurable Follow-Up program ([CON-149](https://linear.app/convo-app-au/issue/CON-149)).

---

## What's here

| File | Tenant | Profile |
| --- | --- | --- |
| [`agpages-follow-up.json`](./agpages-follow-up.json) | AgPages | Agricultural marketplace — farmer demand + contractor supply + CX |
| [`doggo-follow-up.json`](./doggo-follow-up.json) | Doggo | Puppy marketplace — buyer demand + breeder supply + CX |
| [`__tests__/seed-configs.test.ts`](./__tests__/seed-configs.test.ts) | — | tsx-runnable fixture validator |

Each JSON file is **only the `follow_up` block** — paste it under
`follow_up` inside a four-slice seed file. They are reference shapes for the
follow-up slice, not complete seed files on their own.

---

## Pilot rollout order

**AgPages first, then Doggo.** AgPages exercises more of the rule-engine
surface (farmer demand, contractor availability, marketplace navigation CX),
which makes it the higher-signal pilot. Once AgPages is steady in production,
Doggo follows.

> Applying these configs to live tenants is an **operational step performed by
> Cam or Blake post-merge** — not part of the ticket that ships this file.
> This directory is the source of truth for the *content*; the live apply
> step is manual until the editor UI lands in V1.1.

---

## How to apply

The editor UI is V1.1 (see [CON-149](https://linear.app/convo-app-au/issue/CON-149)).
Until then, apply through the tenant forumConfig seeder:

```bash
npx tsx scripts/seed-tenant-forum-config.ts \
  --tenant agpages \
  --file path/to/agpages-four-slice.json \
  --dry-run
```

```bash
npx tsx scripts/seed-tenant-forum-config.ts \
  --tenant agpages \
  --file path/to/agpages-four-slice.json
```

If a tenant already has one of the four target slices and the replacement has
been reviewed, opt in explicitly:

```bash
npx tsx scripts/seed-tenant-forum-config.ts \
  --tenant agpages \
  --file path/to/agpages-four-slice.json \
  --allow-overwrite
```

The script:

- accepts `--tenant <id-or-slug>` and `--file <json>`
- validates the file through `forumConfigSchema`
- requires all four slices: `follow_up`, `ai_persona`,
  `qualifying_questions`, `allowed_topics`
- preserves existing top-level tenant settings
- preserves existing non-target `forumConfig` keys such as `welcome`,
  `cta_rules`, `seo_defaults`, `connectors`, `limits` and `lead_capture`
- snapshots `tenants.settings` to `tmp/seed-snapshots/<tenantId>-<timestamp>.json`
  before writing
- re-reads the tenant after write and byte-diff verifies the seeded slices

Before applying:

1. **Validate locally.** Run the fixture test (see below) to confirm the JSON
   still passes the live schema. Run the seeder with `--dry-run` against the
   tenant before any write.
2. **Re-check the tenant's existing `forumConfig`** — these fixtures only
   replace the `follow_up` sub-block. The rest of the tenant's config
   (`ai_persona`, `cta_rules`, `seo_defaults`, etc.) must be preserved.
3. **Get review.** Per CON-159 acceptance criteria, both configs require Cam
   and Blake sign-off before they land on a live tenant.

---

## Running the fixture validator

```bash
npx tsx docs/forum-config-examples/__tests__/seed-configs.test.ts
```

The test loads both fixtures, parses them through `followUpSchema` (from
`src/lib/forum-config/schema.ts`), and asserts:

- Schema validation passes with zero errors
- Entity counts meet the CON-159 requirements
- Every rule's `capture_policy_id` and `contact_method_id` resolves to a
  defined entity
- **Strict dangling-destination rule:** every rule's `(case_type, routing_key)`
  pair has at least one matching destination, and every destination is used
  by at least one rule

---

## Field-by-field walkthrough

The `follow_up` block has four top-level entity arrays, plus a small set of
tenant-wide toggles. See the
[Configurable Follow-Up PRD](https://linear.app/convo-app-au/issue/CON-149)
§8–§10 for the full design rationale.

### Top-level toggles

| Field | Purpose |
| --- | --- |
| `enabled` | Master kill-switch for the whole follow-up engine. |
| `default_sensitivity` | `conservative` / `balanced` / `proactive` — sets the global threshold tuning. Per-rule `confidence_threshold` overrides. |
| `allow_staff_review_flags_without_visitor_interruption` | If `false`, the `flag_for_staff_review_without_interrupting_visitor` action is suppressed. |
| `persona_source` | Locked to `"qualifying"` in V1 — persona comes from the qualifying-questions block. |

### `contact_methods`

Pre-approved routes the bot can offer to a visitor. The rule engine picks
from this list when an action is `refer_to_approved_contact_method`.

- `type`: `email` / `phone` / `callback` / `url` / `form`. Email/phone require
  `value`; url/form require `url`; callback can use either.
- `label`: human-readable display string for the bot's response.
- `available_for`: which `case_type`s this method serves
  (`cx_support` / `lead`). The schema rejects a rule that references a method
  not available for the rule's `case_type`.

### `capture_policies`

A capture policy is a privacy-compliant contract: *"if we ask the visitor for
their details under this policy, here is what we collect, here is what we
tell them, and here is the privacy URL we link to."*

- `case_type`: `cx_support` or `lead`. Must match any rule that references
  this policy.
- `required_fields` / `optional_fields`: keys from the V1 field registry
  (`name`, `email`, `mobile`, `postcode`, `suburb`, `state`, `company`,
  `free_text_note`, `preferred_contact_method`) — plus any tenant-defined
  custom key.
- `privacy_notice`: the exact wording shown to the visitor at capture time.
  Keep it concise, Australian English, no exclamation marks.
- `privacy_policy_url`: link to the tenant's privacy policy.

### `rules`

The decision matrix. Each rule pairs a `when` condition block with an
`action`. Rules are evaluated server-side at conversation runtime; the
highest-priority matching rule wins.

- `when`: any combination of `persona_in`, `intent_in`, `topic_in`,
  `exclude_topics`, `sentiment_in`, `urgency_in`,
  `page_url_pattern`, `repeated_loop_count_gte`,
  `unanswered_confidence_lte`, `direct_human_request`, `location_in`,
  `product_or_service_in`. Empty `when: {}` matches every conversation.
- `action`: one of seven modes (`continue_helping`, `clarify_then_recheck`,
  `offer_follow_up`, `refer_to_approved_contact_method`,
  `capture_details_then_flag`,
  `flag_for_staff_review_without_interrupting_visitor`,
  `immediate_escalation`). The schema enforces an action→dependency matrix:
  e.g. `offer_follow_up` requires `capture_policy_id`,
  `refer_to_approved_contact_method` requires `contact_method_id`.
- `case_type`: must match any referenced capture policy.
- `confidence_threshold`: 0–1. Rule only fires when the bot's confidence in
  the trigger condition is at or above this value.
- `priority`: `low` / `normal` / `high`. Used for tie-breaking and operational
  routing.
- `routing_key`: free-form string that connects this rule to a `destination`.

### `destinations`

Where qualified outputs go. Each destination is a `(case_type, routing_key)`
pair pointing at a connector.

- `case_type`: `cx_support` or `lead`.
- `connector`: `webhook` (V1) or `csv_export` (V1).
- `routing_key`: matches the `routing_key` set on one or more rules.
- `config`: connector-specific (e.g. `url` for webhooks, plus free-form notes).

---

## Strict dangling-destination rule

CON-157 ships a schema-level check that every destination's `case_type`
must be referenced by at least one rule. CON-159 enforces a **stricter
contract in the fixture test**: every rule's `(case_type, routing_key)` pair
MUST have at least one matching destination, and every destination MUST be
used by at least one rule.

**Why stricter:** when Epic D ships actual webhook dispatch, a rule with no
matching destination becomes a silent drop — the conversation classified as a
lead, but nothing routed anywhere. The fixture test catches this in CI before
it can reach a tenant.

### How these fixtures handle their edge cases

- **AgPages — `marketplace_navigation_silent_flag`** routes to
  `cx_research`. We added a dedicated `agpages_cx_research_webhook`
  destination for this routing_key (rather than collapsing it into
  `cx_default`), so the silent staff-review flags land in a separate
  lower-priority queue. This exercises more of the schema and gives the ops
  team a cleaner triage surface.
- **Doggo — `breeder_listing_interest`** routes to `breeder_supply`. We added
  a dedicated `doggo_breeder_webhook` destination so breeder-side supply
  leads route to a separate onboarding/verification queue, distinct from
  buyer-side demand. Same exercise rationale.

---

## Extending these examples for a new tenant

1. Copy the fixture closest to the new tenant's shape (Doggo for simpler
   two-sided marketplaces; AgPages for richer rule sets).
2. Rewrite `contact_methods.value`/`url` and `capture_policies.privacy_*`
   for the new tenant. Match the live brand tone — Australian English,
   no exclamation marks, concise.
3. Update rule conditions for the new tenant's persona/intent vocabulary
   (these are tenant-defined strings — they line up with the qualifying
   questions and intent classifier output).
4. Update `destinations[].config.url` to the new tenant's webhook endpoints.
5. **Run the validator** — `npx tsx
   docs/forum-config-examples/__tests__/seed-configs.test.ts` after
   copying the file in.
6. Get Cam + Blake sign-off before applying to a live tenant.

---

## Related

- Schema: `src/lib/forum-config/schema.ts` ([CON-157](https://linear.app/convo-app-au/issue/CON-157))
- Read-only UI: Dashboard → Knowledge → Follow-up tab ([CON-158](https://linear.app/convo-app-au/issue/CON-158))
- Editor UI (V1.1): tracked under [CON-149](https://linear.app/convo-app-au/issue/CON-149) (parent epic)
- Epic A umbrella: [CON-150](https://linear.app/convo-app-au/issue/CON-150)
