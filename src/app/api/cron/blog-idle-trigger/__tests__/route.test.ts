#!/usr/bin/env node

import {
  handleBlogIdleTrigger,
  type BlogIdleTriggerDeps,
} from "../route";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`OK ${name}`);
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

function req(url: string, headers = new Headers()) {
  return {
    headers,
    nextUrl: new URL(url),
  };
}

async function readJson(res: Response) {
  return JSON.parse(await res.text());
}

function deps(
  overrides: Partial<BlogIdleTriggerDeps> = {}
): BlogIdleTriggerDeps {
  return {
    schedule: () => {},
    triggerIdleBlogPipelines: async () => ({
      scannedTenants: 0,
      queued: 0,
      skipped: 0,
      notFound: 0,
    }),
    ...overrides,
  };
}

async function run() {
  await test("unparametrised GET keeps triggering all active tenants", async () => {
    let tenantId: string | undefined = "not-called";
    const res = await handleBlogIdleTrigger(
      req("https://example.com/api/cron/blog-idle-trigger"),
      deps({
        triggerIdleBlogPipelines: async (options) => {
          tenantId = options.tenantId;
          return { scannedTenants: 2, queued: 1, skipped: 0, notFound: 0 };
        },
      })
    );

    assertEq(res.status, 200, "status");
    assertEq(tenantId, undefined, "tenant id");
    const body = (await readJson(res)) as { scannedTenants?: number };
    assertEq(body.scannedTenants, 2, "scanned tenants");
  });

  await test("tenantId query param is forwarded to idle trigger", async () => {
    const scopedTenantId = "11111111-1111-4111-8111-111111111111";
    let tenantId: string | undefined;
    const res = await handleBlogIdleTrigger(
      req(`https://example.com/api/cron/blog-idle-trigger?tenantId=${scopedTenantId}`),
      deps({
        triggerIdleBlogPipelines: async (options) => {
          tenantId = options.tenantId;
          return { scannedTenants: 1, queued: 1, skipped: 0, notFound: 0 };
        },
      })
    );

    assertEq(res.status, 200, "status");
    assertEq(tenantId, scopedTenantId, "tenant id");
  });

  await test("invalid tenantId query param returns 400", async () => {
    let called = false;
    const res = await handleBlogIdleTrigger(
      req("https://example.com/api/cron/blog-idle-trigger?tenantId=not-a-uuid"),
      deps({
        triggerIdleBlogPipelines: async () => {
          called = true;
          return { scannedTenants: 0, queued: 0, skipped: 0, notFound: 0 };
        },
      })
    );

    assertEq(res.status, 400, "status");
    assertEq(called, false, "trigger not called");
    const body = (await readJson(res)) as { error?: string };
    assertEq(body.error, "invalid_tenant_id", "error");
  });

  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
