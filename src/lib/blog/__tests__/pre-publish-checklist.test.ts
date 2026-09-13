import assert from "node:assert/strict";
import { test } from "node:test";

import { runPrePublishChecklist, type ChecklistItemId } from "../pre-publish-checklist";
import type { BlogPostDetail } from "../queries";
import postFixture from "../schemas/post.example.chemist2u.json";
import type { BlogPostJson } from "../writing-rules";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const POST_ID = "22222222-2222-4222-8222-222222222222";
const KEYWORD = "pharmacists";

const EXPECTED_ORDER: ChecklistItemId[] = [
  "keyword_placement",
  "meta_title_length",
  "meta_description_length",
  "slug_format",
  "schema_valid",
  "canonical_url",
  "internal_links",
  "og_fields",
  "locale_en_au",
  "no_em_dashes",
  "no_banned_terms",
  "word_count",
  "single_cta",
  "no_pii_from_thread",
];

function proseWords(count: number, prefix: string): string {
  const words = [
    "pharmacists",
    "explain",
    "medicine",
    "timing",
    "safety",
    "questions",
    "patient",
    "review",
    "routine",
    "dose",
  ];
  return Array.from({ length: count }, (_value, index) => `${prefix}${words[index % words.length]}`).join(" ");
}

function validPostJson(overrides: Partial<BlogPostJson> = {}): BlogPostJson {
  const post = structuredClone(postFixture) as BlogPostJson;
  post.slug = "how-pharmacists-support-ongoing-care";
  post.title = "How pharmacists support ongoing care";
  post.dek = "A practical guide to pharmacist support, medicine checks, side effect questions, and clear next steps for Australian patients.";
  post.meta.reviewer = null as unknown as string | undefined;
  post.seo = {
    metaTitle: "How pharmacists support ongoing care in Australia",
    metaDescription:
      "Learn how pharmacists support ongoing care, medicine reviews, side effect checks and practical health questions, with clear advice on when to contact a GP.",
    canonicalUrl: "https://chemist2u.com.au/blog/how-pharmacists-support-ongoing-care",
    ogImage: "https://chemist2u.com.au/og/pharmacists.jpg",
    authoredAt: "2026-09-10",
    modifiedAt: "2026-09-10",
    authorName: "Chemist2U",
    keywords: [KEYWORD],
  };
  post.hero = {
    url: "https://chemist2u.com.au/hero.jpg",
    alt: "A pharmacist reviewing medicine notes on a counter.",
  };
  post.intro =
    "Pharmacists support ongoing care by answering medicine questions, checking interactions, explaining side effects, and helping people understand practical next steps.";
  post.toc = [
    "How pharmacists support ongoing care",
    "When to ask a pharmacist",
    "How medicine reviews work",
  ];
  post.stats = [
    { value: "4 yrs", label: "Training" },
    { value: "No booking", label: "Access" },
    { value: "Meds", label: "Review" },
    { value: "6 min", label: "Read" },
  ];
  post.sections = [0, 1, 2, 3].map((sectionIndex) => ({
    heading:
      sectionIndex === 0
        ? "How pharmacists support ongoing care"
        : `Medicine support step ${sectionIndex}`,
    blocks: [
      { type: "p", text: proseWords(45, `s${sectionIndex}a`) },
      { type: "p", text: proseWords(45, `s${sectionIndex}b`) },
      { type: "p", text: proseWords(45, `s${sectionIndex}c`) },
    ],
  }));
  post.sections[0].blocks.push({
    type: "readNext",
    label: "Read next",
    links: [{ label: "Medicine reviews", url: "/blog/medicine-reviews" }],
  });
  post.sections[3].blocks.push({
    type: "cta",
    heading: "Book a pharmacy consult",
    body: "Talk to a registered pharmacist about medicine questions.",
    linkUrl: "/consult",
    linkLabel: "Book a consult",
  });
  post.faqs = [
    { q: "Can pharmacists answer medicine questions?", a: "Yes, pharmacists can explain safe medicine use." },
    { q: "Do I need an appointment?", a: "Many pharmacy questions can be asked without an appointment." },
    { q: "When should I see a GP?", a: "See a GP for diagnosis, new symptoms, or urgent concerns." },
  ];
  post.related = [
    { title: "Medicine reviews", dek: "How reviews work.", url: "/blog/medicine-reviews", thumbUrl: null as unknown as string, category: null as unknown as string },
    { title: "Side effects", dek: "What to watch for.", url: "/blog/side-effects", thumbUrl: null as unknown as string, category: null as unknown as string },
    { title: "Repeat scripts", dek: "Planning ahead.", url: "/blog/repeat-scripts", thumbUrl: null as unknown as string, category: null as unknown as string },
    { title: "GP visits", dek: "When to book.", url: "/blog/gp-visits", thumbUrl: null as unknown as string, category: null as unknown as string },
  ];

  return { ...post, ...overrides };
}

function semanticContent(post: BlogPostJson) {
  return `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    image: post.hero.url,
    datePublished: "2026-09-10",
    dateModified: "2026-09-10",
    author: { "@type": "Person", name: "Avery Hill" },
    publisher: {
      "@type": "Organization",
      name: "Chemist2U",
      logo: { "@type": "ImageObject", url: "https://chemist2u.com.au/logo.png" },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": post.seo?.canonicalUrl },
  })}</script>`;
}

function makePost(metadata = validPostJson()): BlogPostDetail {
  return {
    id: POST_ID,
    tenantId: TENANT_ID,
    threadId: "33333333-3333-4333-8333-333333333333",
    title: metadata.title,
    slug: metadata.slug,
    content: semanticContent(metadata),
    contentSemantic: semanticContent(metadata),
    metadata: {
      ...metadata,
      decision: { primary_keyword: KEYWORD },
    } as unknown as Record<string, unknown>,
    status: "approved",
    persona: "pharmacists",
    topic: "ongoing care",
    createdAt: new Date("2026-09-10T00:00:00.000Z"),
    publishedAt: null,
    lastModified: new Date("2026-09-10T00:00:00.000Z"),
  };
}

function tenant(sourceMessages = [{ content: "My email is patient@example.com and phone is 0412 345 678" }]) {
  return {
    settings: { blog: { bannedTerms: ["forbidden"] } },
    brandJson: {},
    domain: "chemist2u.com.au",
    sourceMessages,
  };
}

function item(id: ChecklistItemId, post = makePost()) {
  const result = runPrePublishChecklist(post, tenant());
  return result.items.find((candidate) => candidate.id === id);
}

test("all-pass golden case returns stable item order", () => {
  const result = runPrePublishChecklist(makePost(), tenant());

  assert.equal(result.ok, true);
  assert.deepEqual(result.items.map((candidate) => candidate.id), EXPECTED_ORDER);
});

test("keyword_placement fails when the primary keyword is absent", () => {
  const post = makePost(validPostJson({ title: "Medicine support for families" }));
  assert.equal(item("keyword_placement", post)?.status, "fail");
});

test("meta_title_length fails on invalid SEO title length", () => {
  const post = validPostJson({ seo: { ...validPostJson().seo, metaTitle: "Too short" } });
  assert.equal(item("meta_title_length", makePost(post))?.status, "fail");
});

test("meta_description_length fails on invalid SEO description length", () => {
  const post = validPostJson({ seo: { ...validPostJson().seo, metaDescription: "Too short" } });
  assert.equal(item("meta_description_length", makePost(post))?.status, "fail");
});

test("slug_format fails on invalid slugs", () => {
  assert.equal(item("slug_format", makePost(validPostJson({ slug: "Bad Slug" })))?.status, "fail");
});

test("schema_valid fails on malformed post structure", () => {
  assert.equal(item("schema_valid", makePost(validPostJson({ faqs: [] })))?.status, "fail");
});

test("canonical_url fails when missing", () => {
  const post = validPostJson({ seo: { ...validPostJson().seo, canonicalUrl: null as unknown as string } });
  assert.equal(item("canonical_url", makePost(post))?.status, "fail");
});

test("internal_links fails when no same-tenant links exist", () => {
  const post = validPostJson();
  post.sections = post.sections.map((section) => ({
    ...section,
    blocks: section.blocks.filter((block) => block.type !== "readNext").map((block) =>
      block.type === "cta" ? { ...block, linkUrl: "https://external.test/book" } : block
    ),
  }));
  assert.equal(item("internal_links", makePost(post))?.status, "fail");
});

test("og_fields fails when OG image is absent", () => {
  const post = validPostJson({ seo: { ...validPostJson().seo, ogImage: null as unknown as string } });
  assert.equal(item("og_fields", makePost(post))?.status, "fail");
});

test("locale_en_au fails on US spelling", () => {
  assert.equal(item("locale_en_au", makePost(validPostJson({ intro: "Pharmacists explain favorite medicine routines." })))?.status, "fail");
});

test("no_em_dashes fails when an em dash appears", () => {
  assert.equal(item("no_em_dashes", makePost(validPostJson({ dek: "Practical advice — without confusion." })))?.status, "fail");
});

test("no_banned_terms fails when tenant banned words appear", () => {
  assert.equal(item("no_banned_terms", makePost(validPostJson({ dek: "A forbidden guide for patients." })))?.status, "fail");
});

test("word_count fails below the hard floor", () => {
  const post = validPostJson();
  post.sections = post.sections.map((section) => ({
    ...section,
    blocks: [{ type: "p", text: "Too short." }],
  }));
  assert.equal(item("word_count", makePost(post))?.status, "fail");
});

test("single_cta fails when no CTA block exists", () => {
  const post = validPostJson();
  post.sections = post.sections.map((section) => ({
    ...section,
    blocks: section.blocks.filter((block) => block.type !== "cta"),
  }));
  assert.equal(item("single_cta", makePost(post))?.status, "fail");
});

test("no_pii_from_thread fails when source contact details appear in the article", () => {
  const post = validPostJson({ intro: "Call 0412 345 678 for medicine questions." });
  assert.equal(item("no_pii_from_thread", makePost(post))?.status, "fail");
});
