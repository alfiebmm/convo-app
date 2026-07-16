#!/usr/bin/env node

import {
  BLOG_POST_PAGE_SIZE,
  listBlogPostsForTenant,
  parseBlogPostPage,
  type BlogPostsSupabaseClient,
} from "../queries";
import { mintSupabaseJwt } from "@/lib/supabase-client";

let passed = 0;
let failed = 0;
const tests: Array<{ name: string; fn: () => void | Promise<void> }> = [];

function test(name: string, fn: () => void | Promise<void>) {
  tests.push({ name, fn });
}

function assert(condition: unknown, msg: string) {
  if (!condition) throw new Error(msg);
}

function assertEq<T>(actual: T, expected: T, msg: string) {
  if (actual !== expected) {
    throw new Error(
      `${msg} - expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function decodeJwtPayload(jwt: string) {
  const payload = jwt.split(".")[1];
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
    role?: string;
    tenant_id?: string;
    sub?: string;
  };
}

class FakeBlogPostQuery {
  calls: Array<{ method: string; args: unknown[] }> = [];

  select(...args: unknown[]) {
    this.calls.push({ method: "select", args });
    return this;
  }

  eq(...args: unknown[]) {
    this.calls.push({ method: "eq", args });
    return this;
  }

  contains(...args: unknown[]) {
    this.calls.push({ method: "contains", args });
    return this;
  }

  order(...args: unknown[]) {
    this.calls.push({ method: "order", args });
    return this;
  }

  async range(...args: unknown[]) {
    this.calls.push({ method: "range", args });
    return {
      count: 1,
      error: null,
      data: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          title: "Choosing the right puppy class",
          status: "in_review",
          metadata: {
            topic: "Puppy training",
            persona: "New dog owner",
            word_count: "875",
          },
          created_at: "2026-07-01T00:00:00.000Z",
        },
      ],
    };
  }
}

function makeClient() {
  const query = new FakeBlogPostQuery();
  const client = {
    from(table: string) {
      query.calls.push({ method: "from", args: [table] });
      return query;
    },
  } as unknown as BlogPostsSupabaseClient;
  return { client, query };
}

test("listBlogPostsForTenant filters by status", async () => {
  const { client, query } = makeClient();
  await listBlogPostsForTenant({
    supabase: client,
    tenantId: "22222222-2222-4222-8222-222222222222",
    filters: { status: "approved" },
  });

  assert(
    query.calls.some(
      (call) =>
        call.method === "eq" &&
        call.args[0] === "status" &&
        call.args[1] === "approved",
    ),
    "status eq filter was not applied",
  );
});

test("listBlogPostsForTenant filters by topic metadata", async () => {
  const { client, query } = makeClient();
  await listBlogPostsForTenant({
    supabase: client,
    tenantId: "22222222-2222-4222-8222-222222222222",
    filters: { topic: " Puppy training " },
  });

  assert(
    query.calls.some(
      (call) =>
        call.method === "contains" &&
        call.args[0] === "metadata" &&
        JSON.stringify(call.args[1]) ===
          JSON.stringify({ topic: "Puppy training" }),
    ),
    "topic metadata contains filter was not applied",
  );
});

test("listBlogPostsForTenant filters by persona metadata", async () => {
  const { client, query } = makeClient();
  await listBlogPostsForTenant({
    supabase: client,
    tenantId: "22222222-2222-4222-8222-222222222222",
    filters: { persona: "New dog owner" },
  });

  assert(
    query.calls.some(
      (call) =>
        call.method === "contains" &&
        call.args[0] === "metadata" &&
        JSON.stringify(call.args[1]) ===
          JSON.stringify({ persona: "New dog owner" }),
    ),
    "persona metadata contains filter was not applied",
  );
});

test("listBlogPostsForTenant applies 25 per page pagination bounds", async () => {
  const { client, query } = makeClient();
  const result = await listBlogPostsForTenant({
    supabase: client,
    tenantId: "22222222-2222-4222-8222-222222222222",
    filters: { page: 2 },
  });

  assertEq(result.pageSize, BLOG_POST_PAGE_SIZE, "page size");
  assertEq(result.page, 2, "page");
  assert(
    query.calls.some(
      (call) =>
        call.method === "range" && call.args[0] === 25 && call.args[1] === 49,
    ),
    "page 2 range should be 25..49",
  );
  assertEq(parseBlogPostPage("0"), 1, "zero page clamps to one");
  assertEq(parseBlogPostPage("-10"), 1, "negative page clamps to one");
  assertEq(parseBlogPostPage("abc"), 1, "invalid page clamps to one");
});

test("listBlogPostsForTenant uses tenant-scoped authenticated query shape", async () => {
  const tenantId = "22222222-2222-4222-8222-222222222222";
  const { client, query } = makeClient();
  await listBlogPostsForTenant({ supabase: client, tenantId });

  assert(
    query.calls.some(
      (call) => call.method === "from" && call.args[0] === "blog_posts",
    ),
    "query should read blog_posts",
  );
  assert(
    query.calls.some(
      (call) =>
        call.method === "eq" &&
        call.args[0] === "tenant_id" &&
        call.args[1] === tenantId,
    ),
    "query should include tenant_id scope",
  );

  const jwt = mintSupabaseJwt({
    userId: "33333333-3333-4333-8333-333333333333",
    tenantId,
    secret: "test-secret",
    now: 1_785_000_000,
  });
  const payload = decodeJwtPayload(jwt);
  assertEq(payload.role, "authenticated", "JWT role");
  assertEq(payload.tenant_id, tenantId, "JWT tenant_id claim");
});

async function run() {
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`PASS ${name}`);
      passed++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`FAIL ${name}`);
      console.log(`   Error: ${message}`);
      failed++;
    }
  }

  console.log(`${passed} passed`);
  if (failed > 0) process.exit(1);
}

void run();
