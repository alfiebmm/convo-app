/**
 * CON-92 — streaming-config clamp + resolve unit tests.
 *
 * Run: `npx tsx __tests__/streaming-config.test.ts`
 *
 * Tiny zero-dependency runner. We don't have jest/vitest wired up yet — when
 * the repo gains a test framework, port these `assert` calls over.
 */
import assert from "node:assert/strict";
import {
  STREAMING_DEFAULTS,
  pickStreamingOverrides,
  resolveStreamingConfig,
} from "../src/lib/widget/streaming-config";

let passed = 0;
function it(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ok  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

console.log("streaming-config");

it("returns empty object for non-object input", () => {
  assert.deepEqual(pickStreamingOverrides(null), {});
  assert.deepEqual(pickStreamingOverrides(undefined), {});
  assert.deepEqual(pickStreamingOverrides("not-an-object"), {});
  assert.deepEqual(pickStreamingOverrides(42), {});
});

it("picks valid thinkingMinMs unchanged when in range", () => {
  assert.deepEqual(pickStreamingOverrides({ thinkingMinMs: 1500 }), {
    thinkingMinMs: 1500,
  });
  assert.deepEqual(pickStreamingOverrides({ thinkingMinMs: 0 }), {
    thinkingMinMs: 0,
  });
});

it("clamps thinkingMinMs to upper bound (6000)", () => {
  assert.deepEqual(pickStreamingOverrides({ thinkingMinMs: 99999 }), {
    thinkingMinMs: 6000,
  });
});

it("clamps thinkingMinMs to lower bound (0)", () => {
  assert.deepEqual(pickStreamingOverrides({ thinkingMinMs: -500 }), {
    thinkingMinMs: 0,
  });
});

it("rejects NaN / Infinity for thinkingMinMs", () => {
  assert.deepEqual(pickStreamingOverrides({ thinkingMinMs: NaN }), {});
  assert.deepEqual(pickStreamingOverrides({ thinkingMinMs: Infinity }), {});
});

it("rejects non-number thinkingMinMs", () => {
  assert.deepEqual(pickStreamingOverrides({ thinkingMinMs: "1500" }), {});
});

it("picks valid tokensPerSecond unchanged when in range", () => {
  assert.deepEqual(pickStreamingOverrides({ tokensPerSecond: 45 }), {
    tokensPerSecond: 45,
  });
});

it("clamps tokensPerSecond to bounds (10..200)", () => {
  assert.deepEqual(pickStreamingOverrides({ tokensPerSecond: 5 }), {
    tokensPerSecond: 10,
  });
  assert.deepEqual(pickStreamingOverrides({ tokensPerSecond: 1000 }), {
    tokensPerSecond: 200,
  });
});

it("returns both fields when both are valid", () => {
  assert.deepEqual(
    pickStreamingOverrides({ thinkingMinMs: 2000, tokensPerSecond: 40 }),
    { thinkingMinMs: 2000, tokensPerSecond: 40 }
  );
});

it("ignores unrelated keys", () => {
  assert.deepEqual(
    pickStreamingOverrides({
      thinkingMinMs: 1500,
      somethingElse: "nope",
      welcome: "hi",
    }),
    { thinkingMinMs: 1500 }
  );
});

it("resolveStreamingConfig fills in defaults when override is null", () => {
  assert.deepEqual(resolveStreamingConfig(null), STREAMING_DEFAULTS);
  assert.deepEqual(resolveStreamingConfig(undefined), STREAMING_DEFAULTS);
  assert.deepEqual(resolveStreamingConfig({}), STREAMING_DEFAULTS);
});

it("resolveStreamingConfig merges partial overrides over defaults", () => {
  assert.deepEqual(resolveStreamingConfig({ thinkingMinMs: 2500 }), {
    thinkingMinMs: 2500,
    tokensPerSecond: STREAMING_DEFAULTS.tokensPerSecond,
  });
});

it("resolveStreamingConfig respects explicit zero", () => {
  // 0 is a valid thinkingMinMs (disable the gate) — must not be replaced
  // by the default via `??`.
  assert.deepEqual(resolveStreamingConfig({ thinkingMinMs: 0 }), {
    thinkingMinMs: 0,
    tokensPerSecond: STREAMING_DEFAULTS.tokensPerSecond,
  });
});

console.log(`\n${passed} tests passed`);
