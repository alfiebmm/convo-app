import { test } from "node:test";
import assert from "node:assert/strict";

import {
  SYSTEM_HERO_IMAGE_STYLE_PROMPT,
  activeHeroUrl,
  articleTopicForHero,
  buildHeroImagePrompt,
  heroImageCapState,
  heroImageStoragePath,
  nextHeroGenerationNumber,
} from "../hero-image";

test("buildHeroImagePrompt composes tenant style with title and intro topic", () => {
  const prompt = buildHeroImagePrompt({
    stylePrompt: "Warm editorial photography, Australian clinic interior",
    post: {
      title: "How pharmacists support ongoing care",
      intro:
        "Pharmacists help with medicine questions, side effects, and follow-up care.",
    },
  });

  assert.equal(
    prompt,
    "Warm editorial photography, Australian clinic interior — How pharmacists support ongoing care — Pharmacists help with medicine questions, side effects, and follow-up care.",
  );
});

test("buildHeroImagePrompt falls back to the system default style", () => {
  const prompt = buildHeroImagePrompt({
    stylePrompt: "",
    post: {
      title: "Puppy preschool basics",
      intro: "A short guide to safe puppy socialisation.",
    },
  });

  assert.match(prompt, new RegExp(SYSTEM_HERO_IMAGE_STYLE_PROMPT));
  assert.match(prompt, /Puppy preschool basics/);
});

test("articleTopicForHero compacts intro whitespace", () => {
  assert.equal(
    articleTopicForHero({
      title: "Dog training at home",
      intro: "First line\n\nwith       extra spacing.",
    }),
    "Dog training at home — First line with extra spacing.",
  );
});

test("heroImageStoragePath uses tenant, post id, and incrementing number", () => {
  assert.equal(
    heroImageStoragePath({
      tenantId: "tenant-1",
      postId: "post-1",
      generationNumber: 3,
    }),
    "tenant-1/blog/post-1-hero-3.jpg",
  );
});

test("heroImageCapState blocks when the next image would exceed the cap", () => {
  assert.deepEqual(
    heroImageCapState({ spendCents: 998, capCents: 1000, nextImageCostCents: 4 }),
    { allowed: false, warning: true, percentage: 99 },
  );
  assert.deepEqual(
    heroImageCapState({ spendCents: 796, capCents: 1000, nextImageCostCents: 4 }),
    { allowed: true, warning: false, percentage: 79 },
  );
});

test("activeHeroUrl prefers AI image then generated image then placeholder", () => {
  assert.equal(
    activeHeroUrl({
      aiHeroUrl: "https://cdn.example.com/ai.jpg",
      generatedHeroUrl: "https://cdn.example.com/generated.jpg",
      placeholderUrl: "https://convoapp.com.au/hero-placeholders/gradient-orange.jpg",
    }),
    "https://cdn.example.com/ai.jpg",
  );
  assert.equal(
    activeHeroUrl({
      generatedHeroUrl: "https://cdn.example.com/generated.jpg",
      placeholderUrl: "https://convoapp.com.au/hero-placeholders/gradient-orange.jpg",
    }),
    "https://cdn.example.com/generated.jpg",
  );
  assert.equal(
    activeHeroUrl({
      aiHeroUrl: "https://cdn.example.com/ai.jpg",
      placeholderUrl: "https://convoapp.com.au/hero-placeholders/gradient-orange.jpg",
      enabled: false,
    }),
    "https://convoapp.com.au/hero-placeholders/gradient-orange.jpg",
  );
});

test("nextHeroGenerationNumber retains history and increments regenerate paths", () => {
  assert.equal(nextHeroGenerationNumber({}), 1);
  assert.equal(
    nextHeroGenerationNumber({
      aiHeroImage: {
        images: [{ url: "one" }, { url: "two" }],
      },
    }),
    3,
  );
});
