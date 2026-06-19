#!/usr/bin/env node
import {
  handleTopicBoundariesPatch,
  type TopicBoundariesDeps,
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

function assert(cond: unknown, label: string) {
  if (!cond) throw new Error(label);
}

function assertEq<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function makeDeps(initial: Record<string, Record<string, unknown>>) {
  const store: Record<string, Record<string, unknown>> = JSON.parse(
    JSON.stringify(initial),
  );
  const deps: TopicBoundariesDeps & {
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

async function run() {
  await test("PATCH rejects invalid topic-boundaries shape", async () => {
    const deps = makeDeps({ "tenant-a": {} });
    const res = await handleTopicBoundariesPatch(
      "tenant-a",
      { deflect: [{ topic: "vet", response: 42 }], hardBlock: ["harm"] },
      deps,
    );
    assertEq(res.status, 400, "status");
    assertEq(deps._writes.length, 0, "no writes");
  });

  await test("PATCH updates deflect and hardBlock while preserving allow", async () => {
    const deps = makeDeps({
      "tenant-a": {
        cms: { type: "wordpress" },
        guardrails: {
          audiences: [{ id: "a1" }],
          topicBoundaries: {
            allow: ["breed info"],
            deflect: [{ topic: "old", response: "old response" }],
            hardBlock: ["old block"],
          },
          conversationLimits: {
            maxTurnsBeforeCTA: 5,
            idleTimeoutMinutes: 10,
          },
        },
      },
    });
    const res = await handleTopicBoundariesPatch(
      "tenant-a",
      {
        deflect: [{ topic: "medical advice", response: "Please ask a vet." }],
        hardBlock: ["harm"],
      },
      deps,
    );
    assertEq(res.status, 200, "status");

    const stored = deps._readStore("tenant-a") as Record<string, unknown>;
    const cms = stored.cms as Record<string, unknown>;
    assertEq(cms.type, "wordpress", "cms preserved");
    const guardrails = stored.guardrails as Record<string, unknown>;
    assert(Array.isArray(guardrails.audiences), "audiences preserved");
    const topicBoundaries = guardrails.topicBoundaries as Record<string, unknown>;
    const allow = topicBoundaries.allow as string[];
    const hardBlock = topicBoundaries.hardBlock as string[];
    const deflect = topicBoundaries.deflect as Record<string, unknown>[];
    assertEq(allow[0], "breed info", "allow preserved");
    assertEq(hardBlock[0], "harm", "hard block updated");
    assertEq(deflect[0].topic, "medical advice", "deflect updated");
    const limits = guardrails.conversationLimits as Record<string, unknown>;
    assertEq(limits.maxTurnsBeforeCTA, 5, "conversation limits preserved");
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run();
