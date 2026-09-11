import assert from "node:assert/strict";
import { test } from "node:test";

import {
  publishBlogPost,
  type PublishBlogPostDeps,
} from "@/lib/blog/publish";
import type { BlogPostDetail } from "@/lib/blog/queries";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const ACTOR_ID = "22222222-2222-4222-9222-222222222222";
const POST_ID = "33333333-3333-4333-8333-333333333333";

function makePost(overrides: Partial<BlogPostDetail> = {}): BlogPostDetail {
  return {
    id: POST_ID,
    tenantId: TENANT_ID,
    threadId: null,
    title: "How to choose a puppy school",
    slug: "how-to-choose-a-puppy-school",
    content: "<p>Article body</p>",
    metadata: {},
    status: "approved",
    persona: "puppy buyers",
    topic: "puppy school",
    createdAt: new Date("2026-09-10T00:00:00.000Z"),
    publishedAt: null,
    lastModified: new Date("2026-09-10T00:00:00.000Z"),
    ...overrides,
  };
}

function makeDeps(options: {
  post?: BlogPostDetail | null;
  hasConfig?: boolean;
  publishOk?: boolean;
  publishError?: string;
} = {}): PublishBlogPostDeps & {
  updates: Parameters<PublishBlogPostDeps["updateBlogPost"]>[];
  publishCalls: Parameters<PublishBlogPostDeps["publishArticle"]>[];
} {
  const updates: Parameters<PublishBlogPostDeps["updateBlogPost"]>[] = [];
  const publishCalls: Parameters<PublishBlogPostDeps["publishArticle"]>[] = [];
  let tick = 0;

  return {
    updates,
    publishCalls,
    getBlogPost: async () =>
      Object.prototype.hasOwnProperty.call(options, "post")
        ? (options.post ?? null)
        : makePost(),
    getDecryptedWordPressConnectorForTenant: async () =>
      options.hasConfig === false
        ? null
        : {
            siteUrl: "https://doggo.com.au",
            username: "editor",
            applicationPassword: "secret app password",
          },
    updateBlogPost: async (...args) => {
      updates.push(args);
    },
    publishArticle: async (...args) => {
      publishCalls.push(args);
      if (options.publishOk === false) {
        return {
          ok: false as const,
          error: options.publishError ?? "WordPress refused access",
        };
      }
      return {
        ok: true as const,
        wpPostId: 123,
        wpPostUrl: "https://doggo.com.au/how-to-choose-a-puppy-school/",
      };
    },
    now: () => new Date(`2026-09-10T00:00:0${tick++}.000Z`),
  };
}

async function runPublish(deps: PublishBlogPostDeps) {
  return publishBlogPost(
    POST_ID,
    { tenantId: TENANT_ID, actorUserId: ACTOR_ID },
    deps,
  );
}

test("no config returns not configured and does not transition status", async () => {
  const deps = makeDeps({ hasConfig: false });

  const result = await runPublish(deps);

  assert.deepEqual(result, {
    ok: false,
    error: "WordPress connection not configured",
  });
  assert.equal(deps.updates.length, 0);
  assert.equal(deps.publishCalls.length, 0);
});

test("invalid status rejects with a clear error", async () => {
  const deps = makeDeps({ post: makePost({ status: "generation_failed" }) });

  const result = await runPublish(deps);

  assert.deepEqual(result, {
    ok: false,
    error: "Blog post cannot be published from generation_failed status",
  });
  assert.equal(deps.updates.length, 0);
});

test("success publishes article and persists WordPress metadata", async () => {
  const deps = makeDeps();

  const result = await runPublish(deps);

  assert.deepEqual(result, {
    ok: true,
    wpPostId: 123,
    wpPostUrl: "https://doggo.com.au/how-to-choose-a-puppy-school/",
  });
  assert.equal(deps.publishCalls.length, 1);
  assert.equal(deps.publishCalls[0][0].applicationPassword, "secret app password");
  assert.equal(deps.updates[0][2].status, "publishing");
  assert.equal(deps.updates[1][2].status, "published");
  assert.deepEqual(deps.updates[1][2].metadata.published, {
    wp_post_id: 123,
    wp_post_url: "https://doggo.com.au/how-to-choose-a-puppy-school/",
    published_at: "2026-09-10T00:00:01.000Z",
    published_by: ACTOR_ID,
  });
});

test("failure transitions to publish_failed and stores exact error", async () => {
  const deps = makeDeps({
    publishOk: false,
    publishError: "WordPress credentials were rejected",
  });

  const result = await runPublish(deps);

  assert.deepEqual(result, {
    ok: false,
    error: "WordPress credentials were rejected",
  });
  assert.equal(deps.updates[1][2].status, "publish_failed");
  assert.deepEqual(deps.updates[1][2].metadata.publish_error, {
    message: "WordPress credentials were rejected",
    at: "2026-09-10T00:00:01.000Z",
  });
});

test("re-publish preserves existing WordPress post id for connector PUT path", async () => {
  const deps = makeDeps({
    post: makePost({
      status: "published",
      metadata: {
        published: {
          wp_post_id: 999,
          wp_post_url: "https://doggo.com.au/old/",
        },
      },
    }),
  });

  const result = await runPublish(deps);

  assert.equal(result.ok, true);
  assert.equal(deps.publishCalls.length, 1);
  assert.deepEqual(deps.publishCalls[0][1].metadata.published, {
    wp_post_id: 999,
    wp_post_url: "https://doggo.com.au/old/",
  });
});
