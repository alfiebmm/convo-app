/**
 * Tests for the visitor-persona derivation (CON-246).
 *
 * Run with: `npx tsx --test src/lib/persona/__tests__/derive-visitor-persona.test.ts`
 *
 * Covers the four documented paths:
 *   1. Qualifying-answered  — declared value wins.
 *   2. Classifier fallback  — no qualifying answer, classifier persona used.
 *   3. Unknown              — neither surface produced a value.
 *   4. No `persona_field` config  — `personaField` returns `null`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { deriveVisitorPersona } from "../derive-visitor-persona";
import {
  safeDefaultClassifierOutput,
  type ClassifierOutput,
} from "@/lib/classifier/schema";
import type { ForumConfig } from "@/lib/forum-config/schema";

// -- Test helpers ---------------------------------------------------------

function withPresetPersonaField(
  personaField: string,
): Pick<ForumConfig, "qualifying_questions"> {
  return {
    qualifying_questions: {
      preset: {
        question: "Which best describes you?",
        options: [
          { label: "Farmer", value: "farmer" },
          { label: "Contractor", value: "contractor" },
        ],
        persona_field: personaField,
      },
      additional: [],
    },
  };
}

function withoutPersonaField(): Pick<ForumConfig, "qualifying_questions"> {
  return {
    qualifying_questions: {
      additional: [],
    },
  };
}

function classifierWithPersona(
  persona: ClassifierOutput["attributes"]["persona"],
): ClassifierOutput {
  const base = safeDefaultClassifierOutput();
  return {
    ...base,
    attributes: {
      ...base.attributes,
      persona,
    },
  };
}

// -- 1. Qualifying-answered path ------------------------------------------

test("deriveVisitorPersona — declared qualifying answer wins over classifier", () => {
  const tenantConfig = withPresetPersonaField("persona");
  const answers = { persona: "farmer" };
  const classifierOutput = classifierWithPersona("customer");

  const result = deriveVisitorPersona(tenantConfig, answers, classifierOutput);

  assert.equal(result.persona, "farmer");
  assert.equal(result.personaField, "persona");
  assert.equal(result.source, "qualifying");
});

test("deriveVisitorPersona — declared answer wins even when classifier is null", () => {
  const tenantConfig = withPresetPersonaField("visitor_role");
  const answers = { visitor_role: "contractor" };

  const result = deriveVisitorPersona(tenantConfig, answers, null);

  assert.equal(result.persona, "contractor");
  assert.equal(result.personaField, "visitor_role");
  assert.equal(result.source, "qualifying");
});

test("deriveVisitorPersona — empty-string qualifying answer falls through to classifier", () => {
  const tenantConfig = withPresetPersonaField("persona");
  const answers = { persona: "" };
  const classifierOutput = classifierWithPersona("supplier");

  const result = deriveVisitorPersona(tenantConfig, answers, classifierOutput);

  assert.equal(result.persona, "supplier");
  assert.equal(result.personaField, "persona");
  assert.equal(result.source, "classifier");
});

// -- 2. Classifier fallback -----------------------------------------------

test("deriveVisitorPersona — no qualifying answer falls back to classifier persona", () => {
  const tenantConfig = withPresetPersonaField("persona");
  const classifierOutput = classifierWithPersona("customer");

  const result = deriveVisitorPersona(tenantConfig, null, classifierOutput);

  assert.equal(result.persona, "customer");
  assert.equal(result.personaField, "persona");
  assert.equal(result.source, "classifier");
});

test("deriveVisitorPersona — empty qualifying-answers map falls back to classifier", () => {
  const tenantConfig = withPresetPersonaField("persona");
  const classifierOutput = classifierWithPersona("partner");

  const result = deriveVisitorPersona(tenantConfig, {}, classifierOutput);

  assert.equal(result.persona, "partner");
  assert.equal(result.personaField, "persona");
  assert.equal(result.source, "classifier");
});

test("deriveVisitorPersona — mismatched persona_field falls back to classifier", () => {
  const tenantConfig = withPresetPersonaField("persona");
  // Visitor answered a DIFFERENT qualifying question, not the persona one.
  const answers = { other_field: "farmer" };
  const classifierOutput = classifierWithPersona("browser");

  const result = deriveVisitorPersona(tenantConfig, answers, classifierOutput);

  assert.equal(result.persona, "browser");
  assert.equal(result.personaField, "persona");
  assert.equal(result.source, "classifier");
});

// -- 3. Unknown path (neither surface produces a value) --------------------

test("deriveVisitorPersona — nothing configured, nothing answered, no classifier → unknown", () => {
  const tenantConfig = withoutPersonaField();

  const result = deriveVisitorPersona(tenantConfig, null, null);

  assert.equal(result.persona, null);
  assert.equal(result.personaField, null);
  assert.equal(result.source, "unknown");
});

// -- 4. No persona_field config -------------------------------------------

test("deriveVisitorPersona — no persona_field config, classifier persona used with null personaField", () => {
  const tenantConfig = withoutPersonaField();
  const classifierOutput = classifierWithPersona("customer");

  const result = deriveVisitorPersona(tenantConfig, null, classifierOutput);

  assert.equal(result.persona, "customer");
  assert.equal(result.personaField, null);
  assert.equal(result.source, "classifier");
});

test("deriveVisitorPersona — no persona_field config: qualifying answers are ignored", () => {
  const tenantConfig = withoutPersonaField();
  // Even if the visitor's metadata carries a `persona` key, without a
  // tenant-declared `persona_field` mapping we must not honour it.
  const answers = { persona: "farmer" };
  const classifierOutput = classifierWithPersona("customer");

  const result = deriveVisitorPersona(tenantConfig, answers, classifierOutput);

  assert.equal(result.persona, "customer");
  assert.equal(result.personaField, null);
  assert.equal(result.source, "classifier");
});

// -- Bonus: classifier "unknown" persona is still a value ------------------

test("deriveVisitorPersona — classifier persona 'unknown' is treated as a value, not null", () => {
  // The classifier enum includes 'unknown' — it is a real signal ("no
  // signal") and should propagate through as-is, provenance = classifier.
  const tenantConfig = withPresetPersonaField("persona");
  const classifierOutput = classifierWithPersona("unknown");

  const result = deriveVisitorPersona(tenantConfig, null, classifierOutput);

  assert.equal(result.persona, "unknown");
  assert.equal(result.personaField, "persona");
  assert.equal(result.source, "classifier");
});
