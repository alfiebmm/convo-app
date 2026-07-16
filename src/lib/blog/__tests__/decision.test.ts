import { test } from "node:test";
import assert from "node:assert/strict";

import { __testing, type DecisionAction } from "@/lib/blog/decision";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const CONVERSATION_ID = "22222222-2222-4222-8222-222222222222";

type TestStore = {
  logs: unknown[];
  similarPosts: Array<{
    blog_post_id: string;
    score: number;
    title: string;
    slug: string;
    content: string;
    last_modified: Date;
  }>;
  loadConversation: (conversationId: string) => Promise<{
    conversation: { id: string; tenantId: string };
    tenant: { id: string; settings: unknown };
    messages: Array<{ role: string; content: string }>;
  } | null>;
  findSimilarPosts: () => Promise<TestStore["similarPosts"]>;
  insertDecisionLog: (input: unknown) => Promise<{ id: string }>;
};

function makeService(options: {
  messages?: Array<{ role: string; content: string }>;
  settings?: unknown;
  extracted?: { primary_keyword: string | null; intent: string | null };
  similarPosts?: TestStore["similarPosts"];
  minWordCount?: number;
}) {
  const store: TestStore = {
    logs: [],
    similarPosts: options.similarPosts ?? [],
    async loadConversation(conversationId) {
      assert.equal(conversationId, CONVERSATION_ID);
      return {
        conversation: { id: CONVERSATION_ID, tenantId: TENANT_ID },
        tenant: { id: TENANT_ID, settings: options.settings ?? {} },
        messages:
          options.messages ??
          [
            {
              role: "user",
              content:
                "I want to understand puppy socialisation timelines, vaccination timing, safe outings, and how to avoid overwhelming a young dog.",
            },
            {
              role: "assistant",
              content:
                "We covered staged exposure, vet guidance, puppy preschool, safe surfaces, short sessions, and confidence building for new owners.",
            },
          ],
      };
    },
    async findSimilarPosts() {
      return store.similarPosts;
    },
    async insertDecisionLog(input) {
      store.logs.push(input);
      return { id: `log-${store.logs.length}` };
    },
  };

  const ai = {
    async extractKeywordIntent() {
      return (
        options.extracted ?? {
          primary_keyword: "puppy socialisation timeline",
          intent: "educational",
        }
      );
    },
    async embed() {
      return [0.1, 0.2, 0.3];
    },
  };

  const service = __testing.buildDecisionService({
    store,
    ai,
    getConfig: () => ({
      minWordCount: options.minWordCount ?? 20,
      staleAfterDays: 90,
      now: new Date("2026-07-16T00:00:00.000Z"),
    }),
  });

  return { service, store };
}

function assertLogged(store: TestStore, action: DecisionAction) {
  assert.equal(store.logs.length, 1);
  assert.equal((store.logs[0] as { action: DecisionAction }).action, action);
}

test("decide updates when the closest post is high similarity", async () => {
  const { service, store } = makeService({
    similarPosts: [
      {
        blog_post_id: "post-high",
        score: 0.91,
        title: "Puppy socialisation guide",
        slug: "puppy-socialisation-guide",
        content: "Existing long article content ".repeat(40),
        last_modified: new Date("2026-07-01T00:00:00.000Z"),
      },
    ],
  });

  const result = await service.decide(CONVERSATION_ID);

  assert.equal(result.action, "update");
  assert.equal(result.target_blog_post_id, "post-high");
  assert.equal(result.similar_posts[0].band, "high");
  assert.match(result.reason, /high similarity/);
  assertLogged(store, "update");
});

test("decide creates when similarity is low", async () => {
  const { service, store } = makeService({
    similarPosts: [
      {
        blog_post_id: "post-low",
        score: 0.42,
        title: "Dog grooming prices",
        slug: "dog-grooming-prices",
        content: "Existing article content ".repeat(40),
        last_modified: new Date("2026-07-01T00:00:00.000Z"),
      },
    ],
  });

  const result = await service.decide(CONVERSATION_ID);

  assert.equal(result.action, "create");
  assert.equal(result.target_blog_post_id, undefined);
  assert.equal(result.similar_posts[0].band, "low");
  assert.match(result.reason, /No existing blog post/);
  assertLogged(store, "create");
});

test("decide creates for a fresh medium-similarity post", async () => {
  const { service, store } = makeService({
    similarPosts: [
      {
        blog_post_id: "post-medium",
        score: 0.72,
        title: "General puppy guide",
        slug: "general-puppy-guide",
        content: "Existing long article content ".repeat(40),
        last_modified: new Date("2026-07-01T00:00:00.000Z"),
      },
    ],
  });

  const result = await service.decide(CONVERSATION_ID);

  assert.equal(result.action, "create");
  assert.equal(result.similar_posts[0].band, "medium");
  assert.match(result.reason, /fresh enough/);
  assertLogged(store, "create");
});

test("decide skips when extraction has insufficient signal", async () => {
  const { service, store } = makeService({
    extracted: { primary_keyword: null, intent: null },
  });

  const result = await service.decide(CONVERSATION_ID);

  assert.equal(result.action, "skip");
  assert.match(result.reason, /insufficient keyword or intent/);
  assert.deepEqual(result.similar_posts, []);
  assertLogged(store, "skip");
});

test("decide skips when conversation is below the word-count threshold", async () => {
  const { service, store } = makeService({
    messages: [{ role: "user", content: "Puppy school?" }],
    minWordCount: 10,
  });

  const result = await service.decide(CONVERSATION_ID);

  assert.equal(result.action, "skip");
  assert.match(result.reason, /below minimum 10/);
  assertLogged(store, "skip");
});

test("decide skips when tenant exclusion list matches", async () => {
  const { service, store } = makeService({
    settings: {
      exclusion_list: ["medical advice"],
    },
    extracted: {
      primary_keyword: "medical advice for puppies",
      intent: "educational",
    },
  });

  const result = await service.decide(CONVERSATION_ID);

  assert.equal(result.action, "skip");
  assert.match(result.reason, /tenant exclusion list/);
  assertLogged(store, "skip");
});
