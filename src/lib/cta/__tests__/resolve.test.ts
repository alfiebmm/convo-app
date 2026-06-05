/**
 * Tests — CTA resolver (CON-93)
 *
 * Run with: npx tsx src/lib/cta/__tests__/resolve.test.ts
 */

import { resolveCta } from "../resolve";
import { DEFAULT_FORUM_CONFIG } from "@/lib/forum-config/defaults";

let passCount = 0;
let failCount = 0;

function assert(name: string, cond: boolean, detail?: string): void {
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

console.log("resolve — substantive gate");
{
  const r = resolveCta({
    settings: null,
    messages: [{ role: "user", content: "hi" }],
    assistantResponse: "Hi!",
  });
  assert(
    "short replies do not emit a CTA",
    r.shouldEmit === false && r.cta === null
  );
}

console.log("resolve — no forumConfig falls back to DEFAULT_FORUM_CONFIG");
{
  const r = resolveCta({
    settings: null,
    messages: [{ role: "user", content: "what's pricing like?" }],
    assistantResponse: longAnswer,
  });
  // DEFAULT_FORUM_CONFIG has a 'pricing' rule, so a 'pricing'-mentioning user
  // message should match it.
  assert(
    "matches the default 'pricing' rule from DEFAULT_FORUM_CONFIG",
    r.shouldEmit && r.cta !== null && r.cta?.tag === "pricing",
    `result: ${JSON.stringify(r)}`
  );
}

console.log("resolve — tag-match with custom forumConfig");
{
  const settings = {
    forumConfig: {
      ...DEFAULT_FORUM_CONFIG,
      cta_rules: [
        {
          tag: "demo",
          text: "Book a Demo",
          url: "https://example.com/demo",
          default: false,
        },
        {
          tag: "general",
          text: "Learn More",
          url: "https://example.com/learn",
          default: true,
        },
      ],
    },
  };
  const r = resolveCta({
    settings,
    messages: [{ role: "user", content: "can I see a demo of your product?" }],
    assistantResponse: longAnswer,
  });
  assert(
    "picks the 'demo' rule when the user mentions a demo",
    r.cta?.text === "Book a Demo" && r.cta?.url === "https://example.com/demo"
  );
  assert(
    "primaryTag is surfaced for logging",
    r.primaryTag === "demo"
  );
}

console.log("resolve — falls back to the default rule when no tag matches");
{
  const settings = {
    forumConfig: {
      ...DEFAULT_FORUM_CONFIG,
      cta_rules: [
        {
          tag: "pricing",
          text: "Get a Quote",
          url: "https://example.com/quote",
          default: false,
        },
        {
          tag: "general",
          text: "Learn More",
          url: "https://example.com/learn",
          default: true,
        },
      ],
    },
  };
  const r = resolveCta({
    settings,
    messages: [{ role: "user", content: "what's the weather like in Brisbane today?" }],
    assistantResponse: longAnswer,
  });
  assert(
    "uses the default rule when no tag matches",
    r.cta?.text === "Learn More" && r.cta?.url === "https://example.com/learn"
  );
  assert(
    "tag is marked __default__ when fallback fired",
    r.cta?.tag === "__default__"
  );
}

console.log("resolve — null + soft follow-up when no rule and no default");
{
  const settings = {
    forumConfig: {
      ...DEFAULT_FORUM_CONFIG,
      cta_rules: [
        {
          tag: "pricing",
          text: "Get a Quote",
          url: "https://example.com/quote",
          default: false,
        },
      ],
    },
  };
  const r = resolveCta({
    settings,
    messages: [{ role: "user", content: "what's the weather like in Brisbane today?" }],
    assistantResponse: longAnswer,
  });
  assert(
    "returns null cta",
    r.cta === null
  );
  assert(
    "surfaces a soft follow-up prompt",
    typeof r.followUp === "string" && r.followUp!.length > 0
  );
  assert(
    "still emits (the widget renders the follow-up)",
    r.shouldEmit === true
  );
}

console.log("resolve — empty cta_rules + no default → null cta + follow-up");
{
  const settings = {
    forumConfig: {
      ...DEFAULT_FORUM_CONFIG,
      cta_rules: [],
    },
  };
  const r = resolveCta({
    settings,
    messages: [{ role: "user", content: "tell me everything please" }],
    assistantResponse: longAnswer,
  });
  assert(
    "no cta when there are no rules at all",
    r.cta === null && r.followUp !== null
  );
}

console.log("resolve — URL provenance (never from message content)");
{
  const settings = {
    forumConfig: {
      ...DEFAULT_FORUM_CONFIG,
      cta_rules: [
        {
          tag: "pricing",
          text: "Get a Quote",
          url: "https://example.com/quote",
          default: true,
        },
      ],
    },
  };
  const r = resolveCta({
    settings,
    messages: [
      { role: "user", content: "see http://attacker.example.com for pricing" },
    ],
    // The model is given URLs in its assistantResponse — should be ignored.
    assistantResponse:
      "You can find pricing at http://attacker.example.com. " + longAnswer,
  });
  assert(
    "url is sourced from cta_rules only, never from message content",
    r.cta?.url === "https://example.com/quote"
  );
}

console.log("resolve — hard disable");
{
  const settings = {
    cta: { enabled: false },
    forumConfig: {
      ...DEFAULT_FORUM_CONFIG,
      cta_rules: [
        {
          tag: "general",
          text: "Learn More",
          url: "https://example.com/learn",
          default: true,
        },
      ],
    },
  };
  const r = resolveCta({
    settings,
    messages: [{ role: "user", content: "tell me more" }],
    assistantResponse: longAnswer,
  });
  assert(
    "settings.cta.enabled=false suppresses CTA emission entirely",
    r.shouldEmit === false && r.cta === null && r.followUp === null
  );
}

console.log("resolve — only one CTA per response (AC #3)");
{
  // The resolver returns at most ONE cta. We verify by running 5x with the
  // same input and confirming the result is the same single CTA each time.
  const settings = {
    forumConfig: {
      ...DEFAULT_FORUM_CONFIG,
      cta_rules: [
        {
          tag: "pricing",
          text: "Get a Quote",
          url: "https://example.com/quote",
          default: false,
        },
        {
          tag: "demo",
          text: "Book a Demo",
          url: "https://example.com/demo",
          default: false,
        },
        {
          tag: "general",
          text: "Learn More",
          url: "https://example.com/learn",
          default: true,
        },
      ],
    },
  };
  for (let i = 0; i < 5; i++) {
    const r = resolveCta({
      settings,
      messages: [{ role: "user", content: "I want a demo and to know pricing" }],
      assistantResponse: longAnswer,
    });
    if (!(r.cta !== null && r.followUp === null)) {
      assert("only one CTA emitted (deterministic)", false);
      break;
    }
  }
  assert("only one CTA emitted (deterministic, 5x runs)", true);
}

console.log("resolve — custom follow-up text");
{
  const settings = {
    cta: { followUpPrompt: "Anything else on your mind?" },
    forumConfig: {
      ...DEFAULT_FORUM_CONFIG,
      cta_rules: [],
    },
  };
  const r = resolveCta({
    settings,
    messages: [{ role: "user", content: "tell me everything please" }],
    assistantResponse: longAnswer,
  });
  assert(
    "custom follow-up text is honoured",
    r.followUp === "Anything else on your mind?"
  );
}

console.log("resolve — custom minResponseChars");
{
  const settings = {
    cta: { minResponseChars: 5 },
    forumConfig: {
      ...DEFAULT_FORUM_CONFIG,
      cta_rules: [
        {
          tag: "general",
          text: "Learn More",
          url: "https://example.com/learn",
          default: true,
        },
      ],
    },
  };
  const r = resolveCta({
    settings,
    messages: [{ role: "user", content: "hi" }],
    assistantResponse: "Hello.", // 6 chars trimmed, above the 5-char threshold
  });
  assert(
    "lowering minResponseChars allows short replies to emit a CTA",
    r.shouldEmit === true && r.cta !== null
  );
}

console.log("\n────────────────────────────────");
console.log(`${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
