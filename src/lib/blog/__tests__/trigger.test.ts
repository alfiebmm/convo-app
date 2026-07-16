#!/usr/bin/env node

import {
  requestBlogPipeline,
  type BlogTriggerDeps,
  type ScheduleBlogTask,
} from "../trigger";
import { resolveBlogIdleMinutes } from "../config";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`PASS ${name}`);
    passed++;
  } catch (error) {
    failed++;
    console.log(`FAIL ${name}`);
    console.log(`  ${error instanceof Error ? error.message : String(error)}`);
  }
}

function assertEq<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function createDeps(
  overrides: Partial<BlogTriggerDeps> = {}
): BlogTriggerDeps {
  return {
    findConversation: async () => ({
      id: "conversation-a",
      tenantId: "tenant-a",
      status: "active",
      metadata: {},
      completedAt: null,
    }),
    hasBlogPostForThread: async () => false,
    saveTriggerState: async () => {},
    runBlogPipeline: async () => {},
    ...overrides,
  };
}

function immediateSchedule(calls: Array<() => Promise<void>>): ScheduleBlogTask {
  return (task) => {
    calls.push(task);
  };
}

async function run() {
  await test("manual trigger queues the pipeline in the background", async () => {
    const tasks: Array<() => Promise<void>> = [];
    let saved = false;
    let ranFor: string | null = null;
    const res = await requestBlogPipeline("conversation-a", {
      source: "manual",
      schedule: immediateSchedule(tasks),
      deps: createDeps({
        saveTriggerState: async () => {
          saved = true;
        },
        runBlogPipeline: async (conversationId) => {
          ranFor = conversationId;
        },
      }),
    });

    assertEq(res.status, "queued", "status");
    assertEq(saved, true, "trigger state saved");
    assertEq(tasks.length, 1, "background task count");
    await tasks[0]();
    assertEq(ranFor, "conversation-a", "pipeline conversation id");
  });

  await test("trigger skips when a blog post already exists for thread_id", async () => {
    const tasks: Array<() => Promise<void>> = [];
    const res = await requestBlogPipeline("conversation-a", {
      source: "manual",
      schedule: immediateSchedule(tasks),
      deps: createDeps({
        hasBlogPostForThread: async () => true,
      }),
    });

    assertEq(res.status, "skipped", "status");
    assertEq(
      res.status === "skipped" ? res.reason : "",
      "duplicate_thread_id",
      "skip reason"
    );
    assertEq(tasks.length, 0, "background task count");
  });

  await test("trigger skips when metadata already marks blog conversion", async () => {
    const tasks: Array<() => Promise<void>> = [];
    const res = await requestBlogPipeline("conversation-a", {
      source: "idle",
      schedule: immediateSchedule(tasks),
      deps: createDeps({
        findConversation: async () => ({
          id: "conversation-a",
          tenantId: "tenant-a",
          status: "completed",
          metadata: { blogConversion: { state: "converted_to_blog" } },
          completedAt: new Date("2026-07-16T00:00:00.000Z"),
        }),
      }),
    });

    assertEq(res.status, "skipped", "status");
    assertEq(
      res.status === "skipped" ? res.reason : "",
      "already_triggered",
      "skip reason"
    );
    assertEq(tasks.length, 0, "background task count");
  });

  await test("idle timer reads forumConfig.blog.idleMinutes", () => {
    const minutes = resolveBlogIdleMinutes({
      forumConfig: { blog: { idleMinutes: 15 } },
    });
    assertEq(minutes, 15, "idle minutes");
  });

  console.log(`${passed} passed`);
  if (failed > 0) process.exit(1);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

