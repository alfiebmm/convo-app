This directory mirrors `/Users/ghg-convo/workspace/blog-template-pack/`.

Run `npm run sync:blog-schemas` from the repo root after upstream template-pack
changes. The mirror keeps the blog create workflow portable in CI and avoids a
machine-specific file dependency.

## Word-count targets

Generated articles should read as substantial SEO drafts, not short summaries.
The create and update pipelines apply these default quality gates:

- `minSectionWordCount`: 100 paragraph words per section.
- `minTotalWordCount`: 800 words across the intro paragraph and section paragraphs.
- `maxTotalWordCount`: 1,800 words across the intro paragraph and section paragraphs.
- `minParagraphsPerSection`: 3 paragraph blocks per section.

Word count measures the intro paragraph plus section paragraph blocks
(`section.blocks[].text` where `type = "p"`). Target range: 800-1,500 words.
Floor: 800 words (below this triggers retry). Ceiling: 1,800 words (above this
triggers retry). Excludes dek, TOC labels, FAQ questions/answers,
key-takeaway blocks, related-articles boilerplate, and footer prose.
