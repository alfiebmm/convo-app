#!/usr/bin/env node

/**
 * Backfill blog post hero images that accidentally used the tenant logo URL.
 *
 * Usage:
 *   npm exec tsx scripts/backfill-hero-logo-fallback.ts
 *   npm exec tsx scripts/backfill-hero-logo-fallback.ts -- --db-url=postgres://...
 *   npm exec tsx scripts/backfill-hero-logo-fallback.ts -- --apply
 *
 * Dry-run is the default. Pass --apply to write existing draft/generation_failed
 * rows by replacing metadata.hero.url with the same placeholder fallback used by
 * blog creation. This must only be run against a local/dev DB unless Blake or Cam
 * explicitly approves the production one-shot.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import pg from "pg";

import {
  heroPlaceholderUrlForBrand,
  heroUrlMatchesBrandLogo,
  isHttpsUrl,
} from "../src/lib/blog/hero-placeholder";

type CandidateRow = {
  tenant_id: string;
  tenant_name: string;
  tenant_settings: unknown;
  post_id: string;
  post_metadata: unknown;
};

type TenantSummary = {
  tenantId: string;
  tenantName: string;
  count: number;
  sampleIds: string[];
};

function loadLocalEnv() {
  for (const path of [resolve(process.cwd(), ".env"), resolve(process.cwd(), ".env.local")]) {
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function settingPath(settings: unknown, pathParts: string[]): unknown {
  let current: unknown = settings;
  for (const part of pathParts) {
    if (!isRecord(current)) return undefined;
    current = current[part];
  }
  return current;
}

function readArgValue(name: string): string | undefined {
  const prefix = `${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function resolveDatabaseUrl(): string {
  const fromArg = readArgValue("--db-url");
  if (fromArg) return fromArg;

  loadLocalEnv();
  const fromEnv = process.env.DATABASE_URL;
  if (!fromEnv) throw new Error("DATABASE_URL is required, or pass --db-url");
  return fromEnv;
}

function resolveBrandJson(settings: unknown): Record<string, unknown> | null {
  const candidate =
    settingPath(settings, ["brandJson"]) ??
    settingPath(settings, ["brand_json"]) ??
    settingPath(settings, ["blog", "brandJson"]) ??
    settingPath(settings, ["forumConfig", "blog", "brandJson"]);

  return isRecord(candidate) ? candidate : null;
}

function resolvePlaceholderUrl({
  settings,
  brand,
}: {
  settings: unknown;
  brand: Record<string, unknown>;
}): string {
  const configuredHeroUrl = readString(
    settingPath(settings, ["brandJson", "heroPlaceholder", "url"])
  );

  return isHttpsUrl(configuredHeroUrl)
    ? configuredHeroUrl
    : heroPlaceholderUrlForBrand(brand);
}

function readHeroUrl(metadata: unknown): string | null {
  if (!isRecord(metadata) || !isRecord(metadata.hero)) return null;
  return readString(metadata.hero.url);
}

function metadataWithHeroPlaceholder(
  metadata: unknown,
  placeholderUrl: string
): Record<string, unknown> {
  const base = isRecord(metadata) ? metadata : {};
  const hero = isRecord(base.hero) ? base.hero : {};

  return {
    ...base,
    hero: {
      ...hero,
      url: placeholderUrl,
    },
  };
}

async function fetchCandidateRows(pool: pg.Pool): Promise<CandidateRow[]> {
  const result = await pool.query<CandidateRow>(`
    SELECT t.id AS tenant_id,
           t.name AS tenant_name,
           t.settings AS tenant_settings,
           bp.id AS post_id,
           bp.metadata AS post_metadata
      FROM blog_posts bp
      JOIN tenants t
        ON t.id = bp.tenant_id
     WHERE bp.status IN ('draft', 'generation_failed')
       AND bp.metadata->'hero'->>'url' IS NOT NULL
       AND t.settings->'brandJson'->'logo'->>'url' IS NOT NULL
     ORDER BY t.name ASC, bp.created_at ASC, bp.id ASC
  `);

  return result.rows;
}

function findMatches(rows: CandidateRow[]): Array<CandidateRow & {
  brand: Record<string, unknown>;
  placeholderUrl: string;
}> {
  return rows.flatMap((row) => {
    const brand = resolveBrandJson(row.tenant_settings);
    const heroUrl = readHeroUrl(row.post_metadata);
    if (!brand || !heroUrl || !heroUrlMatchesBrandLogo({ heroUrl, brand })) {
      return [];
    }

    return [
      {
        ...row,
        brand,
        placeholderUrl: resolvePlaceholderUrl({
          settings: row.tenant_settings,
          brand,
        }),
      },
    ];
  });
}

function summariseMatches(matches: CandidateRow[]): TenantSummary[] {
  const summaries = new Map<string, TenantSummary>();

  for (const match of matches) {
    const summary =
      summaries.get(match.tenant_id) ??
      {
        tenantId: match.tenant_id,
        tenantName: match.tenant_name,
        count: 0,
        sampleIds: [],
      };

    summary.count++;
    if (summary.sampleIds.length < 3) summary.sampleIds.push(match.post_id);
    summaries.set(match.tenant_id, summary);
  }

  return Array.from(summaries.values());
}

async function applyMatches(
  pool: pg.Pool,
  matches: Array<CandidateRow & { placeholderUrl: string }>
): Promise<number> {
  let updated = 0;

  for (const match of matches) {
    const metadata = metadataWithHeroPlaceholder(
      match.post_metadata,
      match.placeholderUrl
    );
    const result = await pool.query(
      `
        UPDATE blog_posts
           SET metadata = $2::jsonb,
               last_modified = NOW()
         WHERE id = $1
           AND status IN ('draft', 'generation_failed')
      `,
      [match.post_id, JSON.stringify(metadata)]
    );
    updated += result.rowCount ?? 0;
  }

  return updated;
}

async function main() {
  const apply = hasFlag("--apply");
  const dryRun = !apply;
  const databaseUrl = resolveDatabaseUrl();
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("sslmode=disable")
      ? undefined
      : { rejectUnauthorized: false },
  });

  try {
    const rows = await fetchCandidateRows(pool);
    const matches = findMatches(rows);
    const summaries = summariseMatches(matches);

    for (const summary of summaries) {
      console.log(
        `${summary.tenantName}\t${summary.count}\tsample_ids=${summary.sampleIds.join(",")}`
      );
    }

    const updated = apply ? await applyMatches(pool, matches) : 0;
    console.log(
      JSON.stringify(
        {
          dryRun,
          scanned: rows.length,
          matched: matches.length,
          updated,
          tenants: summaries.length,
        },
        null,
        2
      )
    );
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
