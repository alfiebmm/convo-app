import assert from "node:assert/strict";
import { test } from "node:test";

import {
  publishBlogPost,
  type PublishBlogPostDeps,
} from "@/lib/blog/publish";
import type { BlogPostDetail } from "@/lib/blog/queries";
import postFixture from "@/lib/blog/schemas/post.example.chemist2u.json";
import type { BlogPostJson } from "@/lib/blog/writing-rules";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const ACTOR_ID = "22222222-2222-4222-9222-222222222222";
const POST_ID = "33333333-3333-4333-8333-333333333333";
const KEYWORD = "puppy school";

function proseWords(count: number, prefix: string): string {
  return Array.from({ length: count }, (_value, index) => `${prefix}${index}-puppy`).join(" ");
}

function validMetadata(): BlogPostJson & Record<string, unknown> {
  const post = structuredClone(postFixture) as BlogPostJson & Record<string, unknown>;
  post.slug = "choose-puppy-school";
  post.title = "How to choose a puppy school";
  post.dek = "A practical guide to choosing puppy school with safe socialisation, trainer questions, and clear next steps for Australian families.";
  post.meta.reviewer = null as unknown as string | undefined;
  post.seo = {
    metaTitle: "How to choose a puppy school in Australia",
    metaDescription:
      "Learn how to choose a puppy school, compare trainer questions, understand safe socialisation, and prepare your puppy for calm early learning.",
    canonicalUrl: "https://doggo.com.au/blog/choose-puppy-school",
    ogImage: "https://doggo.com.au/og/puppy-school.jpg",
    authoredAt: "2026-09-10",
    modifiedAt: "2026-09-10",
    authorName: "Doggo",
    keywords: [KEYWORD],
  };
  post.hero = { url: "https://doggo.com.au/hero.jpg", alt: "A puppy sitting at school." };
  post.intro =
    "Puppy school helps families choose safe socialisation, build calm routines, ask trainer questions, and understand early learning before problems grow.";
  post.toc = ["How puppy school helps", "What to ask", "How to prepare"];
  post.stats = [
    { value: "4 wks", label: "Course" },
    { value: "6 min", label: "Read" },
    { value: "3 qs", label: "Ask" },
    { value: "1 plan", label: "Next step" },
  ];
  post.sections = [0, 1, 2, 3].map((index) => ({
    heading: index === 0 ? "How to choose a puppy school" : `Puppy school step ${index}`,
    blocks: [
      { type: "p", text: proseWords(45, `s${index}a`) },
      { type: "p", text: proseWords(45, `s${index}b`) },
      { type: "p", text: proseWords(45, `s${index}c`) },
    ],
  }));
  post.sections[0].blocks.push({
    type: "readNext",
    label: "Read next",
    links: [{ label: "Puppy checklist", url: "/blog/puppy-checklist" }],
  });
  post.sections[3].blocks.push({
    type: "cta",
    heading: "Book puppy training",
    body: "Talk to a trainer about the right puppy school.",
    linkUrl: "/training",
    linkLabel: "Book training",
  });
  post.faqs = [
    { q: "When should puppy school start?", a: "Ask your vet about safe timing." },
    { q: "What should I ask trainers?", a: "Ask about methods, class size, and vaccination rules." },
    { q: "Can shy puppies attend?", a: "Many shy puppies benefit from calm, structured classes." },
  ];
  post.related = [
    { title: "Puppy checklist", dek: "Plan early care.", url: "/blog/puppy-checklist", thumbUrl: null as unknown as string, category: null as unknown as string },
    { title: "Socialisation", dek: "Safe exposure.", url: "/blog/socialisation", thumbUrl: null as unknown as string, category: null as unknown as string },
    { title: "Training", dek: "Early skills.", url: "/blog/training", thumbUrl: null as unknown as string, category: null as unknown as string },
    { title: "Vet visits", dek: "Health checks.", url: "/blog/vet-visits", thumbUrl: null as unknown as string, category: null as unknown as string },
  ];
  post.decision = { primary_keyword: KEYWORD };
  return post;
}

function semanticContent(metadata: BlogPostJson) {
  return `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: metadata.title,
    image: metadata.hero.url,
    datePublished: "2026-09-10",
    dateModified: "2026-09-10",
    author: { "@type": "Person", name: "Avery Hill" },
    publisher: {
      "@type": "Organization",
      name: "Doggo",
      logo: { "@type": "ImageObject", url: "https://doggo.com.au/logo.png" },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": metadata.seo?.canonicalUrl },
  })}</script>`;
}

function makePost(overrides: Partial<BlogPostDetail> = {}): BlogPostDetail {
  const metadata = validMetadata();
  return {
    id: POST_ID,
    tenantId: TENANT_ID,
    threadId: null,
    title: "How to choose a puppy school",
    slug: "how-to-choose-a-puppy-school",
    content: semanticContent(metadata),
    contentSemantic: semanticContent(metadata),
    metadata,
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
    getPrePublishChecklistTenant: async () => ({
      settings: { blog: { bannedTerms: [] } },
      brandJson: {},
      domain: "doggo.com.au",
      sourceMessages: [],
    }),
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
    preflight: null,
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
    preflight: null,
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
    preflight: result.preflight,
  });
  assert.equal(result.preflight?.ok, true);
  assert.equal(deps.publishCalls.length, 1);
  assert.equal(deps.publishCalls[0][0].applicationPassword, "secret app password");
  assert.equal(deps.updates[0][2].status, "publishing");
  assert.equal(deps.updates[1][2].status, "published");
  assert.equal(
    (deps.updates[1][2].metadata.prePublishChecklist as { ok?: boolean }).ok,
    true,
  );
  assert.deepEqual(deps.updates[1][2].metadata.published, {
    wp_post_id: 123,
    wp_post_url: "https://doggo.com.au/how-to-choose-a-puppy-school/",
    published_at: "2026-09-10T00:00:01.000Z",
    published_by: ACTOR_ID,
  });
});

test("passes semantic content to WordPress when available", async () => {
  const metadata = validMetadata();
  const semantic = `${semanticContent(metadata)}\n<h1>Semantic article</h1>\n<p>Destination themed body.</p>`;
  const deps = makeDeps({
    post: makePost({
      content: '<html><body><style>.gh-blog-article{}</style><div class="gh-blog-article">Full preview</div></body></html>',
      contentSemantic: semantic,
      metadata,
    }),
  });

  await runPublish(deps);

  assert.equal(deps.publishCalls.length, 1);
  assert.equal(
    deps.publishCalls[0][2],
    semantic,
  );
});

test("falls back to tokenised content when semantic content is absent", async () => {
  const metadata = validMetadata();
  const deps = makeDeps({
    post: makePost({
      content: `<html><body>${semanticContent(metadata)}<div class="gh-blog-article">Full preview</div></body></html>`,
      contentSemantic: null,
      metadata,
    }),
  });

  await runPublish(deps);

  assert.equal(deps.publishCalls.length, 1);
  assert.equal(deps.publishCalls[0][2], undefined);
  assert.equal(
    deps.publishCalls[0][1].content,
    `<html><body>${semanticContent(metadata)}<div class="gh-blog-article">Full preview</div></body></html>`,
  );
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
    preflight: result.ok ? null : result.preflight,
  });
  assert.equal(result.preflight?.ok, true);
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
        ...validMetadata(),
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

test("checklist failure blocks WordPress and stores CHECKLIST_FAILED", async () => {
  const metadata = validMetadata();
  metadata.seo = { ...metadata.seo, metaTitle: "Too short" };
  const deps = makeDeps({ post: makePost({ metadata }) });

  const result = await runPublish(deps);

  assert.equal(result.ok, false);
  assert.match(result.error, /Pre-publish checklist failed/);
  assert.equal(result.preflight?.ok, false);
  assert.equal(deps.publishCalls.length, 0);
  assert.equal(deps.updates[0][2].status, "publish_failed");
  assert.deepEqual(
    (deps.updates[0][2].metadata.publish_error as Record<string, unknown>).code,
    "CHECKLIST_FAILED",
  );
});
