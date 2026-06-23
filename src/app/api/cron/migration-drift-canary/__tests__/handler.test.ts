#!/usr/bin/env node
import {
  classify,
  formatTelegramMessage,
  runMigrationDriftCanary,
  type CanaryDeps,
  type CanaryRow,
} from "../handler";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`OK ${name}`);
    passed++;
  } catch (err) {
    console.log(`FAIL ${name}`);
    console.log(`  ${err instanceof Error ? err.stack || err.message : err}`);
    failed++;
  }
}

function assert(cond: unknown, label: string) {
  if (!cond) throw new Error(label);
}
function assertEq<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function row(partial: Partial<CanaryRow> & { id: string; message: string | null }): CanaryRow {
  return {
    errorClass: null,
    route: null,
    createdAt: new Date("2026-06-23T00:00:00Z"),
    ...partial,
  };
}

async function run() {

// --- classify -----------------------------------------------------------

await test("classify: relation does not exist", () => {
  const got = classify('relation "follow_up_cases" does not exist');
  assert(got, "match");
  assertEq(got!.kind, "relation", "kind");
  assertEq(got!.target, "follow_up_cases", "target");
});

await test("classify: column does not exist", () => {
  const got = classify('column "needs_followup" does not exist');
  assert(got, "match");
  assertEq(got!.kind, "column", "kind");
  assertEq(got!.target, "needs_followup", "target");
});

await test("classify: function does not exist", () => {
  const got = classify("function process_outbox(uuid) does not exist");
  assert(got, "match");
  assertEq(got!.kind, "function", "kind");
  // function regex captures the name(args) form
  assert(got!.target.startsWith("process_outbox"), `target=${got!.target}`);
});

await test("classify: noise does not match", () => {
  assertEq(classify("Connection terminated unexpectedly"), null, "noise");
  assertEq(classify(null), null, "null");
  assertEq(classify(""), null, "empty");
});

await test("classify: schema-qualified relation", () => {
  const got = classify('relation "public.dashboard_errors" does not exist');
  assert(got, "match");
  assertEq(got!.target, "public.dashboard_errors", "target");
});

// --- runMigrationDriftCanary -------------------------------------------

await test("runMigrationDriftCanary: no rows → no telegram", async () => {
  const deps: CanaryDeps = {
    fetchRecentErrors: async () => [],
    postTelegram: async () => {
      throw new Error("must not post");
    },
  };
  const result = await runMigrationDriftCanary(deps);
  assertEq(result.scanned, 0, "scanned");
  assertEq(result.matched, 0, "matched");
  assertEq(result.telegramPosted, false, "no post");
});

await test("runMigrationDriftCanary: matches drive a telegram post", async () => {
  const posted: string[] = [];
  const deps: CanaryDeps = {
    fetchRecentErrors: async () => [
      row({
        id: "a",
        message: 'relation "follow_up_cases" does not exist',
        route: "/dashboard/conversations",
      }),
      row({
        id: "b",
        message: 'column "needs_followup" does not exist',
        route: "/api/widget/track",
      }),
      row({ id: "c", message: "Internal server error" }), // noise
    ],
    postTelegram: async (text) => {
      posted.push(text);
      return { ok: true };
    },
    now: () => Date.parse("2026-06-23T10:30:00Z"),
  };
  const result = await runMigrationDriftCanary(deps);
  assertEq(result.scanned, 3, "scanned");
  assertEq(result.matched, 2, "matched");
  assertEq(result.matches.length, 2, "matches length");
  assertEq(result.matches[0].kind, "relation", "first kind");
  assertEq(result.matches[1].kind, "column", "second kind");
  assertEq(result.telegramPosted, true, "posted");
  assertEq(result.telegramOk, true, "post ok");
  assertEq(posted.length, 1, "one post");
  assert(posted[0].includes("Schema drift canary"), "post header");
  assert(posted[0].includes("relation follow_up_cases"), "post body");
});

await test("runMigrationDriftCanary: skips telegram when not configured", async () => {
  const deps: CanaryDeps = {
    fetchRecentErrors: async () => [
      row({ id: "a", message: 'relation "x" does not exist' }),
    ],
    // postTelegram omitted on purpose
  };
  const result = await runMigrationDriftCanary(deps);
  assertEq(result.matched, 1, "matched");
  assertEq(result.telegramPosted, false, "did not post");
  assertEq(result.telegramOk, undefined, "telegramOk unset");
});

await test("runMigrationDriftCanary: caps body at 10 lines and adds overflow note", async () => {
  const many: CanaryRow[] = [];
  for (let i = 0; i < 15; i++) {
    many.push(row({ id: `r${i}`, message: `relation "t${i}" does not exist` }));
  }
  const text = formatTelegramMessage(
    many.map((r, i) => ({
      id: r.id,
      kind: "relation" as const,
      target: `t${i}`,
      route: null,
      createdAt: r.createdAt.toISOString(),
    })),
    30,
  );
  assert(text.includes("and 5 more"), `overflow note: ${text}`);
});

await test("formatTelegramMessage: no exclamation marks (brand rule)", () => {
  const text = formatTelegramMessage(
    [
      {
        id: "a",
        kind: "relation",
        target: "foo",
        route: "/x",
        createdAt: "2026-06-23T00:00:00.000Z",
      },
    ],
    30,
  );
  assert(!text.includes("!"), "no exclamation marks");
});

  console.log(`\n${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

run();
