/**
 * CON-215: migration-drift canary handler (pure logic, no Next coupling).
 *
 * Scans recent `dashboard_errors` rows for the three error-message shapes
 * that mean "schema drift in prod":
 *   - relation "<x>" does not exist
 *   - column "<x>" does not exist
 *   - function "<x>" does not exist
 *
 * Summarises the hits and optionally pings the Convo Telegram group.
 */

import { z } from "zod";

export type CanaryRow = {
  id: string;
  message: string | null;
  errorClass: string | null;
  route: string | null;
  createdAt: Date;
};

export type CanaryDeps = {
  fetchRecentErrors: (sinceMs: number) => Promise<CanaryRow[]>;
  postTelegram?: (text: string) => Promise<{ ok: boolean; status?: number }>;
  /** ms since epoch, injectable for tests. Defaults to Date.now. */
  now?: () => number;
};

export type CanaryResult = {
  scanned: number;
  matched: number;
  matches: Array<{
    id: string;
    kind: "relation" | "column" | "function";
    target: string;
    route: string | null;
    createdAt: string;
  }>;
  telegramPosted: boolean;
  telegramOk?: boolean;
  windowMinutes: number;
};

// Default scan window: 30 min. Vercel cron will run every 15 min, so a
// 30-min window means a transient blip is still seen on the second pass.
const DEFAULT_WINDOW_MINUTES = 30;

const RELATION_RX = /relation\s+"?([\w.]+)"?\s+does not exist/i;
const COLUMN_RX = /column\s+"?([\w.]+)"?\s+does not exist/i;
const FUNCTION_RX = /function\s+([\w.()]+?)\s+does not exist/i;

export function classify(message: string | null): {
  kind: "relation" | "column" | "function";
  target: string;
} | null {
  if (!message) return null;
  const r = RELATION_RX.exec(message);
  if (r) return { kind: "relation", target: r[1] };
  const c = COLUMN_RX.exec(message);
  if (c) return { kind: "column", target: c[1] };
  const f = FUNCTION_RX.exec(message);
  if (f) return { kind: "function", target: f[1] };
  return null;
}

export function formatTelegramMessage(
  matches: CanaryResult["matches"],
  windowMinutes: number
): string {
  // Plain text on purpose — the bot ingest pipeline strips markdown anyway.
  // Australian English in any user-facing copy. No exclamation marks.
  const lines = [
    `Schema drift canary — ${matches.length} match${matches.length === 1 ? "" : "es"} in the last ${windowMinutes} min.`,
    "",
  ];
  const cap = 10;
  for (const m of matches.slice(0, cap)) {
    lines.push(
      `- ${m.kind} ${m.target}  route=${m.route ?? "?"}  at=${m.createdAt}`
    );
  }
  if (matches.length > cap) {
    lines.push(`… and ${matches.length - cap} more.`);
  }
  lines.push("");
  lines.push("Action: check drizzle.__drizzle_migrations vs drizzle/*.sql.");
  return lines.join("\n");
}

export async function runMigrationDriftCanary(
  deps: CanaryDeps,
  opts: { windowMinutes?: number } = {}
): Promise<CanaryResult> {
  const windowMinutes = opts.windowMinutes ?? DEFAULT_WINDOW_MINUTES;
  const now = (deps.now ?? Date.now)();
  const sinceMs = now - windowMinutes * 60_000;

  const rows = await deps.fetchRecentErrors(sinceMs);
  const matches: CanaryResult["matches"] = [];
  for (const row of rows) {
    const cls = classify(row.message);
    if (!cls) continue;
    matches.push({
      id: row.id,
      kind: cls.kind,
      target: cls.target,
      route: row.route,
      createdAt: row.createdAt.toISOString(),
    });
  }

  let telegramPosted = false;
  let telegramOk: boolean | undefined = undefined;
  if (matches.length > 0 && deps.postTelegram) {
    const text = formatTelegramMessage(matches, windowMinutes);
    const res = await deps.postTelegram(text);
    telegramPosted = true;
    telegramOk = res.ok;
  }

  return {
    scanned: rows.length,
    matched: matches.length,
    matches,
    telegramPosted,
    telegramOk,
    windowMinutes,
  };
}

export const canaryQuerySchema = z.object({
  windowMinutes: z.coerce.number().int().min(1).max(720).optional(),
});
