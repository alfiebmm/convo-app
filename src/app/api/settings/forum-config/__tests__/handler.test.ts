#!/usr/bin/env node
/**
 * Tests for the /api/settings/forum-config pure handlers (CON-191).
 *
 * Pattern: matches src/app/api/conversations/qualifying/state/__tests__/route.test.ts —
 * pure tsx-runnable, no test framework. Run with:
 *   npx tsx src/app/api/settings/forum-config/__tests__/handler.test.ts
 */
import {
  handleForumConfigGet,
  handleForumConfigPatch,
  type ForumConfigDeps,
} from "../handler";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`OK ${name}`);
    passed++;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`FAIL ${name}`);
    console.log(`  ${message}`);
    failed++;
  }
}

function assertEq<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function assert(cond: unknown, label: string) {
  if (!cond) throw new Error(label);
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return JSON.parse(await res.text()) as Record<string, unknown>;
}

function makeDeps(initial: Record<string, Record<string, unknown>>) {
  const store: Record<string, Record<string, unknown>> = JSON.parse(
    JSON.stringify(initial),
  );
  const deps: ForumConfigDeps & {
    _readStore: (id: string) => Record<string, unknown> | undefined;
    _writes: { tenantId: string; settings: Record<string, unknown> }[];
  } = {
    _readStore: (id) => store[id],
    _writes: [],
    getTenantSettings: async (tenantId: string) => store[tenantId] ?? null,
    saveTenantSettings: async (
      tenantId: string,
      settings: Record<string, unknown>,
    ) => {
      deps._writes.push({ tenantId, settings });
      store[tenantId] = settings;
      return settings;
    },
  };
  return deps;
}

const validPersona = {
  tone: "friendly",
  locale: "en-AU",
  banned_words: ["spam"],
  voice_description: "Helpful Aussie expert.",
};

const validQualifying = {
  preset: {
    question: "What brings you here?",
    options: [
      { label: "Question", value: "question" },
      { label: "Service", value: "service" },
    ],
    persona_field: "visitor_intent",
  },
  additional: [],
};

const validWelcome = {
  copy: "Hi there, how can I help you today?",
  enabled: true,
  show_with_questions: false,
};

const validAllowedTopics = ["dog training", "puppy advice", "vet referrals"];

const validFollowUp = {
  enabled: true,
  default_sensitivity: "balanced" as const,
  allow_staff_review_flags_without_visitor_interruption: true,
  persona_source: "qualifying" as const,
  contact_methods: [],
  capture_policies: [],
  rules: [],
  destinations: [],
};

async function run() {
  // ── GET ────────────────────────────────────────────────────

  await test("GET returns 404 when tenant missing", async () => {
    const deps = makeDeps({});
    const res = await handleForumConfigGet("missing", deps);
    assertEq(res.status, 404, "status");
  });

  await test("GET returns parsed forumConfig (defaults) for empty tenant", async () => {
    // CON-201: every root slice is now `.prefault({})` and `ai_persona` +
    // `seo_defaults` carry field-level defaults, so the strict root parse
    // succeeds on an empty config and the UI receives schema defaults
    // directly. (Previously parseOk was false here and the UI silently
    // fell back to defaults; that fallback is now in the schema itself.)
    const deps = makeDeps({ "tenant-a": {} });
    const res = await handleForumConfigGet("tenant-a", deps);
    assertEq(res.status, 200, "status");
    const body = await readJson(res);
    assertEq(body.parseOk, true, "parseOk true on empty tenant (CON-201)");
    assert(
      typeof body.forumConfig === "object" && body.forumConfig !== null,
      "forumConfig is an object even when empty",
    );
  });

  await test("GET reflects existing forumConfig", async () => {
    const deps = makeDeps({
      "tenant-a": {
        forumConfig: { ai_persona: validPersona },
      },
    });
    const res = await handleForumConfigGet("tenant-a", deps);
    assertEq(res.status, 200, "status");
    const body = await readJson(res);
    const cfg = body.forumConfig as Record<string, unknown>;
    const persona = cfg.ai_persona as Record<string, unknown>;
    assertEq(persona.tone, "friendly", "persona.tone");
    assertEq(persona.locale, "en-AU", "persona.locale");
  });

  // ── PATCH: validation ──────────────────────────────────────

  await test("PATCH 400 when body is not an object", async () => {
    const deps = makeDeps({ "tenant-a": {} });
    const res = await handleForumConfigPatch("tenant-a", "nope", deps);
    assertEq(res.status, 400, "status");
    assertEq(deps._writes.length, 0, "no writes on invalid body");
  });

  await test("PATCH 400 when no authoring slices provided", async () => {
    const deps = makeDeps({ "tenant-a": {} });
    const res = await handleForumConfigPatch(
      "tenant-a",
      { unrelated: 1 },
      deps,
    );
    assertEq(res.status, 400, "status");
    const body = await readJson(res);
    assertEq(body.error, "No authoring slices provided", "error msg");
  });

  await test("PATCH 400 on bad ai_persona shape, reports per-slice issues", async () => {
    const deps = makeDeps({ "tenant-a": {} });
    const res = await handleForumConfigPatch(
      "tenant-a",
      { ai_persona: { tone: "not-a-real-tone" } },
      deps,
    );
    assertEq(res.status, 400, "status");
    const body = await readJson(res);
    assertEq(body.error, "Validation failed", "error msg");
    const issues = body.issues as Record<string, unknown>;
    assert(Array.isArray(issues.ai_persona), "ai_persona issues array");
    assertEq(deps._writes.length, 0, "no writes on invalid shape");
  });

  await test("PATCH 400 when ONE slice valid and ONE invalid (atomic reject)", async () => {
    const deps = makeDeps({ "tenant-a": {} });
    const res = await handleForumConfigPatch(
      "tenant-a",
      {
        ai_persona: validPersona,
        follow_up: { enabled: "not-a-boolean" },
      },
      deps,
    );
    assertEq(res.status, 400, "status");
    const body = await readJson(res);
    const issues = body.issues as Record<string, unknown>;
    assert(Array.isArray(issues.follow_up), "follow_up issues array");
    assert(issues.ai_persona === undefined, "ai_persona has no issues");
    assertEq(deps._writes.length, 0, "atomic: no partial write");
  });

  // ── PATCH: tenant scoping ──────────────────────────────────

  await test("PATCH returns 404 on missing tenant", async () => {
    const deps = makeDeps({});
    const res = await handleForumConfigPatch(
      "ghost-tenant",
      { ai_persona: validPersona },
      deps,
    );
    assertEq(res.status, 404, "status");
    assertEq(deps._writes.length, 0, "no writes");
  });

  await test("PATCH writes only to the supplied tenant id (scoping)", async () => {
    const deps = makeDeps({
      "tenant-a": {
        forumConfig: { ai_persona: validPersona },
      },
      "tenant-b": {
        forumConfig: { allowed_topics: ["banking"] },
      },
    });
    const res = await handleForumConfigPatch(
      "tenant-a",
      { allowed_topics: ["dogs"] },
      deps,
    );
    assertEq(res.status, 200, "status");
    assertEq(deps._writes.length, 1, "single write");
    assertEq(deps._writes[0].tenantId, "tenant-a", "write target tenant");
    // tenant-b is untouched
    const tenantB = deps._readStore("tenant-b") as Record<string, unknown>;
    const tenantBfc = tenantB.forumConfig as Record<string, unknown>;
    const topicsB = tenantBfc.allowed_topics as string[];
    assertEq(topicsB[0], "banking", "tenant-b allowed_topics untouched");
  });

  // ── PATCH: deep merge / preservation ───────────────────────

  await test("PATCH preserves OTHER forumConfig slices", async () => {
    const existing = {
      cta_rules: [
        {
          tag: "book",
          text: "Book now",
          url: "https://example.com/book",
          default: true,
        },
      ],
      seo_defaults: {
        title_template: "{title}",
        meta_template: "{meta}",
        schema_org_type: "BlogPosting",
      },
      ai_persona: {
        tone: "professional",
        locale: "en-AU",
        banned_words: [],
        voice_description: "Old voice.",
      },
      allowed_topics: ["old-topic"],
    };
    const deps = makeDeps({
      "tenant-a": { forumConfig: existing },
    });
    const res = await handleForumConfigPatch(
      "tenant-a",
      { ai_persona: validPersona },
      deps,
    );
    assertEq(res.status, 200, "status");
    const stored = deps._readStore("tenant-a") as Record<string, unknown>;
    const fc = stored.forumConfig as Record<string, unknown>;
    // ai_persona replaced
    const persona = fc.ai_persona as Record<string, unknown>;
    assertEq(persona.tone, "friendly", "persona.tone updated");
    // other slices preserved verbatim
    assertEq(
      JSON.stringify(fc.cta_rules),
      JSON.stringify(existing.cta_rules),
      "cta_rules preserved",
    );
    assertEq(
      JSON.stringify(fc.seo_defaults),
      JSON.stringify(existing.seo_defaults),
      "seo_defaults preserved",
    );
    const topics = fc.allowed_topics as string[];
    assertEq(topics[0], "old-topic", "allowed_topics not touched by persona patch");
  });

  await test("PATCH preserves OTHER settings keys (widget, cms)", async () => {
    const deps = makeDeps({
      "tenant-a": {
        widget: { primaryColor: "#FF6B2C" },
        cms: { type: "wordpress" },
        forumConfig: {},
      },
    });
    const res = await handleForumConfigPatch(
      "tenant-a",
      { allowed_topics: ["dogs", "puppies"] },
      deps,
    );
    assertEq(res.status, 200, "status");
    const stored = deps._readStore("tenant-a") as Record<string, unknown>;
    const widget = stored.widget as Record<string, unknown>;
    assertEq(widget.primaryColor, "#FF6B2C", "widget preserved");
    const cms = stored.cms as Record<string, unknown>;
    assertEq(cms.type, "wordpress", "cms preserved");
    const fc = stored.forumConfig as Record<string, unknown>;
    const topics = fc.allowed_topics as string[];
    assertEq(topics.length, 2, "allowed_topics written");
  });

  await test("PATCH replaces a slice atomically (no in-slice merge)", async () => {
    // A slice is the atomic write unit — the new value REPLACES the old.
    const deps = makeDeps({
      "tenant-a": {
        forumConfig: {
          ai_persona: {
            tone: "professional",
            locale: "en-AU",
            banned_words: ["one", "two"],
            voice_description: "Old voice.",
          },
        },
      },
    });
    const res = await handleForumConfigPatch(
      "tenant-a",
      {
        ai_persona: {
          tone: "casual",
          locale: "en-AU",
          banned_words: [],
          voice_description: "New voice.",
        },
      },
      deps,
    );
    assertEq(res.status, 200, "status");
    const stored = deps._readStore("tenant-a") as Record<string, unknown>;
    const fc = stored.forumConfig as Record<string, unknown>;
    const persona = fc.ai_persona as Record<string, unknown>;
    const banned = persona.banned_words as string[];
    assertEq(banned.length, 0, "banned_words replaced not merged");
    assertEq(persona.voice_description, "New voice.", "voice replaced");
  });

  // ── PATCH: happy path full round-trip ──────────────────────

  await test("PATCH happy path — full authoring save round-trips", async () => {
    const deps = makeDeps({ "tenant-a": {} });
    const res = await handleForumConfigPatch(
      "tenant-a",
      {
        ai_persona: validPersona,
        welcome: validWelcome,
        qualifying_questions: validQualifying,
        allowed_topics: validAllowedTopics,
        follow_up: validFollowUp,
      },
      deps,
    );
    assertEq(res.status, 200, "status");
    const body = await readJson(res);
    const applied = body.appliedSlices as string[];
    assertEq(applied.length, 5, "all authoring slices applied");

    // Confirm next GET returns the same authoring data (raw object)
    const getRes = await handleForumConfigGet("tenant-a", deps);
    const getBody = await readJson(getRes);
    const cfg = getBody.forumConfigRaw as Record<string, unknown>;
    const persona = cfg.ai_persona as Record<string, unknown>;
    assertEq(persona.tone, "friendly", "persona round-tripped");
    const topics = cfg.allowed_topics as string[];
    assertEq(topics[0], "dog training", "topics round-tripped");
    const welcome = cfg.welcome as Record<string, unknown>;
    assertEq(welcome.copy, validWelcome.copy, "welcome round-tripped");
  });

  await test("PATCH ignores unknown top-level keys (forwards-compat)", async () => {
    const deps = makeDeps({ "tenant-a": {} });
    const res = await handleForumConfigPatch(
      "tenant-a",
      {
        ai_persona: validPersona,
        future_slice_we_dont_know_about: { x: 1 },
      },
      deps,
    );
    assertEq(res.status, 200, "status");
    const stored = deps._readStore("tenant-a") as Record<string, unknown>;
    const fc = stored.forumConfig as Record<string, unknown>;
    assertEq(
      fc.future_slice_we_dont_know_about,
      undefined,
      "unknown slice not persisted",
    );
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run();
