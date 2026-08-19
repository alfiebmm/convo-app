import { test } from "node:test";
import assert from "node:assert/strict";

import {
  backfillBlogWordCounts,
  hasPersistedWordCount,
  metadataWithWordCount,
} from "../backfill-blog-word-counts";

test("metadataWithWordCount preserves existing stat cards and adds wordCount", () => {
  const metadata = metadataWithWordCount(
    { stats: [{ value: "6 min", label: "Read time" }] },
    875,
  );

  assert.equal((metadata.stats as Record<string, unknown>).wordCount, 875);
  assert.deepEqual((metadata.stats as Record<string, unknown>).cards, [
    { value: "6 min", label: "Read time" },
  ]);
  assert.equal(metadata.word_count, 875);
});

test("hasPersistedWordCount recognises backfilled metadata", () => {
  assert.equal(hasPersistedWordCount({ stats: { wordCount: 875 } }), true);
  assert.equal(hasPersistedWordCount({ stats: [{ value: "6 min" }] }), false);
  assert.equal(hasPersistedWordCount({}), false);
});

test("backfillBlogWordCounts dry-run recomputes rows without writes", async () => {
  const totals = await backfillBlogWordCounts({
    dryRun: true,
    rows: [
      {
        id: "post-1",
        title: "Legacy row",
        content:
          '<html><body><div class="gh-blog-article-body"><div class="gh-blog-article-content"><p>One two three.</p><h2>Section</h2><p>Four five.</p></div></div></body></html>',
        metadata: {},
      },
      {
        id: "post-2",
        title: "Already done",
        content: "<p>Ignored.</p>",
        metadata: {
          stats: { wordCount: 1 },
          intro: "Recomputed intro.",
          sections: [
            {
              heading: "Section",
              blocks: [{ type: "p", text: "Recomputed body." }],
            },
          ],
        },
      },
    ],
  });

  assert.deepEqual(totals, { scanned: 2, skipped: 0, backfilled: 2 });
});
