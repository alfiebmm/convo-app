#!/usr/bin/env node

import { pathToFileURL } from "node:url";
import pg from "pg";

export const NO_BLOG_SOURCE_REASON =
  "OpenAI extraction returned insufficient keyword or intent signal.";

type CandidateRow = {
  tenant_id: string;
  conversation_id: string;
  decision_log_id: string | null;
  reason: string | null;
};

type Queryable = {
  query<T = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number | null }>;
};

export type BackfillNoBlogSourceResult = {
  dryRun: boolean;
  found: number;
  updated: number;
  candidates: CandidateRow[];
};

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function assertDryRunMode() {
  const dryRun = hasFlag("--dry-run");
  const apply = hasFlag("--apply");
  if (dryRun && apply) throw new Error("Use either --dry-run or --apply, not both");
  return !apply;
}

export async function findNoBlogSourceCandidates(db: Queryable) {
  const result = await db.query<CandidateRow>(
    `
      WITH latest_decision AS (
        SELECT DISTINCT ON (bdl.conversation_id)
               bdl.conversation_id,
               bdl.id AS decision_log_id,
               bdl.reason
          FROM blog_decision_logs bdl
         ORDER BY bdl.conversation_id, bdl.created_at DESC
      )
      SELECT c.tenant_id::text AS tenant_id,
             c.id::text AS conversation_id,
             latest_decision.decision_log_id::text AS decision_log_id,
             latest_decision.reason
        FROM conversations c
        INNER JOIN latest_decision
          ON latest_decision.conversation_id = c.id
        LEFT JOIN blog_posts bp
          ON bp.thread_id = c.id
       WHERE COALESCE(c.metadata->'blogConversion'->>'state', '') = 'converted_to_blog'
         AND bp.id IS NULL
         AND latest_decision.reason = $1
       ORDER BY c.tenant_id ASC, c.started_at ASC
    `,
    [NO_BLOG_SOURCE_REASON],
  );

  return result.rows;
}

async function applyNoBlogSourceCandidate(db: Queryable, candidate: CandidateRow) {
  const result = await db.query(
    `
      UPDATE conversations
         SET metadata = jsonb_set(
               jsonb_set(
                 jsonb_set(
                   metadata,
                   '{blogConversion,state}',
                   '"no_blog_source"'::jsonb,
                   true
                 ),
                 '{blogConversion,reason}',
                 to_jsonb($3::text),
                 true
               ),
               '{blogConversion,decisionLogId}',
               to_jsonb($4::text),
               true
             )
       WHERE tenant_id = $1::uuid
         AND id = $2::uuid
         AND COALESCE(metadata->'blogConversion'->>'state', '') = 'converted_to_blog'
    `,
    [
      candidate.tenant_id,
      candidate.conversation_id,
      candidate.reason ?? NO_BLOG_SOURCE_REASON,
      candidate.decision_log_id ?? "",
    ],
  );

  return result.rowCount ?? 0;
}

export async function backfillNoBlogSource({
  db,
  dryRun,
}: {
  db: Queryable;
  dryRun: boolean;
}): Promise<BackfillNoBlogSourceResult> {
  const candidates = await findNoBlogSourceCandidates(db);
  let updated = 0;

  for (const candidate of candidates) {
    console.log(
      JSON.stringify({
        dryRun,
        tenantId: candidate.tenant_id,
        conversationId: candidate.conversation_id,
        decisionLogId: candidate.decision_log_id,
        reason: candidate.reason,
      }),
    );

    if (!dryRun) {
      updated += await applyNoBlogSourceCandidate(db, candidate);
    }
  }

  return {
    dryRun,
    found: candidates.length,
    updated,
    candidates,
  };
}

async function main() {
  const dryRun = assertDryRunMode();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  const pool = new pg.Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("sslmode=disable")
      ? undefined
      : { rejectUnauthorized: false },
  });

  try {
    const result = await backfillNoBlogSource({ db: pool, dryRun });
    console.log(
      JSON.stringify(
        {
          dryRun: result.dryRun,
          found: result.found,
          updated: result.updated,
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
