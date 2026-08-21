import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

import { __testing } from "../create";
import type { DecisionResult } from "../decision";
import type { BlogPostJson } from "../writing-rules";
import brandFixture from "../schemas/brand.example.chemist2u.json";
import postFixture from "../schemas/post.example.chemist2u.json";

const require = createRequire(import.meta.url);
const { render } = require("../template-pack/renderer.js") as {
  render: (params: {
    brand: Record<string, unknown>;
    post: BlogPostJson;
    stylesPath: string;
    templatePath: string;
  }) => string;
};
const { validate } = require("../template-pack/validate.js") as {
  validate: (params: {
    brand: Record<string, unknown>;
    post: BlogPostJson;
  }) => Array<{
    file: string;
    errors: Array<{ instancePath?: string; message?: string; params?: unknown }>;
  }>;
};

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const CONVERSATION_ID = "22222222-2222-4222-8222-222222222222";
const KEYWORD = "pharmacists";
const CTA = {
  heading: "Book a pharmacy consult",
  body: "Talk to a registered pharmacist about medicine questions.",
  linkUrl: "https://chemist2u.com.au/consult/",
  linkLabel: "Book a consult",
};

type InsertedPost = {
  tenantId: string;
  threadId: string;
  title: string;
  slug: string;
  content: string;
  metadata: Record<string, unknown>;
  status: "draft" | "generation_failed" | "update_pending";
  persona: string | null;
  topic: string | null;
};

type SeoValidationLog = {
  action: "create" | "update";
  reason: string;
  metadata: Record<string, unknown>;
};

type MakeServiceOptions = {
  brandJson?: Record<string, unknown>;
  settings?: Record<string, unknown>;
};

function decision(): DecisionResult {
  return {
    action: "create",
    reason: "Low similarity.",
    similar_posts: [],
    primary_keyword: KEYWORD,
    intent: "educational",
  };
}

function proseWords(count: number, prefix: string): string {
  const words = [
    "pharmacists",
    "explain",
    "medicine",
    "timing",
    "safety",
    "questions",
    "patient",
    "notes",
    "review",
    "routine",
    "dose",
    "side",
    "effects",
    "clear",
    "records",
    "family",
    "support",
    "practical",
    "advice",
    "follow",
    "up",
  ];

  return Array.from(
    { length: count },
    (_value, index) => `${prefix}${index}-${words[index % words.length]}`
  ).join(" ");
}

function richParagraphs(sectionIndex: number) {
  return [0, 1, 2].map((paragraphIndex) => ({
    type: "p" as const,
    text: proseWords(45, `s${sectionIndex}p${paragraphIndex}`),
  }));
}

function validPost(overrides: Partial<BlogPostJson> = {}): BlogPostJson {
  const post = structuredClone(postFixture) as BlogPostJson;
  const postRecord = post as unknown as Record<string, unknown>;

  post.meta.reviewer = null as unknown as string | undefined;
  post.seo = {
    metaTitle: "How pharmacists support ongoing care across Australia",
    metaDescription:
      "Learn how pharmacists support ongoing care, medicine reviews, side effect checks and practical health questions, with clear advice on when to contact a GP.",
    canonicalUrl: null as unknown as string,
    ogImage: null as unknown as string,
    authoredAt: null as unknown as string,
    modifiedAt: null as unknown as string,
    authorName: null as unknown as string,
    keywords: [KEYWORD, "medicine reviews"],
  };
  post.related = post.related?.map((related) => ({
    ...related,
    thumbUrl: related.thumbUrl ?? (null as unknown as string),
    category: related.category ?? (null as unknown as string),
  }));
  post.title = "How pharmacists support ongoing care";
  post.intro =
    "Pharmacists help with ongoing care by answering medicine questions, checking interactions, explaining side effects, and helping people understand when a GP should be involved.";
  post.sections = post.sections.map((section, index) => ({
    ...section,
    blocks: richParagraphs(index),
  }));
  post.sections[0].heading = "How pharmacists support ongoing care";
  post.sections[post.sections.length - 1].blocks.push({
    type: "cta",
    heading: "Wrong heading",
    body: "Wrong body",
    linkUrl: "https://wrong.example/path",
    linkLabel: "Wrong label",
  });

  postRecord.stats ??= null;
  postRecord.related ??= null;

  return {
    ...post,
    ...overrides,
  };
}

function validBrand(): Record<string, unknown> {
  const brand = structuredClone(brandFixture) as Record<string, unknown>;
  const fonts = brand.fonts as Record<string, unknown>;
  const logo = brand.logo as Record<string, unknown>;
  const site = brand.site as Record<string, unknown>;
  const cta = brand.cta as Record<string, unknown> | undefined;
  const footer = brand.footer as Record<string, unknown> | undefined;

  fonts.headings ??= null;
  fonts.googleUrl ??= null;
  logo.height ??= null;
  site.hubLabel ??= null;
  site.loginUrl ??= null;
  site.orderUrl ??= null;
  site.orderLabel ??= null;

  if (cta) {
    cta.heading ??= null;
    cta.body ??= null;
    cta.linkUrl ??= null;
    cta.linkLabel ??= null;
  } else {
    brand.cta = null;
  }

  if (footer) {
    footer.wordmark ??= null;
    footer.tagline ??= null;
    footer.columns ??= null;
    footer.copyright ??= null;
    footer.legalLinks ??= null;
  } else {
    brand.footer = null;
  }

  return brand;
}

function makeService(responses: BlogPostJson[], options: MakeServiceOptions = {}) {
  const inserts: InsertedPost[] = [];
  const seoValidationLogs: SeoValidationLog[] = [];
  const prompts: string[] = [];
  const existingSlugs = new Set<string>();
  const brandJson = options.brandJson ?? validBrand();
  const settings = options.settings ?? {
    brandJson,
    blog: { cta: CTA, bannedTerms: ["journey", "robust"] },
  };

  const service = __testing.buildCreateService({
    store: {
      async loadConversation(conversationId) {
        assert.equal(conversationId, CONVERSATION_ID);
        return {
          conversation: { id: CONVERSATION_ID, tenantId: TENANT_ID },
          tenant: {
            id: TENANT_ID,
            name: "Chemist2U",
            slug: "chemist2u",
            domain: "chemist2u.com.au",
            settings,
          },
          messages: [
            {
              role: "user",
              content:
                "Can pharmacists help with medicine side effects and ongoing medication questions?",
              createdAt: new Date("2026-07-31T00:00:00.000Z"),
            },
            {
              role: "assistant",
              content:
                "Yes. We discussed medicine reviews, interactions, side effects, and when to see a GP.",
              createdAt: new Date("2026-07-31T00:01:00.000Z"),
            },
          ],
        };
      },
      async slugExists(_tenantId, slug) {
        return existingSlugs.has(slug);
      },
      async insertBlogPost(values) {
        inserts.push(values);
        existingSlugs.add(values.slug);
        return { id: `post-${inserts.length}` };
      },
      async insertSeoValidationLog(input) {
        seoValidationLogs.push(input);
        return { id: `seo-log-${seoValidationLogs.length}` };
      },
    },
    ai: {
      async generatePost(params) {
        prompts.push(params.userPrompt);
        const next = responses.shift();
        if (!next) throw new Error("mock response queue exhausted");
        return JSON.stringify(next);
      },
    },
    validate: (params) => validate(params).filter((result) => result.file !== "brand"),
    render: ({ brand, post }) =>
      render({
        brand,
        post,
        stylesPath: path.join(process.cwd(), "src/lib/blog/template-pack/_tokenised.css"),
        templatePath: path.join(process.cwd(), "src/lib/blog/template-pack/template.html"),
      }),
    sleep: async () => {},
  });

  return { service, inserts, prompts, seoValidationLogs };
}

test("buildSystemPrompt injects keyword, banned terms, and section contract", async () => {
  const brief = __testing.buildBrief(CONVERSATION_ID, decision(), {
    tenant: {
      id: TENANT_ID,
      name: "Chemist2U",
      slug: "chemist2u",
      domain: "chemist2u.com.au",
      settings: {
        brandJson: validBrand(),
        blog: { cta: CTA, bannedTerms: ["journey", "robust"] },
      },
    },
    messages: [],
  });

  const prompt = __testing.buildSystemPrompt(brief);

  assert.match(
    prompt,
    /`post\.sections` array MUST contain between 4 and 10 items \(inclusive\)/
  );
  assert.match(prompt, /Fewer than 4 or more than 10 will be REJECTED/);
  assert.match(prompt, /Aim for 5-7 sections/);
  assert.match(prompt, /Each section MUST contain at least 3 paragraph blocks/);
  assert.match(prompt, /Each paragraph block should be 80-150 words/);
  assert.match(prompt, /total article body MUST land between 800 and 1,500 words/);
  assert.match(prompt, /across all sections plus the intro paragraph/);
  assert.doesNotMatch(prompt, /Aim high/);
  assert.match(prompt, /Support long-form content with concrete examples/);
  assert.match(prompt, /primary keyword "pharmacists" MUST appear/);
  assert.match(prompt, /`post\.title`/);
  assert.match(prompt, /At least ONE H2 section heading/);
  assert.match(prompt, /first 100 words of `post\.intro`/);
  assert.match(prompt, /`post\.seo\.metaTitle`/);
  assert.match(prompt, /`post\.seo\.metaDescription`/);
  assert.match(prompt, /50-60 character search title/);
  assert.match(prompt, /140-160 character search description/);
  assert.match(prompt, /BANNED TERMS: \[/);
  assert.match(prompt, /\bjourney\b/);
  assert.match(prompt, /\brobust\b/);
  assert.match(prompt, /`heading` string and a `blocks` array/);
});

test("createArticle renders HTML and persists full post metadata", async () => {
  const { service, inserts, seoValidationLogs } = makeService([validPost()]);

  const id = await service.createArticle(CONVERSATION_ID, decision());

  assert.equal(id, "post-1");
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0].status, "draft");
  assert.equal(inserts[0].title, "How pharmacists support ongoing care");
  assert.equal(inserts[0].slug, "how-pharmacists-support-ongoing-care");
  assert.match(inserts[0].content, /<html/);
  assert.match(
    inserts[0].content,
    /<title>How pharmacists support ongoing care across Australia/
  );
  assert.match(inserts[0].content, /<meta name="description"/);
  assert.equal((inserts[0].metadata as BlogPostJson).title, inserts[0].title);
  assert.equal(
    (inserts[0].metadata.stats as Record<string, unknown>).wordCount,
    969,
  );
  assert.equal(inserts[0].persona, KEYWORD);
  assert.equal(inserts[0].topic, "educational");
  assert.equal(seoValidationLogs.length, 1);
  assert.equal(seoValidationLogs[0].metadata.phase, "seo_validation");
  assert.equal(seoValidationLogs[0].metadata.ok, true);
});

test("createArticle preserves a valid HTTPS hero URL from the generated post", async () => {
  const heroUrl = "https://cdn.example.com/generated-hero.jpg";
  const { service, inserts } = makeService([
    validPost({ hero: { url: heroUrl, alt: "A pharmacist reviewing medicine notes" } }),
  ]);

  await service.createArticle(CONVERSATION_ID, decision());

  assert.equal((inserts[0].metadata as BlogPostJson).hero.url, heroUrl);
  assert.match(inserts[0].content, new RegExp(heroUrl));
});

test("createArticle uses configured hero placeholder when generated hero URL is missing", async () => {
  const configuredHeroUrl = "https://cdn.example.com/tenant-placeholder.jpg";
  const brandJson = validBrand();
  const logo = brandJson.logo as Record<string, unknown>;
  logo.url = "https://chemist2u.com.au/assets/og-image.jpg";

  const { service, inserts } = makeService(
    [validPost({ hero: { url: "", alt: "A pharmacy counter" } })],
    {
      brandJson,
      settings: {
        brandJson: {
          ...brandJson,
          heroPlaceholder: { url: configuredHeroUrl },
        },
        blog: { cta: CTA, bannedTerms: ["journey", "robust"] },
      },
    }
  );

  await service.createArticle(CONVERSATION_ID, decision());

  const metadata = inserts[0].metadata as BlogPostJson;
  assert.equal(metadata.hero.url, configuredHeroUrl);
  assert.notEqual(metadata.hero.url, logo.url);
  assert.match(inserts[0].content, new RegExp(configuredHeroUrl));
});

test("createArticle uses brand-colour gradient placeholder instead of logo fallback", async () => {
  const brandJson = validBrand();
  const colors = brandJson.colors as Record<string, unknown>;
  const logo = brandJson.logo as Record<string, unknown>;
  colors.primary = "#2e7d32";
  logo.url = "https://chemist2u.com.au/assets/og-image.jpg";

  const { service, inserts } = makeService([
    validPost({ hero: { url: "http://example.com/not-https.jpg", alt: "" } }),
  ], { brandJson });

  await service.createArticle(CONVERSATION_ID, decision());

  const metadata = inserts[0].metadata as BlogPostJson;
  assert.equal(
    metadata.hero.url,
    "https://convoapp.com.au/hero-placeholders/gradient-green.jpg"
  );
  assert.equal(metadata.hero.alt, "How pharmacists support ongoing care");
  assert.notEqual(metadata.hero.url, logo.url);
  assert.match(inserts[0].content, /hero-placeholders\/gradient-green\.jpg/);
});

test("schema validation retries once with schema errors", async () => {
  const invalid = validPost({ toc: ["Only one item"] });
  const { service, inserts, prompts } = makeService([invalid, validPost()]);

  await service.createArticle(CONVERSATION_ID, decision());

  assert.equal(inserts[0].status, "draft");
  assert.equal(prompts.length, 2);
  assert.match(prompts[1], /post\.json failed schema validation/);
});

test("banned words retry once and then persist a clean draft", async () => {
  const bad = validPost({
    intro:
      "Pharmacists delve into ongoing care by answering medicine questions and helping people understand side effects.",
  });
  const { service, inserts, prompts } = makeService([bad, validPost()]);

  await service.createArticle(CONVERSATION_ID, decision());

  assert.equal(inserts[0].status, "draft");
  assert.equal(prompts.length, 2);
  assert.match(prompts[1], /Banned term found: delve/);
});

test("banned words retry repeated same-class violations more than once", async () => {
  const bad = validPost({
    intro:
      "Pharmacists delve into ongoing care by answering medicine questions and helping people understand side effects.",
  });
  const { service, inserts, prompts } = makeService([bad, bad, validPost()]);

  await service.createArticle(CONVERSATION_ID, decision());

  assert.equal(inserts[0].status, "draft");
  assert.equal(prompts.length, 3);
  assert.match(prompts[1], /Banned term found: delve/);
  assert.match(prompts[2], /Banned term found: delve/);
});

test("banned words fail after three same-class retries and mark generation_failed", async () => {
  const bad = validPost({
    intro:
      "Pharmacists delve into ongoing care by answering medicine questions and helping people understand side effects.",
  });
  const { service, inserts, prompts } = makeService([bad, bad, bad, bad]);

  await service.createArticle(CONVERSATION_ID, decision());

  assert.equal(inserts.length, 1);
  assert.equal(inserts[0].status, "generation_failed");
  assert.equal(prompts.length, 4);
  assert.match(
    String(
      (
        inserts[0].metadata.generation_failure as Record<string, unknown>
      ).reason
    ),
    /Banned term found/
  );
});

test("retry loop gives up after six total generation attempts", async () => {
  const schemaBad = validPost({ toc: ["Only one item"] });
  const bannedBad = validPost({
    intro:
      "Pharmacists delve into ongoing care by answering medicine questions and helping people understand side effects.",
  });
  const keywordBad = validPost({
    title: "Ongoing medicine support in Australia",
  });
  const englishBad = validPost({
    intro:
      "Pharmacists help with ongoing care by answering medicine questions, checking color labels, and explaining side effects.",
  });
  const { service, inserts, prompts } = makeService([
    schemaBad,
    bannedBad,
    keywordBad,
    englishBad,
    schemaBad,
    bannedBad,
    validPost(),
  ]);

  await service.createArticle(CONVERSATION_ID, decision());

  assert.equal(inserts.length, 1);
  assert.equal(inserts[0].status, "generation_failed");
  assert.equal(prompts.length, 6);
});

test("em dashes are stripped from rendered content and metadata", async () => {
  const withDash = validPost({
    dek: "A guide to pharmacists — and the care they support.",
  });
  const { service, inserts } = makeService([withDash]);

  await service.createArticle(CONVERSATION_ID, decision());

  assert.doesNotMatch(inserts[0].content, /[—–]/);
  assert.doesNotMatch((inserts[0].metadata as BlogPostJson).dek, /[—–]/);
});

test("primary keyword placement failure retries once", async () => {
  const bad = validPost({ title: "Ongoing medicine support in Australia" });
  const { service, inserts, prompts } = makeService([bad, validPost()]);

  await service.createArticle(CONVERSATION_ID, decision());

  assert.equal(inserts[0].status, "draft");
  assert.equal(prompts.length, 2);
  assert.match(prompts[1], /missing from title/);
});

test("word-count quality gate retries and logs rejection", async () => {
  const bad = validPost({
    sections: validPost().sections.map((section) => ({
      ...section,
      blocks: [{ type: "p", text: "Too short for a useful article." }],
    })),
  });
  const { service, inserts, prompts, seoValidationLogs } = makeService([bad, validPost()]);

  await service.createArticle(CONVERSATION_ID, decision());

  assert.equal(inserts[0].status, "draft");
  assert.equal(prompts.length, 2);
  assert.match(prompts[1], /Word-count quality gate failed/);
  assert.match(prompts[1], /Rewrite the full post\.json/);
  assert.equal(seoValidationLogs[0].metadata.phase, "quality_gate_word_count");
  assert.equal(seoValidationLogs[1].metadata.phase, "seo_validation");
});

test("CTA blocks are overridden from tenant config", async () => {
  const { service, inserts } = makeService([validPost()]);

  await service.createArticle(CONVERSATION_ID, decision());

  const metadata = inserts[0].metadata as BlogPostJson;
  const ctaBlock = metadata.sections
    .flatMap((section) => section.blocks)
    .find((block) => block.type === "cta");

  assert.ok(ctaBlock);
  assert.equal(ctaBlock.linkUrl, CTA.linkUrl);
  assert.equal(ctaBlock.linkLabel, CTA.linkLabel);
  assert.match(inserts[0].content, /https:\/\/chemist2u\.com\.au\/consult\//);
  assert.match(inserts[0].content, /Book a consult/);
});

test("Australian English violations retry once", async () => {
  const bad = validPost({
    intro:
      "Pharmacists help with ongoing care by answering medicine questions, checking color labels, and explaining side effects.",
  });
  const { service, inserts, prompts } = makeService([bad, validPost()]);

  await service.createArticle(CONVERSATION_ID, decision());

  assert.equal(inserts[0].status, "draft");
  assert.equal(prompts.length, 2);
  assert.match(prompts[1], /US spelling found: color/);
});
