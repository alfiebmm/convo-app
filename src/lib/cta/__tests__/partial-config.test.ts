/**
 * CON-201 — CTA resolver partial-config matrix.
 *
 * Verifies that a tenant whose forumConfig contains ONLY cta_rules
 * (no ai_persona, no seo_defaults) still gets their CTAs resolved
 * instead of being silently replaced by the empty default cta_rules
 * array.
 *
 * Run with: npx tsx src/lib/cta/__tests__/partial-config.test.ts
 */

import { resolveCta } from "../resolve";

let passCount = 0;
let failCount = 0;

function check(name: string, cond: boolean, detail?: string): void {
  if (cond) {
    passCount++;
    console.log(`  \u2713 ${name}`);
  } else {
    failCount++;
    console.error(`  \u2717 ${name}${detail ? `\n      ${detail}` : ""}`);
  }
}

const longAnswer =
  "Yes, our basic plan starts at $19 per month and includes unlimited conversations. " +
  "If you need more capacity or advanced features, we have higher tiers as well.";

console.log("CON-201 CTA resolver — partial config matrix");

// AC #3 — Tenant with only cta_rules.
{
  const tenantConfig = {
    forumConfig: {
      cta_rules: [
        {
          tag: "pricing",
          text: "See pricing",
          url: "https://convoapp.com.au/pricing",
          default: true,
        },
      ],
    },
  };
  const r = resolveCta({
    settings: tenantConfig,
    messages: [{ role: "user", content: "tell me about pricing" }],
    assistantResponse: longAnswer,
  });

  check(
    "tenant with ONLY cta_rules: CTA resolves (not silently wiped)",
    r.shouldEmit === true && r.cta !== null,
    `expected shouldEmit=true and cta non-null, got ${JSON.stringify(r)}`,
  );
  check(
    "tenant with ONLY cta_rules: URL comes from tenant rule",
    r.cta?.url === "https://convoapp.com.au/pricing",
    `expected tenant URL, got ${r.cta?.url}`,
  );
}

// AC #5 — Tenant with empty forumConfig.
{
  const r = resolveCta({
    settings: { forumConfig: {} },
    messages: [{ role: "user", content: "what's pricing like?" }],
    assistantResponse: longAnswer,
  });
  check(
    "empty forumConfig: no CTA emitted (defaults cta_rules = [])",
    r.shouldEmit === false && r.cta === null,
    `expected no emission, got ${JSON.stringify(r)}`,
  );
}

// AC #1/#2 cross-check — tenant with only ai_persona must not enable CTA.
{
  const r = resolveCta({
    settings: {
      forumConfig: {
        ai_persona: { tone: "expert" as const, voice_description: "v" },
      },
    },
    messages: [{ role: "user", content: "pricing?" }],
    assistantResponse: longAnswer,
  });
  check(
    "ai_persona-only config: no CTA (cta_rules slice = [] default)",
    r.shouldEmit === false && r.cta === null,
  );
}

// Mixed: tenant with cta_rules + qualifying_questions but no seo_defaults.
{
  const tenantConfig = {
    forumConfig: {
      cta_rules: [
        {
          tag: "demo",
          text: "Book a demo",
          url: "https://convoapp.com.au/demo",
          default: false,
        },
        {
          tag: "default",
          text: "Get started",
          url: "https://convoapp.com.au/start",
          default: true,
        },
      ],
      qualifying_questions: {
        preset: {
          question: "?",
          options: [{ label: "A", value: "a" }],
          persona_field: "p",
        },
        additional: [],
      },
    },
  };
  const r = resolveCta({
    settings: tenantConfig,
    messages: [{ role: "user", content: "I'd love to see a demo" }],
    assistantResponse: longAnswer,
  });
  check(
    "mixed partial config (cta_rules + qualifying_questions): demo rule matches",
    r.cta?.url === "https://convoapp.com.au/demo",
    `expected demo URL, got ${r.cta?.url}`,
  );
}

// Regression guard: a tenant who has been through the editor (ai_persona +
// qualifying_questions + allowed_topics + follow_up) but has cta_rules
// disabled must not get phantom CTAs.
{
  const r = resolveCta({
    settings: {
      forumConfig: {
        ai_persona: { tone: "friendly" as const, voice_description: "v" },
        qualifying_questions: {
          preset: {
            question: "?",
            options: [{ label: "A", value: "a" }],
            persona_field: "p",
          },
          additional: [],
        },
        allowed_topics: ["a"],
      },
    },
    messages: [{ role: "user", content: "pricing?" }],
    assistantResponse: longAnswer,
  });
  check(
    "editor-shape config without cta_rules: no CTA emitted",
    r.shouldEmit === false && r.cta === null,
  );
}

console.log(`\n${"─".repeat(32)}`);
console.log(`${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
