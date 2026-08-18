#!/usr/bin/env node

import pg from "pg";

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  failed_count: string;
};

type ReprocessResponse = {
  tenantId: string;
  purged: number;
  queued: number;
  skipped: number;
  notFound: number;
  conversationIds: string[];
};

const ENDPOINT_PATH = "/api/blog/reprocess-failed";
const ENDPOINT_LIMIT_MAX = 50;

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function readNumericFlag(name: string, fallback: number) {
  const prefix = `${name}=`;
  const raw =
    process.argv
      .find((arg) => arg.startsWith(prefix))
      ?.slice(prefix.length) ?? undefined;
  if (!raw) return fallback;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function resolveBaseUrl() {
  const raw =
    process.env.REPROCESS_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ??
    "http://localhost:3000";

  return raw.replace(/\/+$/, "");
}

async function listTenantsWithFailedPosts(pool: pg.Pool) {
  const result = await pool.query<TenantRow>(`
    SELECT t.id,
           t.name,
           t.slug,
           COUNT(bp.id)::text AS failed_count
      FROM tenants t
      LEFT JOIN blog_posts bp
        ON bp.tenant_id = t.id
       AND bp.status = 'generation_failed'
     WHERE t.status = 'active'
     GROUP BY t.id, t.name, t.slug
     ORDER BY t.slug ASC
  `);

  return result.rows;
}

async function postReprocess({
  baseUrl,
  cronSecret,
  tenantId,
  limit,
}: {
  baseUrl: string;
  cronSecret: string;
  tenantId: string;
  limit: number;
}) {
  const response = await fetch(`${baseUrl}${ENDPOINT_PATH}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${cronSecret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ tenantId, limit, mode: "retry_failed" }),
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(
      `POST ${ENDPOINT_PATH} failed for ${tenantId}: ${response.status} ${text}`,
    );
  }

  return body as ReprocessResponse;
}

async function main() {
  const dryRun = hasFlag("--dry-run");
  const requestedLimit = readNumericFlag("--max-rows", 100);
  const limit = Math.min(requestedLimit, ENDPOINT_LIMIT_MAX);
  const databaseUrl = process.env.DATABASE_URL;
  const cronSecret = process.env.CRON_SECRET;
  const baseUrl = resolveBaseUrl();

  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  if (!dryRun && !cronSecret) throw new Error("CRON_SECRET is required");

  if (requestedLimit > ENDPOINT_LIMIT_MAX) {
    console.log(
      `Capping --max-rows=${requestedLimit} to endpoint limit ${ENDPOINT_LIMIT_MAX}`,
    );
  }

  const pool = new pg.Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("sslmode=disable")
      ? undefined
      : { rejectUnauthorized: false },
  });

  try {
    const tenants = await listTenantsWithFailedPosts(pool);
    const tenantsToProcess = tenants.filter(
      (tenant) => Number(tenant.failed_count) > 0,
    );

    console.log(
      JSON.stringify(
        {
          dryRun,
          baseUrl,
          activeTenants: tenants.length,
          tenantsWithFailedPosts: tenantsToProcess.length,
          limit,
        },
        null,
        2,
      ),
    );

    const totals = {
      processed: 0,
      queued: 0,
      skipped: 0,
      notFound: 0,
    };

    for (const tenant of tenantsToProcess) {
      const failedCount = Number(tenant.failed_count);
      if (dryRun) {
        console.log(
          JSON.stringify(
            {
              tenantId: tenant.id,
              slug: tenant.slug,
              failedCount,
              wouldPost: {
                path: ENDPOINT_PATH,
                body: { tenantId: tenant.id, limit, mode: "retry_failed" },
              },
            },
            null,
            2,
          ),
        );
        totals.processed += Math.min(failedCount, limit);
        continue;
      }

      const result = await postReprocess({
        baseUrl,
        cronSecret: cronSecret ?? "",
        tenantId: tenant.id,
        limit,
      });

      totals.processed += result.purged;
      totals.queued += result.queued;
      totals.skipped += result.skipped;
      totals.notFound += result.notFound;

      console.log(
        JSON.stringify(
          {
            tenantId: tenant.id,
            slug: tenant.slug,
            failedCount,
            processed: result.purged,
            queued: result.queued,
            skipped: result.skipped,
            notFound: result.notFound,
            conversationIds: result.conversationIds,
          },
          null,
          2,
        ),
      );
    }

    console.log(JSON.stringify({ totals }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
