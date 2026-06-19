/**
 * CON-201 — response engine partial-config matrix.
 *
 * Validates that `resolveResponseEngine` / `resolveForumConfig` survive
 * a tenant config that's missing slices. CON-199 voice_description fix
 * is verified end-to-end through `resolveResponseEngine` here.
 *
 * Run with: npx tsx src/lib/guardrails/__tests__/response-engine-partial-config.test.ts
 */

import {
  resolveForumConfig,
  resolveResponseEngine,
} from "../response-engine";
import { DEFAULT_FORUM_CONFIG } from "@/lib/forum-config/defaults";

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

console.log("CON-201 response engine — partial config matrix");

// AC #1 — qualifying_questions-only tenant.
{
  const tenantSettings = {
    forumConfig: {
      qualifying_questions: {
        preset: {
          question: "Crop?",
          options: [{ label: "wheat", value: "wheat" }],
          persona_field: "crop",
        },
        additional: [],
      },
    },
  };
  const cfg = resolveForumConfig(tenantSettings);
  check(
    "qualifying_questions-only tenant: questions preserved",
    cfg.qualifying_questions.preset?.question === "Crop?",
  );
  check(
    "qualifying_questions-only tenant: ai_persona = DEFAULT slice",
    cfg.ai_persona.voice_description ===
      DEFAULT_FORUM_CONFIG.ai_persona.voice_description,
  );
}

// AC #2 — ai_persona-only tenant: voice_description survives end-to-end.
{
  const tenantSettings = {
    forumConfig: {
      ai_persona: { tone: "expert" as const, voice_description: "blah" },
    },
  };
  const cfg = resolveForumConfig(tenantSettings);
  check(
    "ai_persona-only tenant: voice_description preserved",
    cfg.ai_persona.voice_description === "blah",
  );
  check(
    "ai_persona-only tenant: tone preserved",
    cfg.ai_persona.tone === "expert",
  );

  // Through resolveResponseEngine, the locale instruction still resolves
  // from the parsed ai_persona slice.
  const resolved = resolveResponseEngine(tenantSettings);
  check(
    "ai_persona-only tenant: locale defaults to en-AU when not supplied",
    resolved.forumConfig.ai_persona.locale === "en-AU",
  );
  check(
    "ai_persona-only tenant: addendum contains Australian English",
    resolved.promptAddendum.includes("Australian English"),
  );
}

// AC #3 — banned_words on ai_persona slice survive.
{
  const tenantSettings = {
    forumConfig: {
      ai_persona: {
        tone: "expert" as const,
        voice_description: "v",
        banned_words: ["frenemy"],
      },
    },
  };
  const resolved = resolveResponseEngine(tenantSettings);
  check(
    "ai_persona-only tenant: banned_words merged into bannedTerms",
    resolved.bannedTerms.includes("frenemy"),
  );
  // exclusion_list also merges — slice is absent so DEFAULT exclusion_list
  // applies (legal/medical/etc).
  check(
    "ai_persona-only tenant: DEFAULT exclusion_list still merged",
    resolved.bannedTerms.includes("medical advice"),
  );
}

// AC #5 — empty forumConfig.
{
  const cfg = resolveForumConfig({ forumConfig: {} });
  check(
    "empty forumConfig: equals DEFAULT_FORUM_CONFIG",
    JSON.stringify(cfg) === JSON.stringify(DEFAULT_FORUM_CONFIG),
  );
}

// AC #4 — fully populated config unchanged.
{
  const cfg = resolveForumConfig({ forumConfig: DEFAULT_FORUM_CONFIG });
  check(
    "fully populated: round-trips to DEFAULT_FORUM_CONFIG",
    JSON.stringify(cfg) === JSON.stringify(DEFAULT_FORUM_CONFIG),
  );
}

// Token cap still resolves through a partial config.
{
  const tenantSettings = {
    forumConfig: {
      limits: {
        max_output_tokens: 750,
        max_input_tokens: 4000,
        max_history_turns: 10,
        rate_limit_per_minute: 60,
      },
    },
  };
  const resolved = resolveResponseEngine(tenantSettings);
  check(
    "limits-only tenant: max_output_tokens override is honoured",
    resolved.maxTokens === 750,
  );
}

// Regression: AgPages-shape config (no seo_defaults) does NOT wipe
// voice_description.
{
  const agPagesLike = {
    forumConfig: {
      ai_persona: {
        tone: "expert" as const,
        voice_description: "AgPages voice locked in",
      },
      qualifying_questions: {
        preset: {
          question: "What are you growing?",
          options: [{ label: "wheat", value: "wheat" }],
          persona_field: "crop",
        },
        additional: [],
      },
      allowed_topics: ["agronomy"],
    },
  };
  const cfg = resolveForumConfig(agPagesLike);
  check(
    "AgPages-shape: voice_description survives despite missing seo_defaults",
    cfg.ai_persona.voice_description === "AgPages voice locked in",
  );
  check(
    "AgPages-shape: qualifying_questions survives despite missing seo_defaults",
    cfg.qualifying_questions.preset?.question === "What are you growing?",
  );
  check(
    "AgPages-shape: allowed_topics survives",
    cfg.allowed_topics.includes("agronomy"),
  );
  check(
    "AgPages-shape: seo_defaults falls back to DEFAULT slice",
    cfg.seo_defaults.schema_org_type ===
      DEFAULT_FORUM_CONFIG.seo_defaults.schema_org_type,
  );
}

console.log(`\n${"─".repeat(32)}`);
console.log(`${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
