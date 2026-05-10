# Knowledge pipeline QA scripts

These are off-tree smoke tests that exercise the real Knowledge & Context
pipeline (K-03 / K-05) against the live Supabase backend. They were used to
validate the CON-85 + CON-87 PR before merge and are kept as regression assets
for future Knowledge-tab work.

## Setup

Export the same envs Vercel uses:

```bash
export DATABASE_URL='postgresql://postgres:...@db.<project>.supabase.co:5432/postgres'
export NEXT_PUBLIC_SUPABASE_URL='https://<project>.supabase.co'
export SUPABASE_SERVICE_ROLE_KEY='<service role JWT>'
export OPENAI_API_KEY='sk-proj-...'
```

The scripts create throwaway tenants (slug prefixed `qa-k03-` / `qa-k05-`),
exercise the pipeline, verify the data, then tear themselves down.

## Run

```bash
# File upload + ingestion (uses scripts/fixtures/qa-knowledge-smoke.txt)
npx tsx scripts/qa-file-ingest.mjs

# Site crawl + page indexing (crawls convoapp.com.au by default — edit the
# domain inside the script for other targets)
npx tsx scripts/qa-site-crawl.mjs
```

Exit code is 0 on pass, 1 on fail. Both scripts log progress + final counts.

## What they verify

`qa-file-ingest.mjs`:

- Upload to Supabase Storage bucket `knowledge-files`
- `knowledge_files` row inserted with status `pending`
- `ingestFile()` chunks + embeds + inserts into `knowledge_items`
- File status flips to `indexed`
- Embeddings present on every chunk
- `ON DELETE CASCADE` from `knowledge_files` → `knowledge_items` works

`qa-site-crawl.mjs`:

- `indexTenantSite()` crawls and chunks pages
- Pages inserted into `knowledge_items` with `type='page'`
- Embeddings present
- Tenant + indexed rows clean up on teardown

## Caveats

- They hit the live DB. Don't run them with a `DATABASE_URL` pointing at a
  shared production tenant unless you're confident about the `qa-*` slug
  isolation.
- They burn a few OpenAI embedding credits per run (cheap, but real).
