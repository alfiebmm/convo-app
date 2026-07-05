/**
 * Visitor-persona derivation (CON-246).
 *
 * Pure function. No I/O. Same input → same output.
 *
 * The classifier previously emitted a coarse demand/supply/unknown enum
 * — a lossy re-encode of the *declared* persona a visitor already surfaces via
 * qualifying questions. CON-246 kills that field entirely and replaces it with
 * this function: the visitor's declared answer (`persona_field` mapping) is the
 * source of truth; the classifier's `attributes.persona` enum is the fallback
 * when no declared answer exists.
 *
 * Ordering: declared > guessed.
 *
 * Downstream consumers:
 *   - `resolveAction` reads the derived persona for `persona_in` matching.
 *   - Future dashboard filters / contacts store persistence (CON-248) will
 *     write the derived persona into `contacts.attributes` and
 *     `follow_up_case_attributes` at case-creation time.
 */

import type { ForumConfig } from "@/lib/forum-config/schema";
import type { ClassifierOutput } from "@/lib/classifier/schema";

export interface DerivedVisitorPersona {
  /**
   * The raw persona value — the visitor's declared qualifying-question
   * answer when available (e.g. `"farmer"`, `"contractor"`), otherwise the
   * classifier's guessed `attributes.persona` enum value. `null` when
   * neither surface produced a value.
   */
  persona: string | null;
  /**
   * The tenant-declared `persona_field` key that carries the persona
   * value in the qualifying-question surface (e.g. `"persona"`,
   * `"visitor_intent"`). `null` when the tenant has no
   * `qualifying_questions.preset.persona_field` mapping configured.
   */
  personaField: string | null;
  /**
   * Provenance:
   *   - `"qualifying"` — the visitor answered the tenant's persona
   *     qualifying question; `persona` is the declared value.
   *   - `"classifier"` — no qualifying answer; `persona` is the
   *     classifier's guessed enum value.
   *   - `"unknown"` — neither surface produced a value.
   */
  source: "qualifying" | "classifier" | "unknown";
}

/**
 * Derive the visitor's persona from the tenant's qualifying-question
 * config, the visitor's declared answers, and the classifier's output.
 *
 * Behaviour:
 *   1. Read `tenantConfig.qualifying_questions?.preset?.persona_field`.
 *   2. If a `personaField` exists AND `qualifyingAnswers[personaField]`
 *      is present, return that value with `source: "qualifying"`.
 *   3. Otherwise fall back to `classifierOutput?.attributes.persona`
 *      with `source: "classifier"`.
 *   4. If neither surface produces a value, return
 *      `{ persona: null, personaField, source: "unknown" }`.
 *
 * `personaField` is null only when the tenant has no
 * `qualifying_questions.preset.persona_field` mapping at all.
 */
export function deriveVisitorPersona(
  tenantConfig: Pick<ForumConfig, "qualifying_questions">,
  qualifyingAnswers: Record<string, string> | null | undefined,
  classifierOutput: ClassifierOutput | null,
): DerivedVisitorPersona {
  const personaField =
    tenantConfig.qualifying_questions?.preset?.persona_field ?? null;

  // 1. Qualifying-answered path — declared value wins.
  if (personaField !== null && qualifyingAnswers) {
    const declared = qualifyingAnswers[personaField];
    if (typeof declared === "string" && declared.length > 0) {
      return {
        persona: declared,
        personaField,
        source: "qualifying",
      };
    }
  }

  // 2. Classifier fallback.
  const classifierPersona = classifierOutput?.attributes.persona;
  if (typeof classifierPersona === "string" && classifierPersona.length > 0) {
    return {
      persona: classifierPersona,
      personaField,
      source: "classifier",
    };
  }

  // 3. Nothing usable on either surface.
  return {
    persona: null,
    personaField,
    source: "unknown",
  };
}
