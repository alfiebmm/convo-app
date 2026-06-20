#!/usr/bin/env node

/**
 * Tenant-scoped contact helper tests (CON-164, Epic B5).
 *
 * Pure tsx-runnable. Database access is faked via `InMemoryContactsStore`.
 *
 * Coverage per public helper:
 *   1. Happy path
 *   2. Cross-tenant denial
 *   3. tenantId validation
 *
 * Run with:  npx tsx src/lib/contacts/__tests__/contacts.test.ts
 */

import {
  getContactById,
  linkContactToConversation,
  listContactsByTenant,
  normaliseEmail,
  normalisePhone,
  upsertContact,
} from "../index";
import { createInMemoryContactsStore } from "./in-memory-store";

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const failures: string[] = [];

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`❌ ${name}`);
    console.log(`   Error: ${message}`);
    failed++;
    failures.push(`${name}: ${message}`);
  }
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function assertEq<T>(actual: T, expected: T, msg: string) {
  if (actual !== expected) {
    throw new Error(
      `${msg} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

async function assertThrows(
  fn: () => Promise<unknown>,
  expectedSubstring: string,
  msg: string,
) {
  let threw = false;
  let errMsg = "";
  try {
    await fn();
  } catch (e) {
    threw = true;
    errMsg = e instanceof Error ? e.message : String(e);
  }
  assert(threw, `${msg} — expected throw, got success`);
  assert(
    errMsg.includes(expectedSubstring),
    `${msg} — expected error to include "${expectedSubstring}", got "${errMsg}"`,
  );
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TENANT_A = "a1111111-1111-4111-8111-111111111111";
const TENANT_B = "b2222222-2222-4222-9222-222222222222";
const CONVO_A = "cccccccc-cccc-4ccc-accc-cccccccccccc";
const CONVO_B = "dddddddd-dddd-4ddd-addd-dddddddddddd";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function runAllTests() {
  // -------------------------------------------------------------------------
  // normaliseEmail / normalisePhone (pure utility coverage)
  // -------------------------------------------------------------------------

  await test("normaliseEmail: trims + lowercases, returns null on empty", () => {
    assertEq(normaliseEmail("  Foo@Bar.COM  "), "foo@bar.com", "trim + lower");
    assertEq(normaliseEmail(""), null, "empty string -> null");
    assertEq(normaliseEmail("   "), null, "whitespace -> null");
    assertEq(normaliseEmail(null), null, "null -> null");
    assertEq(normaliseEmail(undefined), null, "undefined -> null");
  });

  await test("normalisePhone: trims only (no E.164 parsing)", () => {
    assertEq(normalisePhone("  +61 4 1234 5678  "), "+61 4 1234 5678", "trims");
    assertEq(normalisePhone(""), null, "empty -> null");
    assertEq(normalisePhone(null), null, "null -> null");
  });

  // -------------------------------------------------------------------------
  // upsertContact
  // -------------------------------------------------------------------------

  await test("upsertContact: happy path inserts when email is new", async () => {
    const store = createInMemoryContactsStore();
    const { contact, created } = await upsertContact(
      TENANT_A,
      { emailNormalised: "alice@example.com", displayName: "Alice" },
      { store },
    );
    assert(created, "newly created");
    assertEq(contact.tenantId, TENANT_A, "tenantId stamped");
    assertEq(contact.emailNormalised, "alice@example.com", "email stored");
    assertEq(contact.displayName, "Alice", "name stored");
    assertEq(store._dump().contacts.length, 1, "one row written");
  });

  await test("upsertContact: idempotent — same email in same tenant updates the row", async () => {
    const store = createInMemoryContactsStore();
    const first = await upsertContact(
      TENANT_A,
      { emailNormalised: "bob@example.com" },
      { store },
    );
    const second = await upsertContact(
      TENANT_A,
      {
        emailNormalised: "bob@example.com",
        displayName: "Bob",
        phoneNormalised: "+61400000000",
      },
      { store },
    );
    assert(!second.created, "second call was an update");
    assertEq(second.contact.id, first.contact.id, "same row");
    assertEq(second.contact.displayName, "Bob", "name backfilled");
    assertEq(
      second.contact.phoneNormalised,
      "+61400000000",
      "phone backfilled",
    );
    assertEq(store._dump().contacts.length, 1, "still one row");
  });

  await test("upsertContact: cross-tenant — same email under TENANT_A and TENANT_B yields TWO rows", async () => {
    const store = createInMemoryContactsStore();
    const a = await upsertContact(
      TENANT_A,
      { emailNormalised: "shared@example.com" },
      { store },
    );
    const b = await upsertContact(
      TENANT_B,
      { emailNormalised: "shared@example.com" },
      { store },
    );
    assert(a.created, "A created");
    assert(b.created, "B created (NOT a hit on A's row)");
    assert(a.contact.id !== b.contact.id, "distinct ids");
    assertEq(a.contact.tenantId, TENANT_A, "A scoped to A");
    assertEq(b.contact.tenantId, TENANT_B, "B scoped to B");
    assertEq(store._dump().contacts.length, 2, "two distinct rows");
  });

  await test("upsertContact: rejects payload with no email/phone/name", async () => {
    const store = createInMemoryContactsStore();
    await assertThrows(
      () => upsertContact(TENANT_A, {}, { store }),
      "at least one of",
      "anonymous payload rejected",
    );
  });

  await test("upsertContact: rejects bad tenantId", async () => {
    const store = createInMemoryContactsStore();
    await assertThrows(
      () => upsertContact("bad", { emailNormalised: "x@y.com" }, { store }),
      "tenantId must be a UUID",
      "bad tenantId",
    );
    await assertThrows(
      () => upsertContact("", { emailNormalised: "x@y.com" }, { store }),
      "tenantId is required",
      "empty tenantId",
    );
  });

  // -------------------------------------------------------------------------
  // getContactById
  // -------------------------------------------------------------------------

  await test("getContactById: happy path returns the row for the owning tenant", async () => {
    const store = createInMemoryContactsStore();
    const { contact } = await upsertContact(
      TENANT_A,
      { emailNormalised: "carol@example.com" },
      { store },
    );
    const fetched = await getContactById(TENANT_A, contact.id, { store });
    assert(fetched !== null, "found");
    assertEq(fetched!.id, contact.id, "same row");
  });

  await test("getContactById: cross-tenant denial — tenant B sees null", async () => {
    const store = createInMemoryContactsStore();
    const { contact } = await upsertContact(
      TENANT_A,
      { emailNormalised: "dave@example.com" },
      { store },
    );
    const fetched = await getContactById(TENANT_B, contact.id, { store });
    assertEq(fetched, null, "tenant B sees null");
  });

  await test("getContactById: rejects bad contactId", async () => {
    const store = createInMemoryContactsStore();
    await assertThrows(
      () => getContactById(TENANT_A, "nope", { store }),
      "contactId must be a UUID",
      "garbage contactId",
    );
  });

  // -------------------------------------------------------------------------
  // listContactsByTenant
  // -------------------------------------------------------------------------

  await test("listContactsByTenant: tenant isolation — tenant A never sees tenant B contacts", async () => {
    const store = createInMemoryContactsStore();
    await upsertContact(
      TENANT_A,
      { emailNormalised: "alice@example.com", displayName: "Alice" },
      { store },
    );
    await upsertContact(
      TENANT_B,
      { emailNormalised: "betty@example.com", displayName: "Betty" },
      { store },
    );

    const result = await listContactsByTenant(TENANT_A, {}, { store });
    assertEq(result.totalCount, 1, "one tenant A row");
    assertEq(result.rows.length, 1, "one visible row");
    assertEq(result.rows[0].displayName, "Alice", "tenant B row hidden");
  });

  await test("listContactsByTenant: q search returns only matching rows", async () => {
    const store = createInMemoryContactsStore();
    await upsertContact(
      TENANT_A,
      {
        emailNormalised: "alice@example.com",
        displayName: "Alice Smith",
        attributes: { company: "Acre Homes", location: "Sydney" },
      },
      { store },
    );
    await upsertContact(
      TENANT_A,
      {
        emailNormalised: "charlie@example.com",
        displayName: "Charlie Jones",
        attributes: { company: "Harbour Repairs", location: "Melbourne" },
      },
      { store },
    );

    const result = await listContactsByTenant(
      TENANT_A,
      { q: "alice" },
      { store },
    );
    assertEq(result.totalCount, 1, "one matching row");
    assertEq(
      result.rows[0].emailNormalised,
      "alice@example.com",
      "Alice match",
    );
  });

  await test("listContactsByTenant: filters and sorts by contact attributes and latest open case", async () => {
    const store = createInMemoryContactsStore();
    const buyer = await upsertContact(
      TENANT_A,
      {
        emailNormalised: "buyer@example.com",
        displayName: "Buyer Contact",
        attributes: {
          persona: "buyer",
          marketplace_side: "demand",
          service_or_product: "consulting",
        },
      },
      { store },
    );
    const supplier = await upsertContact(
      TENANT_A,
      {
        emailNormalised: "supplier@example.com",
        displayName: "Supplier Contact",
        attributes: {
          persona: "supplier",
          marketplace_side: "supply",
          product: "directory listing",
        },
      },
      { store },
    );
    store._setContactLastSeenAt(
      buyer.contact.id,
      new Date("2026-06-20T00:00:00.000Z"),
    );
    store._setContactLastSeenAt(
      supplier.contact.id,
      new Date("2026-06-19T00:00:00.000Z"),
    );
    store._addOpenCase({
      tenantId: TENANT_A,
      contactId: buyer.contact.id,
      caseType: "lead",
      status: "open",
    });
    store._addOpenCase({
      tenantId: TENANT_A,
      contactId: supplier.contact.id,
      caseType: "cx_support",
      status: "waiting_on_customer",
    });

    const result = await listContactsByTenant(
      TENANT_A,
      {
        persona: "buyer",
        mktSide: "demand",
        caseType: "lead",
        caseStatus: "open",
        sort: "last-seen-desc",
      },
      { store },
    );

    assertEq(result.totalCount, 1, "one filtered row");
    assertEq(result.rows[0].displayName, "Buyer Contact", "buyer returned");
    assertEq(result.rows[0].serviceOrProduct, "consulting", "service sourced");
    assertEq(result.rows[0].relatedCaseType, "lead", "case type joined");
    assertEq(result.rows[0].openCaseStatus, "open", "case status joined");
  });

  // -------------------------------------------------------------------------
  // linkContactToConversation
  // -------------------------------------------------------------------------

  await test("linkContactToConversation: happy path creates a link", async () => {
    const store = createInMemoryContactsStore();
    const { contact } = await upsertContact(
      TENANT_A,
      { emailNormalised: "eve@example.com" },
      { store },
    );
    const link = await linkContactToConversation(
      TENANT_A,
      {
        conversationId: CONVO_A,
        contactId: contact.id,
        relationship: "primary",
      },
      { store },
    );
    assertEq(link.tenantId, TENANT_A, "tenantId stamped");
    assertEq(link.conversationId, CONVO_A, "convo stamped");
    assertEq(link.contactId, contact.id, "contact stamped");
    assertEq(link.relationship, "primary", "relationship stored");
    assertEq(store._dump().links.length, 1, "one link written");
  });

  await test("linkContactToConversation: idempotent on (convo, contact) — relationship updates", async () => {
    const store = createInMemoryContactsStore();
    const { contact } = await upsertContact(
      TENANT_A,
      { emailNormalised: "frank@example.com" },
      { store },
    );
    await linkContactToConversation(
      TENANT_A,
      {
        conversationId: CONVO_A,
        contactId: contact.id,
        relationship: "primary",
      },
      { store },
    );
    const second = await linkContactToConversation(
      TENANT_A,
      { conversationId: CONVO_A, contactId: contact.id, relationship: "cc" },
      { store },
    );
    assertEq(second.relationship, "cc", "relationship overwritten");
    assertEq(store._dump().links.length, 1, "still one link");
  });

  await test("linkContactToConversation: cross-tenant write tagged to writer's tenant (no leak)", async () => {
    const store = createInMemoryContactsStore();
    const { contact } = await upsertContact(
      TENANT_A,
      { emailNormalised: "grace@example.com" },
      { store },
    );
    // Tenant B tries to link tenant A's contact id to a convo of its own.
    // The link is stamped with tenant B; querying tenant A's links will
    // not return it. (Verified via the in-memory _dump — production WHERE
    // includes tenant_id on the upsert ON CONFLICT clause.)
    await linkContactToConversation(
      TENANT_B,
      {
        conversationId: CONVO_B,
        contactId: contact.id,
        relationship: "primary",
      },
      { store },
    );
    const links = store._dump().links;
    assertEq(links.length, 1, "one link recorded");
    assertEq(links[0].tenantId, TENANT_B, "tagged with writer's tenant");
  });

  await test("linkContactToConversation: rejects empty relationship", async () => {
    const store = createInMemoryContactsStore();
    await assertThrows(
      () =>
        linkContactToConversation(
          TENANT_A,
          {
            conversationId: CONVO_A,
            contactId: "11111111-1111-4111-8111-111111111111",
            relationship: "",
          },
          { store },
        ),
      "relationship is required",
      "empty relationship",
    );
  });

  await test("linkContactToConversation: rejects bad tenantId / non-UUID args", async () => {
    const store = createInMemoryContactsStore();
    await assertThrows(
      () =>
        linkContactToConversation(
          "",
          {
            conversationId: CONVO_A,
            contactId: "11111111-1111-4111-8111-111111111111",
            relationship: "primary",
          },
          { store },
        ),
      "tenantId is required",
      "empty tenantId",
    );
    await assertThrows(
      () =>
        linkContactToConversation(
          TENANT_A,
          {
            conversationId: "nope",
            contactId: "11111111-1111-4111-8111-111111111111",
            relationship: "primary",
          },
          { store },
        ),
      "conversationId must be a UUID",
      "garbage conversationId",
    );
    await assertThrows(
      () =>
        linkContactToConversation(
          TENANT_A,
          {
            conversationId: CONVO_A,
            contactId: "nope",
            relationship: "primary",
          },
          { store },
        ),
      "contactId must be a UUID",
      "garbage contactId",
    );
  });
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

runAllTests().then(() => {
  console.log("");
  console.log("=".repeat(60));
  console.log(`Tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("");
    console.log("Failures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
});
