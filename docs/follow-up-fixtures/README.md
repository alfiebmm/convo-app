# Follow-up tuning fixtures (CON-168, Epic C4)

Regression corpus for the deterministic follow-up rule evaluator
(`resolveAction` — CON-166) and, optionally, the structured LLM classifier
(`classifyConversation` — CON-165).

```
docs/follow-up-fixtures/
├── doggo/       25 fixtures (10 lead, 10 cx, 5 negative)
├── agpages/     30 fixtures (15 lead, 10 cx, 5 negative)
└── README.md
```

The harness lives at `scripts/follow-up-harness.ts`. It loads each tenant's
follow-up config from `docs/forum-config-examples/{tenant}-follow-up.json`
(do **not** duplicate config in fixtures) and replays each fixture against
the rule evaluator.

## Running the harness

### Mocked mode (default — fast, free, CI-safe)

```bash
npx tsx scripts/follow-up-harness.ts                     # all 55 fixtures
npx tsx scripts/follow-up-harness.ts --tenant doggo      # just Doggo
npx tsx scripts/follow-up-harness.ts --tenant agpages    # just AgPages
npx tsx scripts/follow-up-harness.ts --filter "cx-01"    # regex filter on filename or name
npx tsx scripts/follow-up-harness.ts --verbose           # print full ResolvedAction
```

Mocked mode reads each fixture's `mock_classifier_output` and runs it
through `resolveAction()`. No OpenAI call, no network. The harness exits
non-zero on any failure, so it can drive CI.

### Live mode (slow — costs OpenAI tokens)

```bash
npx tsx scripts/follow-up-harness.ts --live --filter "doggo-lead-01"
```

Live mode IGNORES `mock_classifier_output` and calls the real classifier
against the fixture's `messages`. Asserts only that the resolved action
**type** matches `expected.action` — the underlying classifier output isn't
required to byte-match the mock (model variation is tolerated). Use to
catch classifier-prompt regressions.

**Do not put `--live` in CI** — every fixture is a paid OpenAI call.

## Fixture shape

```jsonc
{
  "name": "Human-readable label",
  "tenant": "doggo" | "agpages",
  "messages": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ],
  "page_url": "https://...",         // optional — used by page_url_pattern rules
  "qualifying_persona": {            // optional — CON-94 carry-forward; OR-companion to classifier persona_in
    "persona": "customer"
  },
  "mock_classifier_output": {        // replayed in mocked mode
    "classifier_version": "v1",
    "attributes": {
      "persona": "customer",
      "intent": "request_quote",
      "topic": "labrador pricing",
      "sentiment": "neutral",
      "urgency": "low",
      "marketplace_side": "demand",
      "location": null,
      "product_or_service": "labrador puppy",
      "spam_risk": "low"
    },
    "support_need":      {"detected": false, "confidence": 0.0, "reason": null},
    "commercial_intent": {"detected": true,  "confidence": 0.92, "reason": "..."},
    "missing_fields": [],
    "direct_human_request": false,
    "repeated_loop_count": 0,
    "unanswered_confidence": 0.6
  },
  "expected": {
    "action": "capture_details_then_flag",   // required — one of 7 ResolvedAction types
    "case_type": "lead",                     // optional — "lead" | "cx_support" | null (for default action)
    "rule_id": "buyer_pricing_or_availability",  // optional — assert specific rule fired
    "routing_key": "buyer_demand",           // optional
    "attributes": {                          // optional — must be a subset of the matched evidence
      "intent": "request_quote"              // only assert attributes the matched rule's `when` block consults
    },
    "min_confidence": 0.75                   // optional — lower bound on ResolvedAction.confidence
  },
  "notes": "Optional one-liner explaining what this fixture is testing."
}
```

### What `expected.attributes` actually asserts

The resolver records only the classifier attributes a rule's `when` block
*consulted* into `evidence.matched_attributes`. So:

- A rule with `when: { intent_in: ["request_quote"] }` records `intent`
  but **not** `persona`. Asserting `persona` in `expected.attributes`
  will fail.
- A rule with `when: { persona_in: [...], intent_in: [...] }` records
  both `persona` and `intent`.
- Boolean / numeric matchers (`direct_human_request`, `repeated_loop_count_gte`,
  `unanswered_confidence_lte`) also land in matched_attributes.

When writing a new fixture, check `src/lib/follow-up/resolver.ts`
`evaluateConditions()` to know which keys the rule's `when` block records.

## Mock authoring guide

The mock represents what `gpt-4o-mini` *would* output for the given
messages. You don't need to be perfect — you need to be plausible and
consistent. Some patterns from this initial corpus:

- **High-intent lead (pricing / availability):** set
  `commercial_intent.confidence ≥ 0.80`, `commercial_intent.detected: true`,
  pick `persona: "customer"`, pick the matching `intent` enum,
  `marketplace_side: "demand"`, low `support_need`, mid
  `unanswered_confidence` (~0.5).
- **Supply-side partner/supplier:** `persona: "partner"`/`"supplier"`,
  `intent: "offer_service"` / `"become_partner"`,
  `marketplace_side: "supply"`, `commercial_intent ≥ 0.70`.
- **Direct human request:** `direct_human_request: true`,
  `support_need.confidence ≥ 0.85`. The resolver overrides rule confidence
  to 1.0 for this signal (see `computeRuleConfidence`).
- **Frustrated visitor (AgPages only — Doggo seed lacks the rule):**
  `sentiment: "frustrated"`/`"angry"`, `urgency: "high"`,
  `support_need.confidence ≥ 0.7`.
- **Navigation loop:** `intent: "site_navigation"`,
  `repeated_loop_count ≥ 2`, mid `support_need`. Include a `page_url`.
- **Low-confidence unanswered:** `unanswered_confidence ≤ 0.4`. Catches
  the "bot is stumped" fallback path.
- **Negative (`continue_helping`):** keep `unanswered_confidence ≥ 0.7`,
  `direct_human_request: false`, `support_need.confidence < 0.5`,
  `commercial_intent.confidence < 0.7`, `repeated_loop_count < 2`.

If a fixture suddenly starts failing after a classifier prompt change,
that's the *point* — the harness has caught a regression. Either:

1. The prompt change is intended and the mock needs updating (and `--live`
   should confirm). Update the mock.
2. The prompt change is unintended (regression). Revert.

## Adding a new fixture

1. Pick a unique filename: `{tenant}-{lead|cx|neg}-NN-short-slug.json`.
   Filenames are sorted lexically by the harness — keep the NN ordering
   so new entries land at the end of a category.
2. Drop it in `docs/follow-up-fixtures/{doggo,agpages}/`.
3. Run `npx tsx scripts/follow-up-harness.ts --filter "<your-filename>"`
   to confirm it passes.
4. If you intend it to fail (red-team regression), it should fail before
   the corresponding rule or prompt change lands and pass after.
5. Optionally smoke with `--live --filter "<filename>"` to confirm the
   live classifier actually produces a compatible output.

## When to re-run after prompt changes

- **Always:** mocked mode, full corpus
  (`npx tsx scripts/follow-up-harness.ts`).
- **Recommended:** spot-check 2–3 fixtures per category in live mode
  (`--live --filter "..."`). Don't run the full corpus live unless you're
  doing a major prompt overhaul — it's ~55 OpenAI calls per run.
- **If a fixture's mock no longer matches live output:** update the mock,
  re-run mocked mode to confirm the resolver outcome is still correct,
  commit the new mock alongside the prompt change.

## Coverage breakdown

### Doggo (25)

| Category | Count | Expected actions |
|---|---|---|
| Lead — buyer pricing / availability | 3 | `capture_details_then_flag` (buyer_pricing_or_availability) |
| Lead — buyer callback / contact | 2 | `capture_details_then_flag` × 1, `immediate_escalation` × 1 (explicit-human override) |
| Lead — breeder partnership | 2 | `refer_to_approved_contact_method` (breeder_listing_interest) |
| Lead — multi-turn research→ask | 2 | `capture_details_then_flag` (turn 2 fires) |
| Lead — voluntary contact-info edge | 1 | `capture_details_then_flag` |
| CX — direct human request | 2 | `immediate_escalation` |
| CX — low-confidence unanswered | 2 | `offer_follow_up` |
| CX — frustrated / angry | 2 | `offer_follow_up` via low_confidence_unanswered fallback (Doggo seed lacks `frustrated_visitor` — V1.1 follow-up) |
| CX — repeated navigation loop | 2 | `flag_for_staff_review_without_interrupting_visitor` |
| CX — account / listing problem | 2 | `immediate_escalation` × 1, `offer_follow_up` × 1 |
| Negative | 5 | `continue_helping` |

### AgPages (30)

| Category | Count | Expected actions |
|---|---|---|
| Lead — farmer requesting contractor | 4 | `capture_details_then_flag` (farmer_service_request) |
| Lead — contractor offering availability | 3 | `refer_to_approved_contact_method` (contractor_availability_signal) |
| Lead — farmer seeking equipment / services | 3 | `capture_details_then_flag` |
| Lead — location-specific service enquiry | 3 | `capture_details_then_flag` |
| Lead — multi-turn research→ask | 2 | `capture_details_then_flag` |
| CX — direct human request | 2 | `immediate_escalation` |
| CX — low-confidence unanswered | 2 | `offer_follow_up` |
| CX — frustrated visitor | 2 | `offer_follow_up` via frustrated_visitor (high priority) |
| CX — navigation loop | 2 | `flag_for_staff_review_without_interrupting_visitor` |
| CX — listing problem | 2 | `offer_follow_up` |
| Negative | 5 | `continue_helping` |

## CI integration (out of scope for CON-168, flagged for follow-up)

The harness exits non-zero on any failure, so adding it to CI is one
line in `package.json`:

```jsonc
"scripts": {
  "test:follow-up": "tsx scripts/follow-up-harness.ts"
}
```

…then wire `npm run test:follow-up` into the CI pipeline alongside
`npm run lint` and `npm run build`. Tracked as a CON follow-up ticket.
