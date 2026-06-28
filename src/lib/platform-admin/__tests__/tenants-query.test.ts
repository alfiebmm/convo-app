import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canPaginateSort,
  cursorSafeSorts,
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

test("canPaginateSort allows signup-desc and blocks every other sort", () => {
  // CON-PLATFORM-ADMIN-QA-1: the current cursor predicate is
  // `(t.created_at, t.id) < (...)`. Only signup-desc matches that
  // direction; signup-asc would need `>` and the alphabetic / activity
  // sorts need entirely different cursor columns.
  assert.equal(canPaginateSort("signup-desc"), true);
  assert.equal(canPaginateSort("signup-asc"), false);
  assert.equal(canPaginateSort("name-asc"), false);
  assert.equal(canPaginateSort("name-desc"), false);
  assert.equal(canPaginateSort("plan-asc"), false);
  assert.equal(canPaginateSort("status-asc"), false);
  assert.equal(canPaginateSort("last-conversation-desc"), false);
  assert.equal(canPaginateSort("conversation-count-desc"), false);

  // And the underlying set agrees.
  assert.deepEqual([...cursorSafeSorts], ["signup-desc"]);
});

test("parseTenantFilters defaults missing inactivity and cursor cleanly", () => {
  const filters = parseTenantFilters({});
  assert.deepEqual(filters.plans, []);
  assert.deepEqual(filters.statuses, []);
  assert.equal(filters.inactivity, null);
  assert.equal(filters.q, "");
  assert.equal(filters.cursor, null);
  assert.equal(filters.sort, "signup-desc");
});

test("parseTenantFilters accepts every documented sort option", () => {
  for (const sort of [
    "signup-desc",
    "signup-asc",
    "name-asc",
    "name-desc",
    "plan-asc",
    "status-asc",
    "last-conversation-desc",
    "conversation-count-desc",
  ]) {
    const filters = parseTenantFilters({ sort });
    assert.equal(filters.sort, sort, `sort=${sort} should round-trip`);
  }
});

test("parseTenantFilters strips empty plan/status tokens from comma lists", () => {
  const filters = parseTenantFilters({
    plan: "starter,,growth, ,scale",
    status: "active, suspended,",
  });
  assert.deepEqual(filters.plans, ["starter", "growth", "scale"]);
  assert.deepEqual(filters.statuses, ["active", "suspended"]);
});

test("decodeTenantCursor rejects partially-formed payloads", () => {
  const okay = encodeTenantCursor({
    createdAt: "2026-06-24T00:00:00.000Z",
    id: "00000000-0000-0000-0000-000000000001",
  });
  assert.ok(decodeTenantCursor(okay));

  const missingId = Buffer.from(
    JSON.stringify({ createdAt: "2026-06-24T00:00:00.000Z" }),
  ).toString("base64url");
  assert.equal(decodeTenantCursor(missingId), null);

  const emptyStrings = Buffer.from(
    JSON.stringify({ createdAt: "", id: "" }),
  ).toString("base64url");
  assert.equal(decodeTenantCursor(emptyStrings), null);

  assert.equal(decodeTenantCursor(""), null);
  assert.equal(decodeTenantCursor(null), null);
  assert.equal(decodeTenantCursor(undefined), null);
});
