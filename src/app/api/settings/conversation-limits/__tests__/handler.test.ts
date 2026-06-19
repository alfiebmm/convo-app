#!/usr/bin/env node
import {
  handleConversationLimitsPatch,
  type ConversationLimitsDeps,
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

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return JSON.parse(await res.text()) as Record<string, unknown>;
}

function makeDeps(initial: Record<string, Record<string, unknown>>) {
  const store: Record<string, Record<string, unknown>> = JSON.parse(
    JSON.stringify(initial),
  );
  const deps: ConversationLimitsDeps & {
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
  await test("PATCH rejects out-of-range limits", async () => {
    const deps = makeDeps({ "tenant-a": {} });
    const res = await handleConversationLimitsPatch(
      "tenant-a",
      { maxTurnsBeforeCTA: 0, idleTimeoutMinutes: 121 },
      deps,
    );
    assertEq(res.status, 400, "status");
    assertEq(deps._writes.length, 0, "no writes");
  });

  await test("PATCH deep-merges limits and preserves other settings", async () => {
    const deps = makeDeps({
      "tenant-a": {
        widget: { primaryColor: "#FF6B2C" },
        guardrails: {
          audiences: [{ id: "a1" }],
          topicBoundaries: {
            allow: ["dogs"],
            deflect: [{ topic: "vet", response: "Ask a vet." }],
            hardBlock: ["harm"],
          },
          conversationLimits: {
            maxTurnsBeforeCTA: 3,
            idleTimeoutMinutes: 15,
          },
        },
      },
    });
    const res = await handleConversationLimitsPatch(
      "tenant-a",
      { maxTurnsBeforeCTA: 8, idleTimeoutMinutes: 30 },
      deps,
    );
    assertEq(res.status, 200, "status");
    const body = await readJson(res);
    const limits = body.conversationLimits as Record<string, unknown>;
    assertEq(limits.maxTurnsBeforeCTA, 8, "max turns response");
    assertEq(limits.idleTimeoutMinutes, 30, "idle timeout response");

    const stored = deps._readStore("tenant-a") as Record<string, unknown>;
    const widget = stored.widget as Record<string, unknown>;
    assertEq(widget.primaryColor, "#FF6B2C", "widget preserved");
    const guardrails = stored.guardrails as Record<string, unknown>;
    assert(Array.isArray(guardrails.audiences), "audiences preserved");
    const topicBoundaries = guardrails.topicBoundaries as Record<string, unknown>;
    const allow = topicBoundaries.allow as string[];
    assertEq(allow[0], "dogs", "topic allow preserved");
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run();
