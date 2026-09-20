#!/usr/bin/env node

import assert from "node:assert/strict";
import { test } from "node:test";

import { backfillNoBlogSource } from "../backfill-no-blog-source";

const candidates = [
  {
    tenant_id: "11111111-1111-4111-8111-111111111111",
    conversation_id: "22222222-2222-4222-8222-222222222222",
    decision_log_id: "33333333-3333-4333-8333-333333333333",
    reason: "OpenAI extraction returned insufficient keyword or intent signal.",
  },
  {
    tenant_id: "44444444-4444-4444-8444-444444444444",
    conversation_id: "55555555-5555-4555-8555-555555555555",
    decision_log_id: "66666666-6666-4666-8666-666666666666",
    reason: "OpenAI extraction returned insufficient keyword or intent signal.",
  },
];

function makeDb() {
  const calls: Array<{ text: string; values?: unknown[] }> = [];
  return {
    calls,
    async query<T = Record<string, unknown>>(text: string, values?: unknown[]) {
      calls.push({ text, values });
      if (/WITH latest_decision/.test(text)) {
        return { rows: candidates as T[], rowCount: candidates.length };
      }
      return { rows: [] as T[], rowCount: 1 };
    },
  };
}

test("backfill-no-blog-source dry-run lists candidates without mutations", async () => {
  const db = makeDb();
  const result = await backfillNoBlogSource({ db, dryRun: true });

  assert.equal(result.found, 2);
  assert.equal(result.updated, 0);
  assert.equal(db.calls.length, 1);
  assert.match(db.calls[0].text, /latest_decision\.reason = \$1/);
});

test("backfill-no-blog-source apply updates each candidate idempotently", async () => {
  const db = makeDb();
  const result = await backfillNoBlogSource({ db, dryRun: false });

  assert.equal(result.found, 2);
  assert.equal(result.updated, 2);
  assert.equal(db.calls.length, 3);
  assert.match(db.calls[1].text, /no_blog_source/);
  assert.match(db.calls[1].text, /converted_to_blog/);
  assert.deepEqual(db.calls[1].values?.slice(0, 2), [
    candidates[0].tenant_id,
    candidates[0].conversation_id,
  ]);
});
