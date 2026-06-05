/**
 * CON-95 — Lead Capture unit tests
 *
 * Runs the pure detection / merge helpers against fixtures. No DB calls.
 *
 * Invoke: `tsx scripts/test-leads.ts`
 */

import {
  extractExplicitContact,
  hasExplicitContact,
} from "../src/lib/leads/extract";
import {
  scoreIntent,
  hasCommercialIntent,
  DEFAULT_KEYWORDS,
} from "../src/lib/leads/intent";
import { classifyMessage, mergeLead } from "../src/lib/leads/capture";
import type { ConversationLead } from "../src/lib/leads/types";

let pass = 0;
let fail = 0;

function eq<T>(label: string, got: T, want: T) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) {
    pass += 1;
    console.log(`  \u2713 ${label}`);
  } else {
    fail += 1;
    console.log(`  \u2717 ${label}`);
    console.log(`      got:  ${JSON.stringify(got)}`);
    console.log(`      want: ${JSON.stringify(want)}`);
  }
}

function truthy(label: string, got: unknown) {
  if (got) {
    pass += 1;
    console.log(`  \u2713 ${label}`);
  } else {
    fail += 1;
    console.log(`  \u2717 ${label} (falsy)`);
  }
}

function falsy(label: string, got: unknown) {
  if (!got) {
    pass += 1;
    console.log(`  \u2713 ${label}`);
  } else {
    fail += 1;
    console.log(`  \u2717 ${label} (truthy)`);
  }
}

// ───────────────────────────────────────────────────────────────────────
console.log("\n[Extract] email");
eq(
  "lowercased plain email",
  extractExplicitContact("Reach me at Jane@Example.com please").email,
  "jane@example.com"
);
eq(
  "skips fake-looking tokens",
  extractExplicitContact("just an @ sign").email,
  null
);
eq(
  "subdomain + plus tag",
  extractExplicitContact("contact: test+lead@mail.acme.com.au").email,
  "test+lead@mail.acme.com.au"
);
eq(
  "no false-positive on bare 'foo at bar'",
  extractExplicitContact("send to foo at bar").email,
  null
);

console.log("\n[Extract] phone");
eq(
  "AU mobile spaced",
  extractExplicitContact("call 0412 345 678").phone,
  "0412 345 678"
);
eq(
  "AU +61 mobile",
  extractExplicitContact("ring +61 412 345 678").phone,
  "+61 412 345 678"
);
eq(
  "AU landline",
  extractExplicitContact("Office: 02 9999 0000").phone,
  "02 9999 0000"
);
eq("rejects short digits", extractExplicitContact("PIN 12345").phone, null);
eq(
  "rejects 'number 7 special'",
  extractExplicitContact("the number 7 special is great").phone,
  null
);

console.log("\n[Extract] name");
eq(
  "my name is X",
  extractExplicitContact("Hi, my name is Jane Smith").name,
  "Jane Smith"
);
eq("I'm X", extractExplicitContact("Hey, I'm Marcus").name, "Marcus");
eq(
  "denylist filter",
  extractExplicitContact("I'm Australian").name,
  null
);
eq(
  "no name when unprompted",
  extractExplicitContact("Looking for help with pricing").name,
  null
);

console.log("\n[Extract] hasExplicitContact");
truthy("email present", hasExplicitContact("hello at jane@a.com"));
falsy("benign", hasExplicitContact("how are you"));

// ───────────────────────────────────────────────────────────────────────
console.log("\n[Intent] keyword scoring");
eq("pricing hit", scoreIntent("what's the price?").matched, ["pricing"]);
eq(
  "multi-category",
  scoreIntent("can I book a demo and get a quote?").matched.sort(),
  ["booking", "pricing"]
);
eq("benign", scoreIntent("just looking around").matched, []);
truthy("commercial threshold", hasCommercialIntent("can you call me back?"));
falsy("benign threshold", hasCommercialIntent("hello there"));

console.log("\n[Intent] tenant overrides");
eq(
  "override replaces defaults",
  scoreIntent("how much for a widget?", { pricing: ["widget"] }).matched,
  ["pricing"]
);

console.log("\n[Intent] default coverage sanity");
truthy("defaults shape", DEFAULT_KEYWORDS.pricing.length > 5);

// ───────────────────────────────────────────────────────────────────────
console.log("\n[Classify] message routing");
{
  const c = classifyMessage("My email is foo@bar.com and I want pricing");
  eq(
    "detections includes email + voluntary + intent",
    c.detections.sort(),
    ["explicit_email", "intent_keyword", "voluntary_contact"]
  );
  eq("contact.email captured", c.contact.email, "foo@bar.com");
  eq("intent pricing", c.intents, ["pricing"]);
}
{
  const c = classifyMessage("Can someone call me back?");
  eq(
    "intent only - no explicit",
    c.detections,
    ["intent_keyword"]
  );
  eq("no email", c.contact.email, null);
}
{
  const c = classifyMessage("how is the weather today");
  eq("no signal", c.detections, []);
}

// ───────────────────────────────────────────────────────────────────────
console.log("\n[Merge] idempotent merge");
const baseLead: ConversationLead = {
  capturedAt: "2026-05-31T00:00:00.000Z",
  status: "open",
  detection: ["explicit_email", "voluntary_contact"],
  intentSignals: ["pricing"],
  contact: { name: null, email: "first@a.com", phone: null },
  summary: null,
};

{
  const fresh = classifyMessage("Also call 0412 345 678");
  const m = mergeLead(baseLead, fresh, "2026-05-31T00:01:00.000Z");
  eq("preserves first email", m.merged.contact.email, "first@a.com");
  eq("adds phone", m.merged.contact.phone, "0412 345 678");
  eq(
    "adds new detections only",
    m.newDetections.sort(),
    ["explicit_phone"].sort()
  );
  // voluntary_contact already present in baseLead.detection so it should
  // NOT appear in newDetections.
  falsy(
    "voluntary_contact not double-counted",
    m.newDetections.includes("voluntary_contact")
  );
}

{
  const fresh = classifyMessage("Hello again");
  const m = mergeLead(baseLead, fresh, "2026-05-31T00:02:00.000Z");
  eq("no new detections", m.newDetections, []);
  eq("no new intents", m.newIntents, []);
}

// ───────────────────────────────────────────────────────────────────────
console.log(`\nResult: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
