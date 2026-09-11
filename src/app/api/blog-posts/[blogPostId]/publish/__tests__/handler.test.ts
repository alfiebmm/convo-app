import assert from "node:assert/strict";
import { test } from "node:test";

import {
  handleBlogPostPublishPost,
  type BlogPostPublishRouteDeps,
} from "../handler";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-9222-222222222222";
const POST_ID = "33333333-3333-4333-8333-333333333333";

async function json(response: Response) {
  return JSON.parse(await response.text()) as Record<string, unknown>;
}

function makeDeps(options: {
  userId?: string | null;
  tenantId?: string | null;
  role?: "owner" | "admin" | "editor" | "viewer" | null;
  publishOk?: boolean;
} = {}): BlogPostPublishRouteDeps {
  return {
    getSessionUserId: async () =>
      Object.prototype.hasOwnProperty.call(options, "userId")
        ? (options.userId ?? null)
        : USER_ID,
    getPostTenantId: async () =>
      Object.prototype.hasOwnProperty.call(options, "tenantId")
        ? (options.tenantId ?? null)
        : TENANT_ID,
    getTenantMembership: async () => {
      if (options.role === null) return null as Awaited<
        ReturnType<BlogPostPublishRouteDeps["getTenantMembership"]>
      >;
      return {
            role: options.role ?? "editor",
            tenantId: TENANT_ID,
            userId: USER_ID,
      } as Awaited<ReturnType<BlogPostPublishRouteDeps["getTenantMembership"]>>;
    },
    publishBlogPost: async () =>
      options.publishOk === false
        ? { ok: false, error: "WordPress connection not configured" }
        : {
            ok: true,
            wpPostId: 123,
            wpPostUrl: "https://doggo.com.au/article/",
          },
  };
}

test("returns 401 without session", async () => {
  const response = await handleBlogPostPublishPost(
    POST_ID,
    makeDeps({ userId: null }),
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await json(response), { ok: false, error: "Unauthorized" });
});

test("returns 403 for non-member", async () => {
  const response = await handleBlogPostPublishPost(
    POST_ID,
    makeDeps({ role: null }),
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await json(response), { ok: false, error: "Forbidden" });
});

test("returns 200 on success", async () => {
  const response = await handleBlogPostPublishPost(POST_ID, makeDeps());

  assert.equal(response.status, 200);
  assert.deepEqual(await json(response), {
    ok: true,
    wpPostId: 123,
    wpPostUrl: "https://doggo.com.au/article/",
  });
});
