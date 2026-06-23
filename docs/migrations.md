# Drizzle migrations — runbook

CON-215. Previously, migration `.sql` files landed in `main` but no
production runner applied them; `drizzle.__drizzle_migrations` did not
exist on prod, and 0011 + 0012 sat unapplied until a runtime 500 surfaced
the gap. This document is the new operating model.

## tl;dr

- `npm run migrate` — apply pending migrations against `$DATABASE_URL`.
  Wired into the Vercel `buildCommand` and gated on `VERCEL_ENV=production`.
- `npm run migrate:dry-run` — show what would be applied; touch nothing.
- `npm run migrate:baseline` — seed `drizzle.__drizzle_migrations` for an
  environment whose schema is already up to date (one-shot per env).
- `npm run migrate:journal` — rebuild `drizzle/meta/_journal.json`
  deterministically from the on-disk migration files.
- `npm run migrate:check` — CI guard: journal and on-disk files agree.
- `npm run test:migrations` — unit tests for the baseline tool.

## When you add a migration

1. Run `npx drizzle-kit generate` to produce a new `drizzle/####_*.sql`
   file. Drizzle-kit also appends the journal entry.
2. Open the SQL. Re-run safety is a design choice, not an accident: use
   `IF NOT EXISTS`, `DROP ... IF EXISTS`, and idempotent DDL where you
   reasonably can. The runner does NOT retry mid-flight.
3. Commit both the `.sql` and the updated `drizzle/meta/_journal.json` in
   the same commit.
4. `npm run migrate:check` locally. If it fails, the journal is out of
   sync with the files — re-run `drizzle-kit generate` or
   `npm run migrate:journal`.
5. Open the PR. The `migrations-check` workflow re-runs the guard.

## What the runner does

`scripts/migrate.mjs` uses `drizzle-orm/node-postgres/migrator` (the
driver that matches `src/lib/db/index.ts`). It:

1. Reads `drizzle/meta/_journal.json` for the ordered list of migrations.
2. Connects via `DATABASE_URL`.
3. Creates `drizzle.__drizzle_migrations` if missing.
4. Reads the latest `created_at` watermark from that tracker.
5. Applies every migration whose `when` value is strictly greater than
   the watermark, inside a single transaction. Each application inserts
   one tracker row.

The Vercel `buildCommand` runs `npm run migrate && npm run build`. The
migrate step is a no-op on previews (`VERCEL_ENV !== "production"`)
unless `MIGRATE_ALLOW_PREVIEW=1` is set on the deployment.

## What the baseline tool does

`scripts/baseline-migrations.mjs` seeds `drizzle.__drizzle_migrations`
**without executing any migration SQL**. This is the safe path for the
existing 14 prod migrations, which have already been applied by hand at
various times and would corrupt the schema if re-run (the RLS migrations
in particular are NOT idempotent).

For each journal entry, it inserts one row with:

- `hash = sha256(<raw .sql file contents>)` (hex). This is the exact
  formula `drizzle-orm/migrator.js` uses, so the runner will compare
  hashes correctly on subsequent runs.
- `created_at = <journal entry "when">` (bigint, ms). This is the
  watermark the runner reads.

Flags:

- `--dry-run` — print the plan, touch nothing.
- `--force` — allow seeding even if the tracker already has rows. Only
  hashes not already present are inserted; existing rows are untouched.
- `--up-to=<idx>` — baseline only through migration `<idx>` (inclusive).
  Use this if some later migrations should still run on the next
  `migrate.mjs` invocation.

Safety property tested in `scripts/__tests__/baseline-migrations.test.mjs`:
**no migration `.sql` body is ever passed to `client.query` as
executable SQL** — only the SHA256 of the raw bytes and the journal
`when` ever make it into a query.

## Prod baseline procedure (one-shot)

Run this against prod **once**, before the first `npm run migrate` in the
new Vercel `buildCommand` ships:

```bash
# 1. Dry run for inspection.
DATABASE_URL=$PROD_URL node scripts/baseline-migrations.mjs --dry-run

# 2. Real baseline (creates the tracker, inserts 14 rows).
DATABASE_URL=$PROD_URL node scripts/baseline-migrations.mjs

# 3. Verify.
psql $PROD_URL -c 'SELECT count(*) FROM drizzle.__drizzle_migrations'
# → 14

# 4. Confirm the runner is now a no-op.
MIGRATE_DRY_RUN=1 DATABASE_URL=$PROD_URL node scripts/migrate.mjs
# → all 14 say "skip: ... [already applied]"
```

## Missing-relation alarm

`/api/cron/migration-drift-canary` runs every 15 min (Vercel cron in
`vercel.json`). It scans recent rows in `dashboard_errors` for the three
shapes that mean schema drift:

- `relation "<x>" does not exist`
- `column "<x>" does not exist`
- `function "<x>" does not exist`

When matches are found and `CONVO_TELEGRAM_BOT_TOKEN` is configured, it
posts a summary into the Convo Telegram group (chat id
`-5244894259`). The route is auth-gated by the Vercel-supplied
`Authorization: Bearer ${CRON_SECRET}` header when `CRON_SECRET` is set.

Env required for the Telegram leg:

- `CONVO_TELEGRAM_BOT_TOKEN` — bot token for the group. Pull from 1P
  vault `Convo Infrastructure` when provisioned.
- `CRON_SECRET` — Vercel cron auth shared secret. Optional; without it
  the route accepts all callers (suitable for previews only).
