This directory mirrors `/Users/ghg-convo/workspace/blog-template-pack/`.

Run `npm run sync:blog-schemas` from the repo root after upstream template-pack
changes. The mirror keeps the blog create workflow portable in CI and avoids a
machine-specific file dependency.

## Word-count targets

Generated articles should read as substantial SEO drafts, not short summaries.
The create and update pipelines reject thin article bodies with these default
quality gates:

- `minSectionWordCount`: 100 paragraph words per section.
- `minTotalWordCount`: 800 words across the intro paragraph and section paragraphs.
- `minParagraphsPerSection`: 3 paragraph blocks per section.

Word count measures the intro paragraph plus section paragraph blocks
(`section.blocks[].text` where `type = "p"`). It excludes dek, TOC labels, FAQ
questions and answers, key-takeaway blocks, related-articles boilerplate, and
footer prose. This is what appears on the dashboard Content tab and what the
CON-283 gates enforce.

The prompt targets 1,200-1,800 body words with 80-150 words per paragraph so the
model has room above the conservative 800-word rejection floor. The lower gate
keeps first-pass generation practical while still rejecting drafts that are too
thin for ranking, reader trust, or later publishing checks.
