#!/usr/bin/env node

import {
  BLOG_POST_PAGE_SIZE,
  computeBlogPostWordCountFallback,
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
  constructor(private data = defaultRows()) {}

  select(...args: unknown[]) {
    this.calls.push({ method: "select", args });
    return this;
  }

  eq(...args: unknown[]) {
    this.calls.push({ method: "eq", args });
    return this;
  }

  in(...args: unknown[]) {
    this.calls.push({ method: "in", args });
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
      data: this.data,
    };
  }
}

type FakeBlogPostRow = {
  id: string;
  title: string | null;
  status: "draft" | "in_review" | "approved" | "published" | "rejected";
  topic: string | null;
  persona: string | null;
  content: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

function defaultRows(): FakeBlogPostRow[] {
  return [
    {
      id: "11111111-1111-4111-8111-111111111111",
      title: "Choosing the right puppy class",
      status: "in_review",
      topic: "Puppy training",
      persona: "New dog owner",
      content: "<html><body><p>Puppy class guide content.</p></body></html>",
      metadata: {
        topic: "Metadata topic",
        persona: "Metadata persona",
        word_count: "875",
      },
      created_at: "2026-07-01T00:00:00.000Z",
    },
  ];
}

function makeClient(data = defaultRows()) {
  const query = new FakeBlogPostQuery(data);
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

test("listBlogPostsForTenant excludes failed generations by default", async () => {
  const { client, query } = makeClient();
  await listBlogPostsForTenant({
    supabase: client,
    tenantId: "22222222-2222-4222-8222-222222222222",
  });

  const statusFilter = query.calls.find(
    (call) => call.method === "in" && call.args[0] === "status",
  );

  if (!statusFilter) {
    throw new Error("default status IN filter was not applied");
  }

  assert(
    Array.isArray(statusFilter.args[1]) &&
      !statusFilter.args[1].includes("generation_failed"),
    "default status IN filter should exclude generation_failed",
  );
});

test("listBlogPostsForTenant includes failed generations when requested", async () => {
  const { client, query } = makeClient();
  await listBlogPostsForTenant({
    supabase: client,
    tenantId: "22222222-2222-4222-8222-222222222222",
    filters: { includeFailed: true },
  });

  assert(
    !query.calls.some(
      (call) => call.method === "in" && call.args[0] === "status",
    ),
    "status IN filter should be skipped when failed generations are included",
  );
});

test("listBlogPostsForTenant maps top-level topic and persona columns", async () => {
  const { client } = makeClient();
  const result = await listBlogPostsForTenant({
    supabase: client,
    tenantId: "22222222-2222-4222-8222-222222222222",
  });

  assertEq(result.rows[0].topic, "Puppy training", "topic");
  assertEq(result.rows[0].persona, "New dog owner", "persona");
});

test("listBlogPostsForTenant falls back to metadata topic and persona", async () => {
  const { client } = makeClient([
    {
      ...defaultRows()[0],
      topic: null,
      persona: " ",
      metadata: {
        topic: "Metadata topic",
        persona: "Metadata persona",
      },
    },
  ]);

  const result = await listBlogPostsForTenant({
    supabase: client,
    tenantId: "22222222-2222-4222-8222-222222222222",
  });

  assertEq(result.rows[0].topic, "Metadata topic", "topic metadata fallback");
  assertEq(result.rows[0].persona, "Metadata persona", "persona metadata fallback");
});

test("listBlogPostsForTenant maps word count from metadata stats", async () => {
  const { client } = makeClient([
    {
      ...defaultRows()[0],
      metadata: { stats: { wordCount: 912 } },
    },
  ]);

  const result = await listBlogPostsForTenant({
    supabase: client,
    tenantId: "22222222-2222-4222-8222-222222222222",
  });

  assertEq(result.rows[0].wordCount, 912, "stats wordCount");
});

test("listBlogPostsForTenant computes word count from rendered content", async () => {
  const { client } = makeClient([
    {
      ...defaultRows()[0],
      content:
        '<html><head><title>Ignored title</title></head><body><div class="gh-blog-article-body"><div class="gh-blog-article-content"><p>One two three.</p><h2>First section</h2><p>Four five.</p></div></div><footer>Ignored footer words</footer></body></html>',
      metadata: {},
    },
  ]);

  const result = await listBlogPostsForTenant({
    supabase: client,
    tenantId: "22222222-2222-4222-8222-222222222222",
  });

  assertEq(result.rows[0].wordCount, 5, "rendered content word count");
});

test("computeBlogPostWordCountFallback prefers metadata intro and paragraph blocks", () => {
  const count = computeBlogPostWordCountFallback(
    "<html><body><p>Rendered content should not win.</p></body></html>",
    {
      intro: "One two three.",
      dek: "Dek content is ignored.",
      sections: [
        {
          heading: "Section one",
          blocks: [
            { type: "p", text: "Four five six seven." },
            { type: "keyTakeaway", body: "Ignored takeaway copy." },
            { type: "ul", items: ["Ignored list words"] },
          ],
        },
        {
          heading: "Section two",
          blocks: [
            { type: "p", text: "Eight nine." },
            { type: "h3", text: "Ignored heading words." },
          ],
        },
      ],
    },
  );

  assertEq(count, 9, "metadata intro plus paragraph block word count");
});

test("computeBlogPostWordCountFallback handles zero-word metadata intro", () => {
  const count = computeBlogPostWordCountFallback(null, {
    intro: " ",
    sections: [
      {
        heading: "Section one",
        blocks: [{ type: "p", text: "One two three." }],
      },
    ],
  });

  assertEq(count, 3, "empty intro should not block metadata path");
});

test("computeBlogPostWordCountFallback falls back to scoped rendered HTML", () => {
  const count = computeBlogPostWordCountFallback(
    `
      <html>
        <body>
          <header><p>Ignored header copy.</p></header>
          <div class="gh-blog-article-body">
            <nav class="gh-blog-toc"><p>Ignored table of contents.</p></nav>
            <div class="gh-blog-article-content">
              <p>Intro counts here.</p>
              <aside class="gh-blog-key-takeaway"><p>Ignored takeaway copy.</p></aside>
              <h2>First section</h2>
              <p>Body words count.</p>
              <ul><li>Ignored list copy.</li></ul>
              <h2>Second section</h2>
              <p>More body words.</p>
            </div>
            <section class="gh-blog-article-faq">
              <details class="gh-blog-faq-item"><summary>Ignored question?</summary><p>Ignored answer.</p></details>
            </section>
          </div>
          <footer><p>Ignored footer copy.</p></footer>
        </body>
      </html>
    `,
    { intro: "metadata without sections should fall back" },
  );

  assertEq(count, 9, "scoped rendered HTML word count");
});

test("computeBlogPostWordCountFallback falls back for malformed metadata sections", () => {
  const count = computeBlogPostWordCountFallback(
    '<div class="gh-blog-article-body"><div class="gh-blog-article-content"><p>Intro copy.</p><h2>Section</h2><p>Body copy here.</p></div></div>',
    {
      intro: "Metadata intro ignored.",
      sections: [{ heading: "Malformed section" }],
    },
  );

  assertEq(count, 5, "malformed sections should use HTML fallback");
});

test("listBlogPostsForTenant filters by topic column", async () => {
  const { client, query } = makeClient();
  await listBlogPostsForTenant({
    supabase: client,
    tenantId: "22222222-2222-4222-8222-222222222222",
    filters: { topic: " Puppy training " },
  });

  assert(
    query.calls.some(
      (call) =>
        call.method === "eq" &&
        call.args[0] === "topic" &&
        call.args[1] === "Puppy training",
    ),
    "topic column filter was not applied",
  );
});

test("listBlogPostsForTenant filters by persona column", async () => {
  const { client, query } = makeClient();
  await listBlogPostsForTenant({
    supabase: client,
    tenantId: "22222222-2222-4222-8222-222222222222",
    filters: { persona: "New dog owner" },
  });

  assert(
    query.calls.some(
      (call) =>
        call.method === "eq" &&
        call.args[0] === "persona" &&
        call.args[1] === "New dog owner",
    ),
    "persona column filter was not applied",
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
        call.method === "select" &&
        typeof call.args[0] === "string" &&
        call.args[0].includes("topic") &&
        call.args[0].includes("persona") &&
        call.args[0].includes("content"),
    ),
    "list query should select topic, persona, and content",
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
