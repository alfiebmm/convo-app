#!/usr/bin/env node

import {
  requestBlogPipeline,
  triggerIdleBlogPipelines,
  type BlogTriggerDeps,
  type IdleBlogTriggerDeps,
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
    runBlogPipeline: async () => null,
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
    const savedPostIds: Array<string | null | undefined> = [];
    let ranFor: string | null = null;
    const res = await requestBlogPipeline("conversation-a", {
      source: "manual",
      schedule: immediateSchedule(tasks),
      deps: createDeps({
        saveTriggerState: async (...args) => {
          savedPostIds.push(args[4]);
        },
        runBlogPipeline: async (conversationId) => {
          ranFor = conversationId;
          return {
            conversationId,
            decision: {
              action: "create",
              reason: "Low similarity.",
              similar_posts: [],
              primary_keyword: "pharmacists",
              intent: "educational",
            },
            blogPostId: "blog-post-1",
          };
        },
      }),
    });

    assertEq(res.status, "queued", "status");
    assertEq(savedPostIds.length, 0, "state is not saved before pipeline result");
    assertEq(tasks.length, 1, "background task count");
    await tasks[0]();
    assertEq(ranFor, "conversation-a", "pipeline conversation id");
    assertEq(savedPostIds.length, 1, "converted state saved");
    assertEq(savedPostIds[0], "blog-post-1", "blog post id stored");
  });

  await test("pipeline failure does not mark the conversation converted", async () => {
    const tasks: Array<() => Promise<void>> = [];
    let saveCount = 0;
    const res = await requestBlogPipeline("conversation-a", {
      source: "manual",
      schedule: immediateSchedule(tasks),
      deps: createDeps({
        saveTriggerState: async () => {
          saveCount++;
        },
        runBlogPipeline: async () => {
          throw new Error("article generation timed out");
        },
      }),
    });

    assertEq(res.status, "queued", "status");
    await tasks[0]();
    assertEq(saveCount, 0, "state saves");
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

  await test("idle trigger can scan one tenant by tenantId", async () => {
    const tenantA = "11111111-1111-4111-8111-111111111111";
    const tenantB = "22222222-2222-4222-8222-222222222222";
    const requestedTenantIds: Array<string | undefined> = [];
    const scannedTenantIds: string[] = [];
    const triggeredTenantIds: Array<string | undefined> = [];
    const deps: IdleBlogTriggerDeps = {
      findTenants: async (tenantId) => {
        requestedTenantIds.push(tenantId);
        return [
          { id: tenantA, settings: {} },
          { id: tenantB, settings: {} },
        ].filter((tenant) => !tenantId || tenant.id === tenantId);
      },
      findIdleConversationIds: async ({ tenantId }) => {
        scannedTenantIds.push(tenantId);
        return [`conversation-${tenantId}`];
      },
      requestPipeline: async (_conversationId, options) => {
        triggeredTenantIds.push(options.tenantId);
        return { status: "queued", conversationId: _conversationId };
      },
    };

    const summary = await triggerIdleBlogPipelines({
      schedule: immediateSchedule([]),
      tenantId: tenantB,
      deps,
    });

    assertEq(requestedTenantIds[0], tenantB, "tenant filter passed to query");
    assertEq(summary.scannedTenants, 1, "scanned tenant count");
    assertEq(summary.queued, 1, "queued count");
    assertEq(scannedTenantIds.length, 1, "idle tenant scan count");
    assertEq(scannedTenantIds[0], tenantB, "idle tenant scan id");
    assertEq(triggeredTenantIds[0], tenantB, "trigger tenant id");
  });

  console.log(`${passed} passed`);
  if (failed > 0) process.exit(1);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
