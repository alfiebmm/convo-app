#!/usr/bin/env node

/**
 * CON-248 — persona-persistence tests.
 *
 * Focused coverage for the persona-attribute write path:
 *   - `setCaseAttribute` with `key: 'persona'` persists to the store.
 *   - Round-trip: write then read via `getCaseAttributes`, assert value +
 *     source match what CON-248 writes from the chat route.
 *   - "qualifying" and "classifier" source values are both accepted
 *     (the column is `string | null`, no enum constraint — verified
 *     against `store.ts` `CaseAttributeRow`).
 *   - Upsert semantics: rewriting the persona attribute overwrites the
 *     previous value + source (latest-wins per (case, key)).
 *
 * Runs the same tsx-driven no-framework harness as `cases.test.ts`.
 *
 * Run with:  npx tsx src/lib/cases/__tests__/persona-persistence.test.ts
 */

import { createCase } from "../index";
import { setCaseAttribute, getCaseAttributes } from "../attributes";
import { createInMemoryCasesStore } from "./in-memory-store";

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const failures: string[] = [];

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`❌ ${name}`);
    console.log(`   Error: ${message}`);
    failed++;
    failures.push(`${name}: ${message}`);
  }
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function assertEq<T>(actual: T, expected: T, msg: string) {
  if (actual !== expected) {
    throw new Error(
      `${msg} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

const TENANT_A = "a1111111-1111-4111-8111-111111111111";
const CONVO_A = "c1111111-1111-4111-8111-111111111111";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function runAll() {
  await test(
    "CON-248: persona attribute with source=qualifying round-trips",
    async () => {
      const store = createInMemoryCasesStore();
      const created = await createCase(
        TENANT_A,
        { conversationId: CONVO_A, caseType: "lead" },
        { store },
      );

      await setCaseAttribute(
        TENANT_A,
        {
          caseId: created.id,
          key: "persona",
          value: "farmer",
          source: "qualifying",
        },
        { store },
      );

      const attrs = await getCaseAttributes(TENANT_A, created.id, { store });
      assertEq(attrs.length, 1, "one persona row");
      assertEq(attrs[0].key, "persona", "key is persona");
      assertEq(attrs[0].value as string, "farmer", "value is farmer");
      assertEq(
        attrs[0].source,
        "qualifying",
        "source echoes the derived source",
      );
    },
  );

  await test(
    "CON-248: persona attribute with source=classifier round-trips",
    async () => {
      const store = createInMemoryCasesStore();
      const created = await createCase(
        TENANT_A,
        { conversationId: CONVO_A, caseType: "lead" },
        { store },
      );

      await setCaseAttribute(
        TENANT_A,
        {
          caseId: created.id,
          key: "persona",
          value: "contractor",
          source: "classifier",
        },
        { store },
      );

      const attrs = await getCaseAttributes(TENANT_A, created.id, { store });
      assertEq(attrs.length, 1, "one persona row");
      assertEq(attrs[0].value as string, "contractor", "classifier value");
      assertEq(attrs[0].source, "classifier", "classifier source");
    },
  );

  await test(
    "CON-248: rewriting persona attribute overwrites value + source (upsert)",
    async () => {
      const store = createInMemoryCasesStore();
      const created = await createCase(
        TENANT_A,
        { conversationId: CONVO_A, caseType: "lead" },
        { store },
      );

      // First turn: classifier-guessed persona.
      await setCaseAttribute(
        TENANT_A,
        {
          caseId: created.id,
          key: "persona",
          value: "buyer",
          source: "classifier",
        },
        { store },
      );

      // Subsequent turn: visitor answered the qualifying question and
      // the declared value now wins.
      await setCaseAttribute(
        TENANT_A,
        {
          caseId: created.id,
          key: "persona",
          value: "farmer",
          source: "qualifying",
        },
        { store },
      );

      const attrs = await getCaseAttributes(TENANT_A, created.id, { store });
      assertEq(attrs.length, 1, "still one row (upsert, not insert)");
      assertEq(attrs[0].value as string, "farmer", "value overwritten");
      assertEq(
        attrs[0].source,
        "qualifying",
        "source overwritten to qualifying",
      );
    },
  );

  await test(
    "CON-248: getCaseAttributes finds the persona row among other attributes",
    async () => {
      // Mirrors the capture-route read path: attributes are looked up
      // by key === "persona" from a set that may include other keys
      // (buyer_intent, product_or_service, etc.).
      const store = createInMemoryCasesStore();
      const created = await createCase(
        TENANT_A,
        { conversationId: CONVO_A, caseType: "lead" },
        { store },
      );

      await setCaseAttribute(
        TENANT_A,
        {
          caseId: created.id,
          key: "buyer_intent",
          value: "high",
          source: "classifier",
          confidence: 0.9,
        },
        { store },
      );
      await setCaseAttribute(
        TENANT_A,
        {
          caseId: created.id,
          key: "persona",
          value: "farmer",
          source: "qualifying",
        },
        { store },
      );
      await setCaseAttribute(
        TENANT_A,
        {
          caseId: created.id,
          key: "product_or_service",
          value: "harvest",
          source: "classifier",
        },
        { store },
      );

      const attrs = await getCaseAttributes(TENANT_A, created.id, { store });
      assertEq(attrs.length, 3, "three attributes");
      const personaRow = attrs.find((a) => a.key === "persona");
      assert(personaRow !== undefined, "persona row found");
      assertEq(personaRow.value as string, "farmer", "persona value");
      assert(
        typeof personaRow.value === "string",
        "persona value is a string (capture route expects string)",
      );
    },
  );

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------

  console.log("");
  console.log(`Ran ${passed + failed} tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("");
    console.log("Failures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
}

runAll().catch((err) => {
  console.error("Test runner threw:", err);
  process.exit(1);
});
