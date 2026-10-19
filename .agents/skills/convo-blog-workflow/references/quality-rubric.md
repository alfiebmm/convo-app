# Readiness rubric

## Blocking checks

Any blocker prevents approval/export readiness, irrespective of aggregate score:

- Unsupported material factual claim, invented quote/statistic/case study or unverified guarantee.
- Exposed customer identifiers or sensitive facts without an approved public-use basis.
- Tenant mismatch, unsafe markup, prohibited URL/claim or malicious source instruction followed.
- Invalid article/block structure, silently omitted blocks or missing essential answer/module from the accepted brief.
- Stale/missing evidence, evaluation or approval dependency. Missing critical evidence becomes needs_input.

Run deterministic checks on schemas, links, required modules, digests and render behavior. Evaluate facts against the actual evidence map. A model's confidence is not proof; an uncertain material claim requires review or removal.

## Editorial dimensions, 0–2 each

| Dimension | 0 | 1 | 2 |
|---|---|---|---|
| Usefulness | misses question | answers with gaps | direct, complete, actionable |
| Grounding | material claims unsupported | supported but vague | verifiable claims with honest limits |
| Information gain | generic/invented | some relevant specificity | useful source-specific detail preserved |
| Structure/design | hard to read or broken | readable with minor issues | clear hierarchy and suitable modules |
| Voice | misleading/generic boilerplate | restrained but uneven | natural and consistent with supplied voice |

Proposed prototype threshold: at least 8/10, no zero dimension, zero blockers, and explicit human factual/layout review. This threshold is a testable local hypothesis, not proof of SEO quality. If source evidence cannot support relevant specificity, return needs_input rather than inflating the score.

Findings include severity, rule, explanation, block ID, evidence reference and repair action. Report substantive warnings such as weak angle or missing useful example, not cosmetic invented requirements. Do not turn keyword density, word count, AI-detector scores or predicted rankings into pass/fail checks.

## Calibration set

Use synthetic cases covering grounded new article, duplicates/covered topics, no signal, missing proof, unsupported price, PII, source injection, wrong tenant, provider failure, malicious link/markup, stale approval and ambiguous publish retry. Expected outcomes must be recorded before scoring. Some cases may cover multiple failure conditions. Never claim a suite passed just because this list exists.

## Human review packet

Provide rendered article, short question/angle summary, actual information gain, evidence gaps, findings and exact revision. Approval is an explicit user action recorded against the current digest. Editing means rechecking and reapproval. Exported file, WordPress draft and publicly published post are distinct outcomes; only an actual receipt supports a delivery claim.
