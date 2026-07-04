#!/usr/bin/env node
/**
 * CON-192 — buildSystemPrompt precedence tests.
 * CON-204 — legacy `guardrails.topicBoundaries.allow` branch removed from
 * the allowed-topics union; only forumConfig.allowed_topics and
 * widget.allowedTopics feed the prompt now.
 *
 *   npx tsx src/lib/guardrails/__tests__/build-system-prompt.test.ts
 *
 * Coverage:
 *   - forumConfig.ai_persona.voice_description wins over every legacy source
 *   - guardrails.audiences[detected].persona used when forumConfig empty
 *   - widget.systemPrompt used when neither forumConfig nor audiences exist
 *   - settings.persona / settings.systemPrompt used as deepest fallback
 *   - default tenant prose used when nothing is configured
 *   - allowed topics: forumConfig + widget unioned + deduped
 *   - CON-204 regression: tenant with ONLY legacy topicBoundaries.allow
 *     set → prompt's allowed-topics list is empty (intended new behaviour)
 *   - strict backwards-compat: legacy-only tenant gets exact same prompt
 *     it would have got pre-CON-192 (no spurious empty Topic Boundaries
 *     section).
 */
import { buildSystemPrompt, type TenantForGuardrails } from "../../guardrails";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`OK ${name}`);
    passed++;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`FAIL ${name}`);
    console.log(`  ${message}`);
    failed++;
  }
}

function assert(cond: unknown, label: string) {
  if (!cond) throw new Error(label);
}

const NAME = "Acme";
const DOMAIN = "acme.com.au";

function tenant(settings: Record<string, unknown>): TenantForGuardrails {
  return { name: NAME, domain: DOMAIN, settings };
}

// ─── forumConfig persona wins ───────────────────────────────

test("forumConfig.voice_description wins over widget.systemPrompt (no audiences)", () => {
  const prompt = buildSystemPrompt(
    tenant({
      forumConfig: {
        ai_persona: { voice_description: "FORUM VOICE" },
      },
      widget: { systemPrompt: "WIDGET PROMPT" },
    }),
    {},
  );
  assert(prompt.includes("FORUM VOICE"), "forum voice present");
  assert(!prompt.includes("WIDGET PROMPT"), "widget prompt suppressed");
});

test("forumConfig.voice_description wins over audience.persona (with audiences)", () => {
  const prompt = buildSystemPrompt(
    tenant({
      forumConfig: {
        ai_persona: { voice_description: "FORUM VOICE FROM TAB" },
      },
      guardrails: {
        audiences: [
          {
            id: "default",
            name: "Visitor",
            urlPatterns: ["*"],
            persona: "AUDIENCE PERSONA",
            ctaMessages: [],
            ctaAfterTurns: 5,
          },
        ],
        topicBoundaries: { deflect: [], hardBlock: [] },
        conversationLimits: { maxTurnsBeforeCTA: 5, idleTimeoutMinutes: 10 },
      },
    }),
    { pageUrl: "https://acme.com.au/" },
  );
  assert(prompt.includes("FORUM VOICE FROM TAB"), "forum wins");
  assert(!prompt.includes("AUDIENCE PERSONA"), "audience suppressed");
});

test("forumConfig empty string voice → falls through to legacy chain", () => {
  const prompt = buildSystemPrompt(
    tenant({
      forumConfig: { ai_persona: { voice_description: "   " } },
      widget: { systemPrompt: "WIDGET WINS" },
    }),
    {},
  );
  assert(prompt.includes("WIDGET WINS"), "widget falls through");
});

// ─── Legacy precedence chain unchanged ───────────────────────

test("audience persona wins when no forumConfig", () => {
  const prompt = buildSystemPrompt(
    tenant({
      guardrails: {
        audiences: [
          {
            id: "buyer",
            name: "Buyer",
            urlPatterns: ["*"],
            persona: "You are a no-nonsense buying advisor.",
            ctaMessages: [],
            ctaAfterTurns: 5,
          },
        ],
        topicBoundaries: { deflect: [], hardBlock: [] },
        conversationLimits: { maxTurnsBeforeCTA: 5, idleTimeoutMinutes: 10 },
      },
    }),
    {},
  );
  assert(prompt.includes("no-nonsense buying advisor"), "audience persona used");
});

test("widget.systemPrompt used when no forumConfig and no audiences", () => {
  const prompt = buildSystemPrompt(
    tenant({ widget: { systemPrompt: "WIDGET LEGACY PERSONA" } }),
    {},
  );
  assert(prompt.includes("WIDGET LEGACY PERSONA"), "widget used");
});

test("settings.persona used when no forumConfig, audiences, or widget", () => {
  const prompt = buildSystemPrompt(
    tenant({ persona: "OLD SETTINGS PERSONA" }),
    {},
  );
  assert(prompt.includes("OLD SETTINGS PERSONA"), "settings.persona used");
});

test("settings.systemPrompt is deepest fallback before default", () => {
  const prompt = buildSystemPrompt(
    tenant({ systemPrompt: "VERY OLD SYSTEM PROMPT" }),
    {},
  );
  assert(prompt.includes("VERY OLD SYSTEM PROMPT"), "systemPrompt used");
});

test("default tenant prose when nothing configured", () => {
  const prompt = buildSystemPrompt(tenant({}), {});
  assert(
    prompt.includes(`assistant embedded on ${NAME}'s website`),
    "default used",
  );
});

// ─── Allowed-topics union (CON-192 add-on) ───────────────────

test("allowed topics: forumConfig + widget unioned, deduped (no audiences)", () => {
  const prompt = buildSystemPrompt(
    tenant({
      forumConfig: { allowed_topics: ["forumA", "shared"] },
      widget: { allowedTopics: "legacyA, shared, legacyB" },
    }),
    {},
  );
  // Order: forumConfig first, then widget. CON-204: legacy
  // guardrails.topicBoundaries.allow no longer participates.
  assert(prompt.includes("forumA, shared, legacyA, legacyB"), "union order");
});

test("CON-204: legacy guardrails.topicBoundaries.allow is NOT read by the prompt", () => {
  // Tenant with ONLY the legacy structured allow list populated. After
  // CON-204 this no longer feeds the prompt — forumConfig.allowed_topics
  // is the single structured source. Such tenants must re-author topics
  // via the dashboard (Cam accepted this regression on 19 Jun 2026).
  const prompt = buildSystemPrompt(
    // Cast through unknown because TopicBoundaries no longer declares
    // `allow` — we're deliberately simulating a residual JSON blob.
    tenant({
      guardrails: {
        audiences: [
          {
            id: "default",
            name: "Visitor",
            urlPatterns: ["*"],
            persona: "Helpful.",
            ctaMessages: [],
            ctaAfterTurns: 5,
          },
        ],
        topicBoundaries: {
          allow: ["legacyOnly"],
          deflect: [],
          hardBlock: [],
        },
        conversationLimits: { maxTurnsBeforeCTA: 5, idleTimeoutMinutes: 10 },
      },
    }),
    {},
  );
  assert(
    !prompt.includes("legacyOnly"),
    "legacy allow value must not appear in prompt",
  );
  assert(
    !prompt.includes("You should only discuss topics related to"),
    "flat allowed-topics line should not render",
  );
  assert(
    !prompt.includes("**Allowed topics:**"),
    "structured allowed-topics line should not render",
  );
});

test("CON-204: forumConfig.allowed_topics still flows through end-to-end", () => {
  const prompt = buildSystemPrompt(
    tenant({
      forumConfig: { allowed_topics: ["a", "b"] },
    }),
    {},
  );
  assert(
    prompt.includes(
      "You should only discuss topics related to: a, b",
    ),
    "forumConfig topics surface in prompt",
  );
});

test("allowed topics: dedupe is case-insensitive, preserves first occurrence", () => {
  const prompt = buildSystemPrompt(
    tenant({
      forumConfig: { allowed_topics: ["Farming"] },
      widget: { allowedTopics: "farming, soil" },
    }),
    {},
  );
  assert(prompt.includes("Farming, soil"), "ci-dedupe");
});

test("allowed topics: surface inside the structured Topic Boundaries section when audiences present (forumConfig only after CON-204)", () => {
  const prompt = buildSystemPrompt(
    tenant({
      forumConfig: { allowed_topics: ["forumTopic"] },
      guardrails: {
        audiences: [
          {
            id: "default",
            name: "Visitor",
            urlPatterns: ["*"],
            persona: "p",
            ctaMessages: [],
            ctaAfterTurns: 5,
          },
        ],
        topicBoundaries: {
          deflect: [],
          hardBlock: [],
        },
        conversationLimits: { maxTurnsBeforeCTA: 5, idleTimeoutMinutes: 10 },
      },
    }),
    {},
  );
  assert(prompt.includes("# Topic Boundaries"), "section present");
  assert(
    prompt.includes("**Allowed topics:** forumTopic"),
    "forumConfig topics",
  );
});

// ─── Strict backwards-compat ─────────────────────────────────

test("legacy-only tenant prompt is byte-identical to pre-CON-192 for the persona slice", () => {
  // Reproduce the pre-CON-192 expected prompt fragments for a tenant with
  // no forumConfig and only widget.systemPrompt + widget.allowedTopics
  // (no guardrails). The build should NOT introduce new sections or text.
  const prompt = buildSystemPrompt(
    tenant({
      widget: {
        systemPrompt: "Barry is a friendly farmer.",
        allowedTopics: "farming, irrigation",
      },
    }),
    {},
  );
  assert(prompt.includes("Barry is a friendly farmer."), "voice preserved");
  assert(
    prompt.includes(
      `You are the AI assistant for ${NAME} (${DOMAIN}).`,
    ),
    "context line preserved",
  );
  assert(
    prompt.includes(
      "You should only discuss topics related to: farming, irrigation",
    ),
    "topics line preserved",
  );
  assert(!prompt.includes("# Topic Boundaries"), "no audience-mode section");
  assert(!prompt.includes("# Your Role"), "no audience-mode role section");
});

test("audience-mode tenant with no forumConfig: no empty Topic Boundaries when nothing to say", () => {
  const prompt = buildSystemPrompt(
    tenant({
      guardrails: {
        audiences: [
          {
            id: "default",
            name: "Visitor",
            urlPatterns: ["*"],
            persona: "Helpful.",
            ctaMessages: [],
            ctaAfterTurns: 5,
          },
        ],
        topicBoundaries: { deflect: [], hardBlock: [] },
        conversationLimits: { maxTurnsBeforeCTA: 5, idleTimeoutMinutes: 10 },
      },
    }),
    {},
  );
  assert(prompt.includes("# Your Role"), "role section");
  assert(!prompt.includes("# Topic Boundaries"), "no empty boundaries section");
});

test("audience-mode tenant with legacy deflect rules: section appears and is non-empty", () => {
  const prompt = buildSystemPrompt(
    tenant({
      guardrails: {
        audiences: [
          {
            id: "default",
            name: "Visitor",
            urlPatterns: ["*"],
            persona: "Helpful.",
            ctaMessages: [],
            ctaAfterTurns: 5,
          },
        ],
        topicBoundaries: {
          deflect: [{ topic: "off-brand", response: "Let's stay on track." }],
          hardBlock: [],
        },
        conversationLimits: { maxTurnsBeforeCTA: 5, idleTimeoutMinutes: 10 },
      },
    }),
    {},
  );
  assert(prompt.includes("# Topic Boundaries"), "boundaries section");
  assert(prompt.includes("Deflect these topics"), "deflect rendered");
});

// CON-245 site-context footer

test("CON-245: site-context footer present when tenant has name + domain (no audiences)", () => {
  const prompt = buildSystemPrompt(tenant({}), {});
  assert(prompt.includes("## Site context"), "site context header");
  assert(
    prompt.includes(`browsing your site (${DOMAIN})`),
    "domain injected",
  );
  assert(
    prompt.includes(`go to ${NAME}`),
    "tenant name injected in guardrail phrasing",
  );
});

test("CON-245: site-context footer present with audiences branch too", () => {
  const prompt = buildSystemPrompt(
    tenant({
      guardrails: {
        audiences: [
          {
            id: "default",
            name: "Visitor",
            urlPatterns: ["*"],
            persona: "Helpful.",
            ctaMessages: [],
            ctaAfterTurns: 5,
          },
        ],
        topicBoundaries: { deflect: [], hardBlock: [] },
        conversationLimits: { maxTurnsBeforeCTA: 5, idleTimeoutMinutes: 10 },
      },
    }),
    { pageUrl: "https://acme.com.au/" },
  );
  assert(prompt.includes("## Site context"), "footer applies in audiences branch");
  assert(prompt.includes(`(${DOMAIN})`), "domain injected");
});

test("CON-245: site-context footer omitted when tenant.domain is missing", () => {
  const prompt = buildSystemPrompt(
    { name: NAME, domain: null, settings: {} },
    {},
  );
  assert(
    !prompt.includes("## Site context"),
    "no site-context footer without domain",
  );
});

test("CON-245: site-context footer omitted when tenant.name is missing", () => {
  const prompt = buildSystemPrompt(
    { name: "", domain: DOMAIN, settings: {} },
    {},
  );
  assert(
    !prompt.includes("## Site context"),
    "no site-context footer without name",
  );
});

// ─── Summary ─────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
