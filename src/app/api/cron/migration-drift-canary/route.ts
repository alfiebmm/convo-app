/**
 * GET /api/cron/migration-drift-canary
 *
 * CON-215 (criterion 5): scheduled scan of `dashboard_errors` for the three
 * "schema drift" shapes (relation/column/function does not exist). When the
 * Telegram bot creds are present, posts a summary into the Convo group.
 *
 * Wired into Vercel cron via `vercel.json` (15 min cadence).
 *
 * Auth: Vercel cron requests carry `Authorization: Bearer ${CRON_SECRET}`
 * (when the project env var is set). We accept the request when:
 *   - CRON_SECRET is not configured (dev/preview), OR
 *   - the header matches.
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { withApiErrorLogging } from "@/lib/errors/wrap";
import {
  runMigrationDriftCanary,
  canaryQuerySchema,
  type CanaryRow,
} from "./handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TELEGRAM_GROUP_CHAT_ID = "-5244894259"; // Convo group, per CON-215 handover.

function isAuthorised(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true; // dev / preview without secret
  const got = req.headers.get("authorization");
  return got === `Bearer ${expected}`;
}

async function postTelegram(
  text: string
): Promise<{ ok: boolean; status?: number }> {
  const token = process.env.CONVO_TELEGRAM_BOT_TOKEN;
  if (!token) {
    // Creds not provisioned in this environment. We still record the find;
    // the route response carries the matches so an operator can see them.
    return { ok: false };
  }
  const res = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_GROUP_CHAT_ID,
        text,
        disable_web_page_preview: true,
      }),
    }
  );
  return { ok: res.ok, status: res.status };
}

async function getImpl(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const parsed = canaryQuerySchema.safeParse({
    windowMinutes: url.searchParams.get("windowMinutes") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const windowMinutes = parsed.data.windowMinutes;

  const result = await runMigrationDriftCanary(
    {
      fetchRecentErrors: async (sinceMs: number): Promise<CanaryRow[]> => {
        // Raw SQL — we want `created_at >= to_timestamp($1 / 1000.0)` and a
        // bounded LIMIT, both with the exact column names from the
        // `dashboard_errors` table.
        const since = new Date(sinceMs);
        const { rows } = (await db.execute(sql`
          SELECT id, message, error_class, route, created_at
            FROM dashboard_errors
           WHERE created_at >= ${since}
             AND message IS NOT NULL
             AND (
                  message ILIKE '%does not exist%'
             )
           ORDER BY created_at DESC
           LIMIT 200
        `)) as unknown as {
          rows: Array<{
            id: string;
            message: string | null;
            error_class: string | null;
            route: string | null;
            created_at: Date | string;
          }>;
        };
        return rows.map((r) => ({
          id: String(r.id),
          message: r.message,
          errorClass: r.error_class,
          route: r.route,
          createdAt:
            r.created_at instanceof Date
              ? r.created_at
              : new Date(r.created_at),
        }));
      },
      postTelegram,
    },
    windowMinutes !== undefined ? { windowMinutes } : {}
  );

  return NextResponse.json(result);
}

export const GET = withApiErrorLogging(getImpl, {
  route: "/api/cron/migration-drift-canary",
});
