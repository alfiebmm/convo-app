#!/usr/bin/env node

/**
 * CON-error-logging: unit tests for the `sanitiseRequestMeta` helper.
 *
 * Run with:
 *   npx tsx src/lib/errors/__tests__/log.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { sanitiseRequestMeta } from "../log";

test("sanitiseRequestMeta: drops auth + PII keys (case-insensitive)", () => {
  const input = {
    method: "POST",
    Authorization: "Bearer secret",
    cookie: "auth=...",
    "x-api-key": "k",
    email: "user@example.com",
    Phone: "+61400000000",
    name: "Jane Smith",
    ip: "1.2.3.4",
    body: { password: "p" },
    requestBody: { secret: 1 },
  };
  const out = sanitiseRequestMeta(input);
  assert.deepEqual(Object.keys(out).sort(), ["method"]);
  assert.equal(out.method, "POST");
});

test("sanitiseRequestMeta: filters headers to the allow-list", () => {
  const input = {
    headers: {
      "x-vercel-id": "iad1::abc",
      "cf-ray": "ray-1",
      "user-agent": "Mozilla/5.0",
      // Should be dropped — not on the allow-list:
      authorization: "Bearer x",
      "x-forwarded-for": "1.2.3.4",
      cookie: "k=v",
    },
  };
  const out = sanitiseRequestMeta(input);
  const headers = out.headers as Record<string, string>;
  assert.deepEqual(Object.keys(headers).sort(), [
    "cf-ray",
    "user-agent",
    "x-vercel-id",
  ]);
});

test("sanitiseRequestMeta: drops non-serialisable values", () => {
  const cyclic: { self?: unknown } = {};
  cyclic.self = cyclic;
  const input = {
    method: "GET",
    cyclic,
    fn: () => 1,
    date: new Date("2026-06-22T00:00:00Z"),
    arr: [1, 2, 3],
  };
  const out = sanitiseRequestMeta(input);
  assert.equal(out.method, "GET");
  // Cyclic structure drops.
  assert.equal(out.cyclic, undefined);
  // Functions get stripped by JSON.stringify, leaving undefined → dropped.
  assert.equal(out.fn, undefined);
  // Dates survive as ISO strings via toJSON → JSON round-trip.
  assert.equal(out.date, "2026-06-22T00:00:00.000Z");
  // Arrays survive.
  assert.deepEqual(out.arr, [1, 2, 3]);
});

test("sanitiseRequestMeta: empty / undefined input is safe", () => {
  assert.deepEqual(sanitiseRequestMeta(undefined), {});
  assert.deepEqual(sanitiseRequestMeta({}), {});
});

test("sanitiseRequestMeta: nested objects survive (and don't leak through allow-list-bypass)", () => {
  const out = sanitiseRequestMeta({
    method: "POST",
    searchKeys: ["q", "page"],
    nested: { kind: "thing", count: 3 },
  });
  assert.equal(out.method, "POST");
  assert.deepEqual(out.searchKeys, ["q", "page"]);
  assert.deepEqual(out.nested, { kind: "thing", count: 3 });
});
