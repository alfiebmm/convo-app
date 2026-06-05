/**
 * Tests — CTA primary-tag classifier (CON-93)
 *
 * Run with: npx tsx src/lib/cta/__tests__/classify.test.ts
 */

import { classifyPrimaryTag } from "../classify";

let passCount = 0;
let failCount = 0;

function assertEq<T>(name: string, actual: T, expected: T): void {
  const ok = Object.is(actual, expected);
  if (ok) {
    passCount++;
    console.log(`  \u2713 ${name}`);
  } else {
    failCount++;
    console.error(`  \u2717 ${name}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`);
  }
}

console.log("classify — empty inputs");
assertEq(
  "returns null when there are no candidate tags",
  classifyPrimaryTag(
    [{ role: "user", content: "tell me about pricing" }],
    []
  ),
  null
);
assertEq(
  "returns null when there are no messages",
  classifyPrimaryTag([], ["pricing", "general"]),
  null
);
assertEq(
  "returns null when there are no user messages",
  classifyPrimaryTag(
    [{ role: "assistant", content: "I can help with pricing" }],
    ["pricing", "general"]
  ),
  null
);

console.log("classify — single keyword match");
assertEq(
  "picks the matching tag when only one keyword fires",
  classifyPrimaryTag(
    [{ role: "user", content: "what's your pricing like?" }],
    ["pricing", "general", "support"]
  ),
  "pricing"
);

console.log("classify — recency boost");
assertEq(
  "the most recent message dominates older context",
  classifyPrimaryTag(
    [
      { role: "user", content: "I need support with my account" },
      { role: "assistant", content: "happy to help" },
      { role: "user", content: "actually what about pricing?" },
    ],
    ["support", "pricing"]
  ),
  "pricing"
);

console.log("classify — tiebreak by tenant-specified order");
assertEq(
  "when scores tie, the tag listed first in the candidate array wins",
  classifyPrimaryTag(
    [
      { role: "user", content: "I'm looking for both pricing and support" },
    ],
    ["support", "pricing"]
  ),
  // Both score 2 (whole-word + recency boost). 'support' is first in the array.
  "support"
);

console.log("classify — whole-word matching (no substring drift)");
assertEq(
  "does not match a tag that appears only as part of a larger word",
  classifyPrimaryTag(
    [{ role: "user", content: "the response was unsupportable" }],
    ["support"]
  ),
  null
);

console.log("classify — punctuation tolerance");
assertEq(
  "ignores trailing punctuation around a candidate tag in the user message",
  classifyPrimaryTag(
    [{ role: "user", content: "is the pricing fair?" }],
    ["pricing"]
  ),
  "pricing"
);

console.log("classify — hyphenated tag tokens");
assertEq(
  "matches 'free trial' when the tag is 'free-trial'",
  classifyPrimaryTag(
    [{ role: "user", content: "do you offer a free trial?" }],
    ["free-trial", "general"]
  ),
  "free-trial"
);

console.log("classify — plural singularisation");
assertEq(
  "matches singular 'feature' when the tag is 'features'",
  classifyPrimaryTag(
    [{ role: "user", content: "tell me about the feature" }],
    ["features"]
  ),
  "features"
);

console.log("classify — case insensitivity");
assertEq(
  "uppercase user input still matches a lowercase tag",
  classifyPrimaryTag(
    [{ role: "user", content: "PRICING please" }],
    ["pricing"]
  ),
  "pricing"
);

console.log("classify — multiple tags scored across recent messages");
assertEq(
  "the higher-frequency tag across recent messages wins",
  classifyPrimaryTag(
    [
      { role: "user", content: "pricing question first" },
      { role: "assistant", content: "ok" },
      { role: "user", content: "another pricing question" },
      { role: "assistant", content: "noted" },
      { role: "user", content: "and one more support thing" },
    ],
    ["pricing", "support"]
  ),
  // pricing: 1 (msg1) + 1 (msg3) = 2. support: latest with boost = 2. Tie -> orderIndex wins.
  "pricing"
);

console.log("\n────────────────────────────────");
console.log(`${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
