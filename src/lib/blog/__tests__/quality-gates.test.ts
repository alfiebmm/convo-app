import { test } from "node:test";
import assert from "node:assert/strict";

import {
  validateWordCountGates,
  wordCountGateStats,
  type BlogPostJson,
} from "../writing-rules";

type ParagraphBlock = Extract<
  BlogPostJson["sections"][number]["blocks"][number],
  { type: "p" }
>;

function words(count: number, prefix = "medicine"): string {
  return Array.from({ length: count }, (_value, index) => `${prefix}${index}`).join(" ");
}

function paragraphs(counts: number[], prefix: string): ParagraphBlock[] {
  return counts.map((count, index) => ({
    type: "p",
    text: words(count, `${prefix}${index}-`),
  }));
}

function post(sectionWordCounts: number[][]): BlogPostJson {
  return {
    slug: "medicine-review-guide",
    category: "Guide",
    title: "Medicine review guide",
    dek: "A practical guide to medicine reviews.",
    meta: { updated: "August 2026", readMinutes: 5 },
    seo: {
      metaTitle: "Medicine review guide for households",
      metaDescription:
        "Plan a medicine review with clearer notes, safer routines, and better questions for your pharmacist.",
    },
    hero: { url: "https://example.com/hero.jpg", alt: "Pharmacist reviewing notes" },
    toc: ["Prepare notes", "Check routines", "Ask questions"],
    intro: "A medicine review guide helps households prepare clearer questions.",
    sections: sectionWordCounts.map((counts, index) => ({
      heading: `Section ${index + 1}`,
      blocks: paragraphs(counts, `s${index}`),
    })),
    faqs: [
      { q: "Who can help?", a: "A pharmacist can explain medicine routines." },
      { q: "What should I bring?", a: "Bring current medicines and notes." },
      { q: "When should I ask?", a: "Ask when instructions are unclear." },
    ],
  };
}

test("word-count gates pass at threshold", () => {
  const candidate = post([
      [67, 67, 66],
      [67, 67, 66],
      [67, 67, 66],
      [64, 64, 63],
    ]);
  const violation = validateWordCountGates(candidate);

  assert.equal(violation, null);
});

test("word-count gate stats include intro words in total count", () => {
  const candidate = post([
    [100, 100, 100],
    [100, 100, 100],
    [100, 100, 100],
    [100, 100, 100],
  ]);

  const violation = validateWordCountGates(candidate);
  const stats = wordCountGateStats(candidate);

  assert.equal(violation, null);
  assert.equal(stats.introWordCount, 9);
  assert.equal(stats.totalWordCount, 1209);
});

test("word-count gates fail below section minimum", () => {
  const violation = validateWordCountGates(
    post([
      [33, 33, 33],
      [100, 100, 100],
      [100, 100, 100],
      [100, 100, 100],
    ])
  );

  assert.equal(violation?.code, "word_count");
  assert.match(violation?.message ?? "", /section 1/);
  assert.match(violation?.message ?? "", /below the required 100/);
});

test("word-count gates fail below total minimum", () => {
  const violation = validateWordCountGates(
    post([
      [67, 67, 66],
      [67, 67, 66],
      [67, 67, 66],
      [67, 67, 56],
    ])
  );

  assert.equal(violation?.code, "word_count");
  assert.equal(violation?.stats.introWordCount, 9);
  assert.match(violation?.message ?? "", /article body has 799 intro and paragraph words/);
  assert.match(violation?.message ?? "", /below the required 800/);
});

test("word-count gates fail below paragraphs per section minimum", () => {
  const candidate = post([
    [100, 100],
    [100, 100, 100],
    [100, 100, 100],
    [100, 100, 100],
  ]);
  candidate.sections[0].blocks.push({
    type: "cta",
    heading: "Book a consult",
    body: "Speak with a pharmacist about your medicines.",
    linkUrl: "https://example.com/book",
    linkLabel: "Book now",
  });

  const violation = validateWordCountGates(candidate);

  assert.equal(violation?.code, "word_count");
  assert.match(violation?.message ?? "", /has 2 paragraph block\(s\)/);
  assert.equal(violation?.stats.sections[0].paragraphCount, 2);
});
