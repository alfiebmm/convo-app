#!/usr/bin/env node

import { Buffer } from "node:buffer";
import assert from "node:assert/strict";
import test from "node:test";

import type { BlogPostDetail } from "@/lib/blog/queries";
import {
  publishArticle,
  verifyCredentials,
  type WordPressConfig,
} from "@/lib/blog/connectors/wordpress";

const config: WordPressConfig = {
  siteUrl: "https://example.com",
  username: "editor",
  applicationPassword: "abcd efgh ijkl mnop",
};

function makePost(overrides: Partial<BlogPostDetail> = {}): BlogPostDetail {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    tenantId: "22222222-2222-4222-8222-222222222222",
    threadId: null,
    title: "How to choose a puppy class",
    slug: "choose-puppy-class",
    content: "<h1>How to choose a puppy class</h1><p>Start here.</p>",
    metadata: {},
    status: "approved",
    persona: "Dog owner",
    topic: "Puppy training",
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    publishedAt: null,
    lastModified: new Date("2026-08-01T00:00:00.000Z"),
    ...overrides,
  };
}

type FetchCall = {
  url: string | URL | Request;
  init: RequestInit | undefined;
};

function mockFetch(responses: Response[]) {
  const previousFetch = globalThis.fetch;
  const calls: FetchCall[] = [];

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url, init });
    const response = responses.shift();
    if (!response) throw new Error("Unexpected fetch call");
    return response;
  }) as typeof fetch;

  return {
    calls,
    restore() {
      globalThis.fetch = previousFetch;
    },
  };
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function expectedAuthHeader() {
  return `Basic ${Buffer.from(
    `${config.username}:${config.applicationPassword}`,
    "utf8",
  ).toString("base64")}`;
}

function headerValue(init: RequestInit | undefined, name: string) {
  const headers = init?.headers as Record<string, string> | undefined;
  return headers?.[name];
}

test("verifyCredentials returns normalized site URL when credentials are accepted", async () => {
  const fetchMock = mockFetch([jsonResponse(200, { id: 10 })]);
  try {
    const result = await verifyCredentials({
      ...config,
      siteUrl: "https://example.com/",
    });

    assert.deepEqual(result, { ok: true, siteUrl: "https://example.com" });
    assert.equal(
      String(fetchMock.calls[0].url),
      "https://example.com/wp-json/wp/v2/users/me",
    );
    assert.equal(fetchMock.calls[0].init?.method, "GET");
    assert.equal(
      headerValue(fetchMock.calls[0].init, "Authorization"),
      expectedAuthHeader(),
    );
  } finally {
    fetchMock.restore();
  }
});

test("verifyCredentials maps 401, 403, and 404 failures", async () => {
  for (const [status, error] of [
    [401, "WordPress credentials were rejected"],
    [403, "WordPress refused access"],
    [404, "WordPress REST API was not found"],
  ] as const) {
    const fetchMock = mockFetch([jsonResponse(status, {})]);
    try {
      assert.deepEqual(await verifyCredentials(config), { ok: false, error });
    } finally {
      fetchMock.restore();
    }
  }
});

test("verifyCredentials retries a 5xx once and then fails", async () => {
  const fetchMock = mockFetch([jsonResponse(500, {}), jsonResponse(502, {})]);
  try {
    assert.deepEqual(await verifyCredentials(config), {
      ok: false,
      error: "WordPress is temporarily unavailable",
    });
    assert.equal(fetchMock.calls.length, 2);
  } finally {
    fetchMock.restore();
  }
});

test("publishArticle creates a live post with JSON body and returns WordPress details", async () => {
  const fetchMock = mockFetch([
    jsonResponse(201, {
      id: 123,
      link: "https://example.com/choose-puppy-class/",
    }),
  ]);
  try {
    const result = await publishArticle(
      config,
      makePost({
        metadata: {
          excerpt: "A practical puppy class guide.",
          meta: { source: "convo" },
          categories: [7],
          tags: [11, 12],
        },
      }),
    );

    assert.deepEqual(result, {
      ok: true,
      wpPostId: 123,
      wpPostUrl: "https://example.com/choose-puppy-class/",
    });
    assert.equal(
      String(fetchMock.calls[0].url),
      "https://example.com/wp-json/wp/v2/posts",
    );
    assert.equal(fetchMock.calls[0].init?.method, "POST");
    assert.equal(
      headerValue(fetchMock.calls[0].init, "Content-Type"),
      "application/json",
    );
    assert.equal(
      headerValue(fetchMock.calls[0].init, "Authorization"),
      expectedAuthHeader(),
    );
    assert.deepEqual(JSON.parse(String(fetchMock.calls[0].init?.body)), {
      title: "How to choose a puppy class",
      content: "<h1>How to choose a puppy class</h1><p>Start here.</p>",
      slug: "choose-puppy-class",
      status: "publish",
      excerpt: "A practical puppy class guide.",
      meta: { source: "convo" },
      categories: [7],
      tags: [11, 12],
    });
  } finally {
    fetchMock.restore();
  }
});

test("publishArticle updates an existing WordPress post when metadata has wp_post_id", async () => {
  const fetchMock = mockFetch([
    jsonResponse(200, {
      id: 456,
      link: "https://example.com/updated-post/",
    }),
  ]);
  try {
    const result = await publishArticle(
      config,
      makePost({ metadata: { published: { wp_post_id: 456 } } }),
    );

    assert.deepEqual(result, {
      ok: true,
      wpPostId: 456,
      wpPostUrl: "https://example.com/updated-post/",
    });
    assert.equal(
      String(fetchMock.calls[0].url),
      "https://example.com/wp-json/wp/v2/posts/456",
    );
    assert.equal(fetchMock.calls[0].init?.method, "PUT");
  } finally {
    fetchMock.restore();
  }
});

test("publishArticle maps 401, 403, and 404 failures", async () => {
  for (const [status, error] of [
    [401, "WordPress credentials were rejected"],
    [403, "WordPress refused access"],
    [404, "WordPress REST API was not found"],
  ] as const) {
    const fetchMock = mockFetch([jsonResponse(status, {})]);
    try {
      assert.deepEqual(await publishArticle(config, makePost()), {
        ok: false,
        error,
      });
    } finally {
      fetchMock.restore();
    }
  }
});

test("publishArticle retries a 5xx once and then fails", async () => {
  const fetchMock = mockFetch([jsonResponse(500, {}), jsonResponse(503, {})]);
  try {
    assert.deepEqual(await publishArticle(config, makePost()), {
      ok: false,
      error: "WordPress is temporarily unavailable",
    });
    assert.equal(fetchMock.calls.length, 2);
  } finally {
    fetchMock.restore();
  }
});
