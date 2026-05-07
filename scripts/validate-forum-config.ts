#!/usr/bin/env node

/**
 * Forum Config Validation Test (K-01)
 * 
 * Sanity test that validates:
 * 1. DEFAULT_FORUM_CONFIG passes validation
 * 2. Broken configs fail with clear error messages
 * 3. All required fields are enforced
 * 
 * Run with: npx tsx scripts/validate-forum-config.ts
 * Or via npm script: npm run validate:config
 */

import { validateForumConfig } from "../src/lib/forum-config/validate";
import { DEFAULT_FORUM_CONFIG } from "../src/lib/forum-config/defaults";

console.log("🧪 Forum Config Validation Test\n");

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`❌ ${name}`);
    console.log(`   Error: ${message}\n`);
    failed++;
  }
}

// ============================================================
// Test 1: Default config validates successfully
// ============================================================

test("DEFAULT_FORUM_CONFIG passes validation", () => {
  const result = validateForumConfig(DEFAULT_FORUM_CONFIG);
  if (!result.ok) {
    throw new Error(
      `Validation failed: ${result.errors.join(", ")}`
    );
  }
  if (result.data.schema_version !== 1) {
    throw new Error("schema_version should be 1");
  }
});

// ============================================================
// Test 2: Missing required fields fail
// ============================================================

test("Missing ai_persona fails validation", () => {
  const broken: Record<string, unknown> = { ...DEFAULT_FORUM_CONFIG };
  delete broken.ai_persona;

  const result = validateForumConfig(broken);
  if (result.ok) {
    throw new Error("Should have failed validation");
  }
  if (!result.errors.some(e => e.includes("ai_persona"))) {
    throw new Error("Error message should mention ai_persona");
  }
});

test("Missing seo_defaults fails validation", () => {
  const broken: Record<string, unknown> = { ...DEFAULT_FORUM_CONFIG };
  delete broken.seo_defaults;

  const result = validateForumConfig(broken);
  if (result.ok) {
    throw new Error("Should have failed validation");
  }
  if (!result.errors.some(e => e.includes("seo_defaults"))) {
    throw new Error("Error message should mention seo_defaults");
  }
});

// ============================================================
// Test 3: Invalid CTA URL format fails
// ============================================================

test("Invalid CTA URL fails validation", () => {
  const broken = {
    ...DEFAULT_FORUM_CONFIG,
    cta_rules: [
      {
        tag: "test",
        text: "Click Here",
        url: "not-a-valid-url",
        default: false,
      },
    ],
  };
  
  const result = validateForumConfig(broken);
  if (result.ok) {
    throw new Error("Should have failed validation for invalid URL");
  }
  if (!result.errors.some(e => e.includes("url") || e.includes("Invalid url"))) {
    throw new Error("Error message should mention URL validation failure");
  }
});

// ============================================================
// Test 4: Invalid ai_persona.tone enum fails
// ============================================================

test("Invalid ai_persona.tone fails validation", () => {
  const broken = {
    ...DEFAULT_FORUM_CONFIG,
    ai_persona: {
      ...DEFAULT_FORUM_CONFIG.ai_persona,
      tone: "super-friendly" as unknown as "friendly", // not a valid enum value
    },
  };

  const result = validateForumConfig(broken);
  if (result.ok) {
    throw new Error("Should have failed validation for invalid tone");
  }
});

// ============================================================
// Test 5: Too many qualifying questions fail
// ============================================================

test("More than 4 additional qualifying questions fails", () => {
  const broken = {
    ...DEFAULT_FORUM_CONFIG,
    qualifying_questions: {
      preset: DEFAULT_FORUM_CONFIG.qualifying_questions.preset,
      additional: [
        { question: "Q1", options: [], persona_field: "f1" },
        { question: "Q2", options: [], persona_field: "f2" },
        { question: "Q3", options: [], persona_field: "f3" },
        { question: "Q4", options: [], persona_field: "f4" },
        { question: "Q5", options: [], persona_field: "f5" },
      ],
    },
  };
  
  const result = validateForumConfig(broken);
  if (result.ok) {
    throw new Error("Should have failed validation for > 4 additional questions");
  }
});

// ============================================================
// Test 6: Negative token limits fail
// ============================================================

test("Negative max_output_tokens fails validation", () => {
  const broken = {
    ...DEFAULT_FORUM_CONFIG,
    limits: {
      ...DEFAULT_FORUM_CONFIG.limits,
      max_output_tokens: -100,
    },
  };
  
  const result = validateForumConfig(broken);
  if (result.ok) {
    throw new Error("Should have failed validation for negative tokens");
  }
});

// ============================================================
// Test 7: Invalid schema_org_type enum fails
// ============================================================

test("Invalid schema_org_type fails validation", () => {
  const broken = {
    ...DEFAULT_FORUM_CONFIG,
    seo_defaults: {
      ...DEFAULT_FORUM_CONFIG.seo_defaults,
      schema_org_type: "RandomType" as unknown as "Article",
    },
  };

  const result = validateForumConfig(broken);
  if (result.ok) {
    throw new Error("Should have failed validation for invalid schema type");
  }
});

// ============================================================
// Test 8: OpenAI temperature out of range fails
// ============================================================

test("OpenAI temperature > 2 fails validation", () => {
  const broken = {
    ...DEFAULT_FORUM_CONFIG,
    connectors: {
      ...DEFAULT_FORUM_CONFIG.connectors,
      openai: {
        ...DEFAULT_FORUM_CONFIG.connectors.openai,
        temperature: 3.5,
      },
    },
  };
  
  const result = validateForumConfig(broken);
  if (result.ok) {
    throw new Error("Should have failed validation for temperature > 2");
  }
});

// ============================================================
// Test 9: Valid minimal config passes
// ============================================================

test("Minimal valid config passes", () => {
  const minimal = {
    schema_version: 1,
    ai_persona: {
      tone: "professional" as const,
      locale: "en-AU",
      banned_words: [],
      voice_description: "Test",
    },
    cta_rules: [],
    qualifying_questions: { additional: [] },
    allowed_topics: [],
    exclusion_list: [],
    seo_defaults: {
      title_template: "{topic}",
      meta_template: "{topic}",
      schema_org_type: "Article" as const,
    },
    connectors: {},
    limits: {},
  };

  const result = validateForumConfig(minimal);
  if (!result.ok) {
    throw new Error(`Minimal config failed: ${result.errors.join(", ")}`);
  }
});

// ============================================================
// Summary
// ============================================================

console.log("\n" + "=".repeat(50));
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log("=".repeat(50));

if (failed > 0) {
  process.exit(1);
}

console.log("\n🎉 All validation tests passed!");
