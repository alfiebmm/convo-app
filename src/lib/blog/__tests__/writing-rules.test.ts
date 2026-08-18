import { test } from "node:test";
import assert from "node:assert/strict";

import {
  stripEmDashes,
  validatePrimaryKeywordPlacement,
  type BlogPostJson,
} from "../writing-rules";

function post(): BlogPostJson {
  return {
    slug: "puppy-socialisation-timeline",
    category: "Guide",
    title: "Puppy socialisation timeline for new owners",
    dek: "A plain guide to safe puppy socialisation timing.",
    meta: { updated: "July 2026", readMinutes: 5 },
    seo: {
      metaTitle: "Puppy socialisation timeline for confident new owners",
      metaDescription:
        "Use this puppy socialisation timeline to plan safe outings and confidence building.",
    },
    hero: { url: "https://example.com/hero.jpg", alt: "Puppy in a training room" },
    toc: ["Safe timing", "Early practice", "When to ask a vet"],
    intro:
      "A puppy socialisation timeline helps you plan early exposure around vaccination guidance, safe surfaces, and short practice sessions.",
    sections: [
      {
        heading: "How to use a puppy socialisation timeline",
        blocks: [{ type: "p", text: "Start small and keep sessions short." }],
      },
      { heading: "Vaccination timing", blocks: [{ type: "p", text: "Ask your vet." }] },
      { heading: "Safe outings", blocks: [{ type: "p", text: "Choose clean spaces." }] },
      { heading: "Confidence signs", blocks: [{ type: "p", text: "Watch body language." }] },
    ],
    faqs: [
      { q: "When can puppies socialise?", a: "Ask your vet." },
      { q: "How long should sessions be?", a: "Keep them short." },
      { q: "What if my puppy is worried?", a: "Pause and simplify." },
    ],
  };
}

test("stripEmDashes removes em and en dash variants recursively", () => {
  const result = stripEmDashes({
    title: "Puppies — safely",
    nested: ["Short – calm", "Already clean"],
  });

  assert.equal(result.value.title, "Puppies. Safely");
  assert.deepEqual(result.value.nested, ["Short. Calm", "Already clean"]);
  assert.equal(result.replacements.length, 2);
});

test("primary keyword placement reports the missing location", () => {
  const candidate = post();
  candidate.title = "Safe outings for young dogs";

  const violation = validatePrimaryKeywordPlacement(
    candidate,
    "puppy socialisation timeline"
  );

  assert.equal(violation?.code, "primary_keyword");
  assert.match(violation?.message ?? "", /missing from title/);
});

test("primary keyword placement accepts required locations", () => {
  assert.equal(
    validatePrimaryKeywordPlacement(post(), "puppy socialisation timeline"),
    null
  );
});
