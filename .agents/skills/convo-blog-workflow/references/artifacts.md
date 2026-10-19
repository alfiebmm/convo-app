# Portable artifact contract

The application repository's current schema takes precedence. These are semantic requirements for standalone work and a checklist for application adapters, not a second competing database design.

## Common envelope

Each artifact has schema/workflow version, stable tenant/project/run identity, unique artifact ID and revision, timestamp, input artifact IDs/revisions, input digest and status (`complete`, `needs_input`, `failed`). Generated outputs also record model/prompt version when known. Do not record credentials or unnecessary raw chat.

Suggested standalone file set:

1. `01-decision.json`: redacted customer question, intent, action/reason, matched existing content.
2. `02-research.json`: provider/mode/query/locale/time, keywords/metrics, SERP observations, inferred questions, gaps, sources and missing data.
3. `03-brief.md` plus structured metadata: reader, angle, outline, required modules, evidence/claim map, approved links/CTA and input versions.
4. `04-article.json`: title/meta/slug, supported structured blocks, evidence references and dependency versions.
5. `05-information-gain.json`: source detail → block mapping, omitted useful evidence and needs-input questions.
6. `06-evaluation.json`: article digest, rule/criterion, severity, finding, block ID, evidence reference and human-review status.
7. `07-review.md`: rendered-preview location, explicit approval actor/time/digest or outstanding issues. Never fabricate an approver.
8. `08-export-receipt.json`: format, content digest, destination, request ID/time, actual response status and remote ID if applicable.

Use JSON for machine fields and Markdown for human narrative; preserve existing repository conventions rather than requiring these exact filenames in production.

## Provenance

- `tenant_fact`: approved tenant KB/source supports the specific claim.
- `observed_research`: a provider/page actually returned this observation; keep URL/query/time.
- `manual_evidence`: supplied human research; retain attribution and unknowns.
- `inferred`: a proposed question/angle/gap, not measured search behavior.

Competitor copy does not prove tenant pricing, services, qualifications or outcomes. Style samples do not substantiate facts. A visitor allegation is not a verified tenant fact.

## Freshness and repeatability

Changing article content invalidates evaluation/approval/export readiness. Changing upstream strategy/research/brief invalidates dependent drafts and checks. Preserve old revisions with clear stale status. Exact-input retries can reuse outputs only within the same tenant and workflow version. Use durable concurrency controls in an application; files alone are not a production orchestrator.

## Failure handoff

Report stage, reason, last successful artifact, uncertainty, attempted repairs and smallest next input/action. Unknown external request outcome requires reconciliation. Do not delete evidence to make the run look complete.
