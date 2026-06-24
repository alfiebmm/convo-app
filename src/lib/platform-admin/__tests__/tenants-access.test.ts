import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluatePlatformStaffAccess, parsePlatformStaffEmails } from "../access";
import { withAuditLog, type AuditRowInsert, type AuditStore } from "../audit";
import { loadTenantDetail, loadTenants, parseTenantFilters } from "../tenants-query";
import type { Database } from "@/lib/db";

const allowlist = parsePlatformStaffEmails("blake@example.com,cam@example.com");
const actor = {
  id: "00000000-0000-0000-0000-000000000220",
  email: "blake@example.com",
};

function createStore(): AuditStore & { rows: AuditRowInsert[] } {
  const rows: AuditRowInsert[] = [];
  return {
    rows,
    async insert(row) {
      rows.push(row);
    },
    async findSuccessfulOutcome() {
      return null;
    },
  };
}

function fakeDatabase(results: unknown[][]): Database {
  let index = 0;
  return {
    execute: async () => ({ rows: results[index++] ?? [] }),
  } as unknown as Database;
}

test("tenant admin access bar denies authenticated non-staff tenant users", () => {
  assert.equal(
    evaluatePlatformStaffAccess(
      { id: "tenant", email: "tenant@example.com", isPlatformStaff: false },
      allowlist,
    ),
    false,
  );
});

test("tenant admin access bar denies staff users outside env allowlist", () => {
  assert.equal(
    evaluatePlatformStaffAccess(
      { id: "other", email: "other@example.com", isPlatformStaff: true },
      allowlist,
    ),
    false,
  );
});

test("tenant admin access bar grants only env allowlist plus DB staff flag", () => {
  assert.equal(
    evaluatePlatformStaffAccess(
      { id: "blake", email: "blake@example.com", isPlatformStaff: true },
      allowlist,
    ),
    true,
  );
});

test("tenant list render path audits once per page load operation", async () => {
  const store = createStore();
  const filters = parseTenantFilters({});
  const result = await withAuditLog(
    {
      action: "tenant.view",
      target: { type: "tenants_list", id: "all" },
      metadata: { filters: {}, page_size: 50 },
      fn: async () =>
        loadTenants(filters, {
          database: fakeDatabase([
            [
              {
                id: "00000000-0000-0000-0000-000000000221",
                name: "Doggo",
                slug: "doggo",
                domain: "doggo.com.au",
                plan: "growth",
                status: "active",
                created_at: "2026-06-24T00:00:00.000Z",
                owner_email: "owner@example.com",
                last_conversation_at: null,
                conversation_count_30d: 0,
              },
            ],
          ]),
        }),
    },
    { store, getActor: async () => actor },
  );

  assert.equal(result.ok, true);
  assert.equal(store.rows.length, 2);
  assert.equal(new Set(store.rows.map((row) => row.correlation_id)).size, 1);
  assert.equal(store.rows[0].action, "tenant.view");
  assert.equal(store.rows[0].target_type, "tenants_list");
});

test("tenant detail render path audits one tenant.view operation", async () => {
  const store = createStore();
  const tenantId = "00000000-0000-0000-0000-000000000222";
  const result = await withAuditLog(
    {
      action: "tenant.view",
      target: { type: "tenant", id: tenantId },
      metadata: { tab: "profile" },
      fn: async () =>
        loadTenantDetail(tenantId, {
          database: fakeDatabase([
            [
              {
                id: tenantId,
                name: "AgPages",
                slug: "agpages",
                domain: null,
                plan: "scale",
                status: "active",
                settings: {},
                stripe_customer_id: null,
                created_at: "2026-06-24T00:00:00.000Z",
                suspended_at: null,
                suspended_reason: null,
                suspended_by_email: null,
                soft_deleted_at: null,
                soft_deleted_reason: null,
                soft_deleted_by_email: null,
              },
            ],
            [
              {
                id: "00000000-0000-0000-0000-000000000223",
                user_id: "00000000-0000-0000-0000-000000000224",
                email: "owner@example.com",
                role: "owner",
                created_at: "2026-06-24T00:00:00.000Z",
              },
            ],
            [],
          ]),
        }),
    },
    { store, getActor: async () => actor },
  );

  assert.equal(result.ok, true);
  assert.equal(store.rows.length, 2);
  assert.equal(store.rows[0].target_id, tenantId);
});

test("tenant detail invalid tenant returns not found rather than blank data", async () => {
  await assert.rejects(
    loadTenantDetail("00000000-0000-0000-0000-000000000225", {
      database: fakeDatabase([[]]),
    }),
  );
});
