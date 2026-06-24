import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decodeTenantCursor,
  encodeTenantCursor,
  isEmailQuery,
  parseTenantFilters,
  parseTenantTab,
} from "../tenants-query";

test("tenant filters parse plan, status, inactivity, q, and sort from querystring", () => {
  const filters = parseTenantFilters({
    plan: ["starter", "scale", "bad"],
    status: "active,deleted_soft,unknown",
    inactivity: "90d",
    q: "  doggo  ",
    sort: "name-asc",
  });

  assert.deepEqual(filters.plans, ["starter", "scale"]);
  assert.deepEqual(filters.statuses, ["active", "deleted_soft"]);
  assert.equal(filters.inactivity, "90d");
  assert.equal(filters.q, "doggo");
  assert.equal(filters.sort, "name-asc");
});

test("tenant filters ignore invalid query values", () => {
  const filters = parseTenantFilters({
    plan: "enterprise",
    status: "churned",
    inactivity: "7d",
    sort: "owner-email",
  });

  assert.deepEqual(filters.plans, []);
  assert.deepEqual(filters.statuses, []);
  assert.equal(filters.inactivity, null);
  assert.equal(filters.sort, "signup-desc");
});

test("tenant cursor encoding round-trips and invalid cursors fail closed", () => {
  const cursor = {
    createdAt: "2026-06-24T01:02:03.000Z",
    id: "00000000-0000-0000-0000-000000000220",
  };

  assert.deepEqual(decodeTenantCursor(encodeTenantCursor(cursor)), cursor);
  assert.equal(decodeTenantCursor("not-json"), null);
});

test("email detection treats q containing @ as member-email lookup", () => {
  assert.equal(isEmailQuery("foo@bar"), true);
  assert.equal(isEmailQuery("foo"), false);
});

test("tenant detail tab parser defaults to profile and switches valid tabs", () => {
  assert.equal(parseTenantTab({}), "profile");
  assert.equal(parseTenantTab({ tab: "activity" }), "activity");
  assert.equal(parseTenantTab({ tab: "danger" }), "danger");
  assert.equal(parseTenantTab({ tab: "missing" }), "profile");
});
