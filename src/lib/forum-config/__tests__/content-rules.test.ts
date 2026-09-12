import { test } from "node:test";
import assert from "node:assert/strict";

import {
  contentRulesExclusionList,
  contentRulesPromptAddendum,
  readContentRules,
} from "@/lib/forum-config/content-rules";
import { forumConfigSchema } from "@/lib/forum-config/schema";

test("contentRules schema round-trips full editable object", () => {
  const input = {
    contentRules: {
      styleGuide: {
        tone: "Direct and helpful",
        bannedWords: ["cheap"],
        readingLevel: "Year 8",
        lengthTargets: { min: 900, max: 1400 },
      },
      blogTemplate: {
        h1Pattern: "{primaryKeyword} guide",
        h2Sections: ["What to know", "Next steps"],
        faqEnabled: false,
        ctaPlaceholders: ["book-call"],
      },
      personas: [
        {
          id: "buyers",
          name: "Buyers",
          description: "Researching options",
          goals: ["Compare choices"],
          painPoints: ["Too much jargon"],
        },
      ],
      exclusionList: ["legal advice"],
    },
  };

  const parsed = forumConfigSchema.parse(input);

  assert.equal(parsed.contentRules.styleGuide.tone, "Direct and helpful");
  assert.deepEqual(parsed.contentRules.blogTemplate.h2Sections, [
    "What to know",
    "Next steps",
  ]);
  assert.equal(parsed.contentRules.personas[0].name, "Buyers");
  assert.deepEqual(parsed.contentRules.exclusionList, ["legal advice"]);
});

test("contentRules helper merges new and legacy exclusion lists", () => {
  const settings = {
    forumConfig: {
      exclusion_list: ["medical advice"],
      contentRules: {
        exclusionList: ["legal advice", "Medical Advice"],
      },
    },
  };

  assert.deepEqual(contentRulesExclusionList(settings), [
    "legal advice",
    "Medical Advice",
  ]);
});

test("contentRules prompt includes style guide and template details", () => {
  const rules = readContentRules({
    forumConfig: {
      contentRules: {
        styleGuide: {
          tone: "Plain spoken",
          bannedWords: ["synergy"],
          readingLevel: "Year 7",
          lengthTargets: { min: 700, max: 900 },
        },
        blogTemplate: {
          h1Pattern: "{primaryKeyword}",
          h2Sections: ["Costs", "Process"],
          faqEnabled: true,
          ctaPlaceholders: ["contact"],
        },
      },
    },
  });

  const prompt = contentRulesPromptAddendum(rules);

  assert.match(prompt, /Plain spoken/);
  assert.match(prompt, /700-900 words/);
  assert.match(prompt, /Costs; Process/);
  assert.match(prompt, /synergy/);
});
