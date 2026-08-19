#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import pg from "pg";

import { computeBlogPostWordCountFallback } from "../src/lib/blog/queries";

type BlogPostRow = {
  id: string;
  title: string | null;
  content: string | null;
  metadata: unknown;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function hasPersistedWordCount(metadata: unknown): boolean {
  if (!isRecord(metadata) || !isRecord(metadata.stats)) return false;
  return (
    typeof metadata.stats.wordCount === "number" ||
    (typeof metadata.stats.wordCount === "string" && /^\d+$/.test(metadata.stats.wordCount))
  );
}

export function metadataWithWordCount(
  metadata: unknown,
  wordCount: number
): Record<string, unknown> {
  const base = isRecord(metadata) ? metadata : {};
  const existingStats = base.stats;
  const preservedCards = Array.isArray(existingStats)
    ? existingStats
    : isRecord(existingStats) && Array.isArray(existingStats.cards)
      ? existingStats.cards
      : null;
  const stats = isRecord(existingStats) && !Array.isArray(existingStats)
    ? existingStats
    : {};

  return {
    ...base,
    word_count: wordCount,
    wordCount,
    stats: {
      ...stats,
      wordCount,
      cards: preservedCards,
    },
  };
}

function loadLocalEnv() {
  for (const path of [
    resolve(process.cwd(), ".env.local"),
    resolve(process.env.HOME ?? "", ".openclaw/workspace/.env.local"),
  ]) {
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  }
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function readNumericFlag(name: string): number | undefined {
  const prefix = `${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  if (!raw) return undefined;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

async function fetchRows(pool: pg.Pool, limit?: number): Promise<BlogPostRow[]> {
  const params: number[] = [];
  const limitSql = limit ? " LIMIT $1" : "";
  if (limit) params.push(limit);

  const result = await pool.query<BlogPostRow>(
    `
      SELECT id, title, content, metadata
        FROM blog_posts
       WHERE metadata #>> '{stats,wordCount}' IS NULL
       ORDER BY created_at ASC, id ASC
      ${limitSql}
    `,
    params,
  );

  return result.rows;
}

async function updateRow(
  pool: pg.Pool,
  row: BlogPostRow,
  wordCount: number
): Promise<void> {
  await pool.query(
    `
      UPDATE blog_posts
         SET metadata = jsonb_set(
               jsonb_set(
                 metadata,
                 '{word_count}',
                 to_jsonb($2::integer),
                 true
               ),
               '{stats}',
               (
                 CASE
                   WHEN jsonb_typeof(metadata->'stats') = 'object'
                     THEN metadata->'stats'
                   ELSE '{}'::jsonb
                 END
               ) || jsonb_build_object(
                 'wordCount',
                 $2::integer,
                 'cards',
                 CASE
                   WHEN jsonb_typeof(metadata->'stats') = 'array'
                     THEN metadata->'stats'
                   WHEN jsonb_typeof(metadata->'stats'->'cards') = 'array'
                     THEN metadata->'stats'->'cards'
                   ELSE 'null'::jsonb
                 END
               ),
               true
             )
       WHERE id = $1
         AND metadata #>> '{stats,wordCount}' IS NULL
    `,
    [row.id, wordCount],
  );
}

function fixtureRows(): BlogPostRow[] {
  return [
    {
      id: "fixture-article-1",
      title: "Fixture article",
      content: "<html><body><p>One two three.</p><p>Four five.</p></body></html>",
      metadata: {},
    },
    {
      id: "fixture-article-2",
      title: "Already backfilled fixture",
      content: "<p>Already done.</p>",
      metadata: { stats: { wordCount: 2 } },
    },
  ];
}

export async function backfillBlogWordCounts({
  dryRun,
  rows,
  pool,
}: {
  dryRun: boolean;
  rows: BlogPostRow[];
  pool?: pg.Pool;
}) {
  const totals = { scanned: 0, skipped: 0, backfilled: 0 };

  for (const row of rows) {
    totals.scanned++;
    if (hasPersistedWordCount(row.metadata)) {
      totals.skipped++;
      continue;
    }

    const wordCount = computeBlogPostWordCountFallback(row.content);
    if (!wordCount) {
      totals.skipped++;
      console.log(`${row.id}\t${row.title ?? "Untitled article"}\tskipped`);
      continue;
    }

    console.log(
      `${row.id}\t${row.title ?? "Untitled article"}\t${wordCount}\t${
        dryRun ? "dry-run" : "updated"
      }`,
    );

    if (!dryRun) {
      if (!pool) throw new Error("pool is required for live backfill");
      await updateRow(pool, row, wordCount);
    }

    totals.backfilled++;
  }

  return totals;
}

async function main() {
  const dryRun = hasFlag("--dry-run");
  const useFixture = hasFlag("--fixture");
  const limit = readNumericFlag("--limit");

  if (useFixture) {
    const totals = await backfillBlogWordCounts({
      dryRun: true,
      rows: fixtureRows().slice(0, limit),
    });
    console.log(JSON.stringify({ dryRun: true, fixture: true, totals }, null, 2));
    return;
  }

  loadLocalEnv();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  const pool = new pg.Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("sslmode=disable")
      ? undefined
      : { rejectUnauthorized: false },
  });

  try {
    const rows = await fetchRows(pool, limit);
    const totals = await backfillBlogWordCounts({ dryRun, rows, pool });
    console.log(JSON.stringify({ dryRun, totals }, null, 2));
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
