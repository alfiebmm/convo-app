#!/usr/bin/env node

/**
 * `/api/cases/[caseId]/capture` route tests (CON-170, Epic D2b).
 *
 * Pure tsx-runnable (no test framework). Pattern matches
 * `src/app/api/conversations/case-events/__tests__/route.test.ts`.
 *
 * Coverage:
 *   - Input validation (missing fields, malformed body, bad action)
 *   - Tenant/conversation/case scope checks (404 chain)
 *   - Case must belong to the supplied conversation (non-enumerating)
 *   - Submit happy path: name → attribute, no contact created
 *   - Submit identifier path: email/mobile → contact upsert + link +
 *     case.contactId binding + audit event with hashed value
 *   - Skip writes audit event, no contact touched
 *   - Decline writes audit event, no contact touched
 *   - validateCaptureField unit cases (email/mobile/postcode/name)
 *   - hashIdentifierForAudit determinism
 *   - Cross-tenant case lookup → 404
 *
 * Run with:
 *   npx tsx src/app/api/cases/[caseId]/capture/__tests__/route.test.ts
 */

import { randomUUID } from "node:crypto";

import {
  handleCaptureSubmit,
  OPTIONS as CaptureOPTIONS,
  hashIdentifierForAudit,
  isIdentifierField,
  validateCaptureField,
  type CaptureRouteDeps,
} from "../route";

import type { CaseRow } from "@/lib/cases";
import type { ContactRow } from "@/lib/contacts";

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

function assertEq<T>(actual: T, expected: T, msg: string) {
  if (actual !== expected) {
    throw new Error(
      `${msg} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TENANT_A = "a1111111-1111-4111-8111-111111111111";
const TENANT_B = "b2222222-2222-4222-9222-222222222222";
const CONVO_A = "cccccccc-cccc-4ccc-accc-cccccccccccc";
const CONVO_B = "dddddddd-dddd-4ddd-bddd-dddddddddddd";
const CASE_A = "11111111-1111-4111-8111-111111111111";
const CASE_B = "22222222-2222-4222-9222-222222222222";
const UNKNOWN_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const VISITOR_A = "visitor-a";

function mockReq(body: unknown): { json: () => Promise<unknown> } {
  return { json: async () => body };
}

// Simulated stores — minimal, only the surface we exercise.

interface AttributeRecord {
  tenantId: string;
  caseId: string;
  key: string;
  value: unknown;
}

interface EventRecord {
  tenantId: string;
  caseId: string;
  conversationId: string;
  actorType: string;
  actorId: string | null | undefined;
  eventType: string;
  payload: Record<string, unknown>;
}

interface ContactRecord {
  id: string;
  tenantId: string;
  displayName?: string | null;
  emailNormalised?: string | null;
  phoneNormalised?: string | null;
  // CON-248: track attributes so we can assert persona enrichment
  // (contacts.attributes shallow-merge from the real store).
  attributes?: Record<string, unknown>;
}

interface LinkRecord {
  tenantId: string;
  conversationId: string;
  contactId: string;
  relationship: string;
}

interface FakeWorld {
  attributes: AttributeRecord[];
  events: EventRecord[];
  contacts: ContactRecord[];
  links: LinkRecord[];
  caseContactPatches: Array<{ tenantId: string; caseId: string; contactId: string }>;
  cases: CaseRow[];
}

function makeCaseRow(overrides: Partial<CaseRow>): CaseRow {
  const now = new Date();
  return {
    id: CASE_A,
    tenantId: TENANT_A,
    conversationId: CONVO_A,
    contactId: null,
    caseType: "lead",
    status: "open",
    priority: null,
    routingKey: null,
    title: null,
    summary: null,
    reason: null,
    source: "follow_up_classifier",
    ruleId: null,
    classifierConfidence: null,
    assignedTo: null,
    externalSystem: null,
    externalId: null,
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    ...overrides,
  };
}

function makeDeps(
  world: FakeWorld,
  overrides: Partial<CaptureRouteDeps> = {},
): CaptureRouteDeps {
  return {
    getTenantById: async (id: string) =>
      id === TENANT_A || id === TENANT_B ? { id } : null,
    getConversationForVisitor: async (id, tenantId, visitorId) => {
      if (visitorId !== VISITOR_A) return null;
      if (id === CONVO_A && tenantId === TENANT_A)
        return { id: CONVO_A, tenantId: TENANT_A };
      if (id === CONVO_B && tenantId === TENANT_A)
        return { id: CONVO_B, tenantId: TENANT_A };
      return null;
    },
    getCaseById: async (tenantId, caseId) => {
      const row = world.cases.find(
        (c) => c.tenantId === tenantId && c.id === caseId,
      );
      return row ? { ...row } : null;
    },
    setCaseAttribute: (async (tenantId, input) => {
      world.attributes.push({
        tenantId,
        caseId: input.caseId,
        key: input.key,
        value: input.value,
      });
      return {
        tenantId,
        caseId: input.caseId,
        key: input.key,
        value: input.value,
        source: input.source ?? null,
        confidence: input.confidence ?? null,
        detectedAt: new Date(),
      };
    }) as CaptureRouteDeps["setCaseAttribute"],
    getCaseAttributes: (async (tenantId, caseId) => {
      return world.attributes
        .filter((a) => a.tenantId === tenantId && a.caseId === caseId)
        .map((a) => ({
          tenantId: a.tenantId,
          caseId: a.caseId,
          key: a.key,
          value: a.value,
          source: null,
          confidence: null,
          detectedAt: new Date(),
        }));
    }) as CaptureRouteDeps["getCaseAttributes"],
    recordCaseEvent: (async (tenantId, input) => {
      world.events.push({
        tenantId,
        caseId: input.caseId,
        conversationId: input.conversationId,
        actorType: input.actorType,
        actorId: input.actorId,
        eventType: input.eventType,
        payload: (input.payload ?? {}) as Record<string, unknown>,
      });
      return {
        id: randomUUID(),
        caseId: input.caseId,
        conversationId: input.conversationId,
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        eventType: input.eventType,
        payload: (input.payload ?? {}) as Record<string, unknown>,
        createdAt: new Date(),
      };
    }) as CaptureRouteDeps["recordCaseEvent"],
    upsertContact: (async (tenantId, input) => {
      const existing = world.contacts.find(
        (c) =>
          c.tenantId === tenantId &&
          ((input.emailNormalised &&
            c.emailNormalised === input.emailNormalised) ||
            (input.phoneNormalised &&
              c.phoneNormalised === input.phoneNormalised)),
      );
      if (existing) {
        existing.displayName = existing.displayName ?? input.displayName ?? null;
        existing.emailNormalised =
          existing.emailNormalised ?? input.emailNormalised ?? null;
        existing.phoneNormalised =
          existing.phoneNormalised ?? input.phoneNormalised ?? null;
        existing.attributes = {
          ...(existing.attributes ?? {}),
          ...(input.attributes ?? {}),
        };
        return {
          contact: makeContactRow(existing),
          created: false,
        };
      }
      const created: ContactRecord = {
        id: randomUUID(),
        tenantId,
        displayName: input.displayName ?? null,
        emailNormalised: input.emailNormalised ?? null,
        phoneNormalised: input.phoneNormalised ?? null,
        attributes: input.attributes ?? {},
      };
      world.contacts.push(created);
      return {
        contact: makeContactRow(created),
        created: true,
      };
    }) as CaptureRouteDeps["upsertContact"],
    linkContactToConversation: (async (tenantId, input) => {
      world.links.push({
        tenantId,
        conversationId: input.conversationId,
        contactId: input.contactId,
        relationship: input.relationship,
      });
      return {
        tenantId,
        conversationId: input.conversationId,
        contactId: input.contactId,
        relationship: input.relationship,
        createdAt: new Date(),
      };
    }) as CaptureRouteDeps["linkContactToConversation"],
    updateContactDisplayName: (async (tenantId, contactId, displayName) => {
      const existing = world.contacts.find(
        (c) => c.tenantId === tenantId && c.id === contactId,
      );
      if (!existing) return null;
      existing.displayName = displayName;
      return makeContactRow(existing);
    }) as CaptureRouteDeps["updateContactDisplayName"],
    updateCaseContactId: async (tenantId, caseId, contactId) => {
      world.caseContactPatches.push({ tenantId, caseId, contactId });
      const idx = world.cases.findIndex(
        (c) => c.tenantId === tenantId && c.id === caseId,
      );
      if (idx !== -1) {
        world.cases[idx] = { ...world.cases[idx], contactId };
      }
    },
    ...overrides,
  };
}

function makeContactRow(rec: ContactRecord): ContactRow {
  const now = new Date();
  return {
    id: rec.id,
    tenantId: rec.tenantId,
    displayName: rec.displayName ?? null,
    emailNormalised: rec.emailNormalised ?? null,
    phoneNormalised: rec.phoneNormalised ?? null,
    preferredContactMethod: null,
    attributes: rec.attributes ?? {},
    consentState: null,
    privacyNoticeVersion: null,
    firstSeenAt: now,
    lastSeenAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

function makeWorld(extraCases: CaseRow[] = []): FakeWorld {
  return {
    attributes: [],
    events: [],
    contacts: [],
    links: [],
    caseContactPatches: [],
    cases: [makeCaseRow({}), ...extraCases],
  };
}

async function readJson(res: Response): Promise<{ [k: string]: unknown }> {
  return JSON.parse(await res.text());
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function runAll() {
  // ----- validateCaptureField (pure) -----

  await test("validateCaptureField: name accepts trimmed non-empty", () => {
    const r = validateCaptureField("name", "  Blake  ");
    assert(r.ok && r.normalised === "Blake", "expected Blake");
  });

  await test("validateCaptureField: empty rejects", () => {
    const r = validateCaptureField("name", "   ");
    assert(!r.ok, "should reject");
  });

  await test("validateCaptureField: email lowercases", () => {
    const r = validateCaptureField("email", "Blake@Example.COM");
    assert(r.ok && r.normalised === "blake@example.com", "lowercased");
  });

  await test("validateCaptureField: email rejects garbage", () => {
    const r = validateCaptureField("email", "not-an-email");
    assert(!r.ok, "should reject");
  });

  await test("validateCaptureField: mobile accepts AU format", () => {
    const r = validateCaptureField("mobile", "0400 123 456");
    assert(r.ok && r.normalised === "0400123456", "stripped");
  });

  await test("validateCaptureField: mobile preserves + prefix", () => {
    const r = validateCaptureField("mobile", "+61 400 123 456");
    assert(r.ok && r.normalised === "+61400123456", "kept plus");
  });

  await test("validateCaptureField: mobile rejects short", () => {
    const r = validateCaptureField("mobile", "12345");
    assert(!r.ok, "should reject");
  });

  await test("validateCaptureField: postcode accepts AU 4-digit", () => {
    const r = validateCaptureField("postcode", "2000");
    assert(r.ok && r.normalised === "2000", "ok");
  });

  await test("validateCaptureField: postcode rejects long garbage", () => {
    const r = validateCaptureField("postcode", "ABC-DE-12345678");
    assert(!r.ok, "should reject");
  });

  await test("validateCaptureField: custom field accepts as-is", () => {
    const r = validateCaptureField("abn", "12345");
    assert(r.ok && r.normalised === "12345", "ok");
  });

  await test("validateCaptureField: value too long rejected", () => {
    const big = "x".repeat(5000);
    const r = validateCaptureField("free_text_note", big);
    assert(!r.ok, "should reject");
  });

  // ----- hashIdentifierForAudit + isIdentifierField -----

  await test("hashIdentifierForAudit is deterministic", () => {
    assertEq(
      hashIdentifierForAudit("blake@example.com"),
      hashIdentifierForAudit("blake@example.com"),
      "stable hash",
    );
  });

  await test("hashIdentifierForAudit differs by value", () => {
    assert(
      hashIdentifierForAudit("a@x.com") !==
        hashIdentifierForAudit("b@x.com"),
      "different inputs differ",
    );
  });

  await test("isIdentifierField only for email/mobile", () => {
    assert(isIdentifierField("email"), "email is identifier");
    assert(isIdentifierField("mobile"), "mobile is identifier");
    assert(!isIdentifierField("name"), "name not identifier");
    assert(!isIdentifierField("postcode"), "postcode not identifier");
    assert(!isIdentifierField("free_text_note"), "note not identifier");
  });

  // ----- Input validation -----

  await test("missing tenantId → 400", async () => {
    const world = makeWorld();
    const res = await handleCaptureSubmit(
      mockReq({
        visitorId: VISITOR_A,
        conversationId: CONVO_A,
        action: "submit",
        field: "name",
        value: "Blake",
      }),
      CASE_A,
      makeDeps(world),
    );
    assertEq(res.status, 400, "status");
  });

  await test("malformed JSON → 400", async () => {
    const world = makeWorld();
    const res = await handleCaptureSubmit(
      { json: async () => { throw new Error("nope"); } },
      CASE_A,
      makeDeps(world),
    );
    assertEq(res.status, 400, "status");
  });

  await test("non-uuid caseId → 400", async () => {
    const world = makeWorld();
    const res = await handleCaptureSubmit(
      mockReq({
        tenantId: TENANT_A,
        visitorId: VISITOR_A,
        conversationId: CONVO_A,
        action: "decline",
      }),
      "not-a-uuid",
      makeDeps(world),
    );
    assertEq(res.status, 400, "status");
  });

  await test("unknown action → 400", async () => {
    const world = makeWorld();
    const res = await handleCaptureSubmit(
      mockReq({
        tenantId: TENANT_A,
        visitorId: VISITOR_A,
        conversationId: CONVO_A,
        action: "explode",
      }),
      CASE_A,
      makeDeps(world),
    );
    assertEq(res.status, 400, "status");
  });

  await test("submit without field → 400", async () => {
    const world = makeWorld();
    const res = await handleCaptureSubmit(
      mockReq({
        tenantId: TENANT_A,
        visitorId: VISITOR_A,
        conversationId: CONVO_A,
        action: "submit",
        value: "Blake",
      }),
      CASE_A,
      makeDeps(world),
    );
    assertEq(res.status, 400, "status");
  });

  await test("submit with invalid email → 400", async () => {
    const world = makeWorld();
    const res = await handleCaptureSubmit(
      mockReq({
        tenantId: TENANT_A,
        visitorId: VISITOR_A,
        conversationId: CONVO_A,
        action: "submit",
        field: "email",
        value: "not-an-email",
      }),
      CASE_A,
      makeDeps(world),
    );
    assertEq(res.status, 400, "status");
  });

  // ----- Scope checks -----

  await test("unknown tenant → 404", async () => {
    const world = makeWorld();
    const res = await handleCaptureSubmit(
      mockReq({
        tenantId: UNKNOWN_ID,
        visitorId: VISITOR_A,
        conversationId: CONVO_A,
        action: "decline",
      }),
      CASE_A,
      makeDeps(world),
    );
    assertEq(res.status, 404, "status");
  });

  await test("cross-tenant conversation lookup → 404", async () => {
    const world = makeWorld();
    const res = await handleCaptureSubmit(
      mockReq({
        tenantId: TENANT_B,
        visitorId: VISITOR_A,
        conversationId: CONVO_A,
        action: "decline",
      }),
      CASE_A,
      makeDeps(world),
    );
    assertEq(res.status, 404, "status");
  });

  await test("case belongs to different conversation → 404", async () => {
    // Case exists in tenant A but is bound to CONVO_B; visitor claims
    // they're updating it via CONVO_A. Must 404 — not enumerate.
    const world = makeWorld([
      makeCaseRow({
        id: CASE_B,
        conversationId: CONVO_B,
      }),
    ]);
    const res = await handleCaptureSubmit(
      mockReq({
        tenantId: TENANT_A,
        visitorId: VISITOR_A,
        conversationId: CONVO_A,
        action: "decline",
      }),
      CASE_B,
      makeDeps(world),
    );
    assertEq(res.status, 404, "status");
  });

  await test("unknown case → 404", async () => {
    const world = makeWorld();
    const res = await handleCaptureSubmit(
      mockReq({
        tenantId: TENANT_A,
        visitorId: VISITOR_A,
        conversationId: CONVO_A,
        action: "decline",
      }),
      UNKNOWN_ID,
      makeDeps(world),
    );
    assertEq(res.status, 404, "status");
  });

  // ----- Happy paths -----

  await test("submit name → attribute only, no contact", async () => {
    const world = makeWorld();
    const res = await handleCaptureSubmit(
      mockReq({
        tenantId: TENANT_A,
        visitorId: VISITOR_A,
        conversationId: CONVO_A,
        action: "submit",
        field: "name",
        value: "Blake",
      }),
      CASE_A,
      makeDeps(world),
    );
    assertEq(res.status, 200, "status");
    assertEq(world.attributes.length, 1, "one attribute");
    assertEq(world.attributes[0].key, "name", "name key");
    assertEq(world.contacts.length, 0, "no contact upsert");
    assertEq(world.links.length, 0, "no link");
    assertEq(world.caseContactPatches.length, 0, "no case patch");
    assertEq(world.events.length, 2, "two audit events");
    assertEq(world.events[0].eventType, "consent_granted", "consent type");
    assertEq(world.events[1].eventType, "capture_field_submitted", "field type");
    // No identifier hash for non-identifier fields.
    assertEq(
      world.events[1].payload.value_hash,
      undefined,
      "no value_hash for name",
    );
  });

  await test(
    "submit email → contact upsert + link + case.contactId binding + hashed audit",
    async () => {
      const world = makeWorld();
      const res = await handleCaptureSubmit(
        mockReq({
          tenantId: TENANT_A,
          visitorId: VISITOR_A,
          conversationId: CONVO_A,
          action: "submit",
          field: "email",
          value: "Blake@Example.com",
        }),
        CASE_A,
        makeDeps(world),
      );
      assertEq(res.status, 200, "status");
      const body = await readJson(res);
      assertEq(body.action, "submit", "action echoed");
      assertEq(body.field, "email", "field echoed");
      assertEq(typeof body.contact_id, "string", "contact_id returned");

      assertEq(world.contacts.length, 1, "contact created");
      assertEq(
        world.contacts[0].emailNormalised,
        "blake@example.com",
        "lowercased",
      );
      assertEq(world.links.length, 1, "linked");
      assertEq(world.links[0].relationship, "primary_contact", "rel");
      assertEq(world.caseContactPatches.length, 1, "case.contactId set");
      assertEq(world.events.length, 2, "audit events");
      assertEq(world.events[0].eventType, "consent_granted", "consent type");
      assertEq(world.events[1].eventType, "capture_field_submitted", "field type");
      assert(
        typeof world.events[1].payload.value_hash === "string" &&
          (world.events[1].payload.value_hash as string).length === 12,
        "12-char hash",
      );
      // Raw value MUST NOT appear in audit payload.
      const json = JSON.stringify(world.events[1].payload);
      assert(
        !json.toLowerCase().includes("blake@example.com"),
        "raw email NOT in audit payload",
      );
    },
  );

  await test(
    "CON-269: submit email then name → same contact display_name updated",
    async () => {
      const world = makeWorld();
      const deps = makeDeps(world);

      const emailRes = await handleCaptureSubmit(
        mockReq({
          tenantId: TENANT_A,
          visitorId: VISITOR_A,
          conversationId: CONVO_A,
          action: "submit",
          field: "email",
          value: "Blake@Example.com",
        }),
        CASE_A,
        deps,
      );
      assertEq(emailRes.status, 200, "email status");
      assertEq(world.contacts.length, 1, "contact created from email");
      const contactId = world.contacts[0].id;
      assertEq(world.cases[0].contactId, contactId, "case linked to contact");

      const nameRes = await handleCaptureSubmit(
        mockReq({
          tenantId: TENANT_A,
          visitorId: VISITOR_A,
          conversationId: CONVO_A,
          action: "submit",
          field: "name",
          value: "  Blake Smith  ",
        }),
        CASE_A,
        deps,
      );
      const body = await readJson(nameRes);
      assertEq(nameRes.status, 200, "name status");
      assertEq(world.contacts.length, 1, "no second contact");
      assertEq(world.contacts[0].id, contactId, "same contact");
      assertEq(world.contacts[0].displayName, "Blake Smith", "display_name set");
      assertEq(world.attributes.length, 2, "email and name attributes written");
      assertEq(world.attributes[1].key, "name", "name attribute key");
      assertEq(
        (world.attributes[1].value as { value: string }).value,
        "Blake Smith",
        "name attribute normalised",
      );
      assertEq(body.contact_id, contactId, "response returns updated contact id");
    },
  );

  await test(
    "CON-269: submit name only → no contact created and name attribute remains",
    async () => {
      const world = makeWorld();
      const res = await handleCaptureSubmit(
        mockReq({
          tenantId: TENANT_A,
          visitorId: VISITOR_A,
          conversationId: CONVO_A,
          action: "submit",
          field: "name",
          value: "  Blake  ",
        }),
        CASE_A,
        makeDeps(world),
      );
      assertEq(res.status, 200, "status");
      assertEq(world.contacts.length, 0, "no naked contact");
      assertEq(world.caseContactPatches.length, 0, "case not linked");
      assertEq(world.attributes.length, 1, "name attribute written");
      assertEq(world.attributes[0].key, "name", "name key");
      assertEq(
        (world.attributes[0].value as { value: string }).value,
        "Blake",
        "name attribute normalised",
      );
    },
  );

  await test(
    "CON-269 regression: submit email then mobile still upserts and audits identifiers",
    async () => {
      const world = makeWorld();
      const deps = makeDeps(world);

      await handleCaptureSubmit(
        mockReq({
          tenantId: TENANT_A,
          visitorId: VISITOR_A,
          conversationId: CONVO_A,
          action: "submit",
          field: "email",
          value: "blake@example.com",
        }),
        CASE_A,
        deps,
      );
      const emailContactId = world.contacts[0].id;

      const mobileRes = await handleCaptureSubmit(
        mockReq({
          tenantId: TENANT_A,
          visitorId: VISITOR_A,
          conversationId: CONVO_A,
          action: "submit",
          field: "mobile",
          value: "0400 123 456",
        }),
        CASE_A,
        deps,
      );

      assertEq(mobileRes.status, 200, "mobile status");
      assertEq(world.contacts.length, 2, "mobile contact upsert still runs");
      assertEq(world.contacts[1].phoneNormalised, "0400123456", "phone stored");
      assertEq(
        world.cases[0].contactId,
        emailContactId,
        "existing case contact not overwritten",
      );
      assertEq(world.links.length, 2, "both identifier submits link contacts");
      assert(
        typeof world.events[3].payload.value_hash === "string",
        "mobile audit has hash",
      );
    },
  );

  await test("submit mobile twice → second is no-op for contact (upsert)", async () => {
    const world = makeWorld();
    const deps = makeDeps(world);
    await handleCaptureSubmit(
      mockReq({
        tenantId: TENANT_A,
        visitorId: VISITOR_A,
        conversationId: CONVO_A,
        action: "submit",
        field: "mobile",
        value: "0400123456",
      }),
      CASE_A,
      deps,
    );
    await handleCaptureSubmit(
      mockReq({
        tenantId: TENANT_A,
        visitorId: VISITOR_A,
        conversationId: CONVO_A,
        action: "submit",
        field: "mobile",
        value: "0400123456",
      }),
      CASE_A,
      deps,
    );
    assertEq(world.contacts.length, 1, "no duplicate contact");
    assertEq(world.events.length, 4, "four audit events");
  });

  // -------------------------------------------------------------------------
  // CON-248 — persona enrichment on contact upsert
  // -------------------------------------------------------------------------

  await test(
    "CON-248: submit email with existing persona attribute enriches contact.attributes.persona",
    async () => {
      const world = makeWorld();
      // Simulate the chat route having written the persona attribute at
      // case-creation time (CON-248 step 3).
      world.attributes.push({
        tenantId: TENANT_A,
        caseId: CASE_A,
        key: "persona",
        value: "farmer",
      });

      const res = await handleCaptureSubmit(
        mockReq({
          tenantId: TENANT_A,
          visitorId: VISITOR_A,
          conversationId: CONVO_A,
          action: "submit",
          field: "email",
          value: "farmer@example.com",
        }),
        CASE_A,
        makeDeps(world),
      );
      assertEq(res.status, 200, "status");
      assertEq(world.contacts.length, 1, "contact created");
      const contactAttrs = world.contacts[0].attributes ?? {};
      assertEq(
        contactAttrs.persona as string,
        "farmer",
        "contact enriched with persona from case attributes",
      );
    },
  );

  await test(
    "CON-248: submit email with no persona attribute skips enrichment",
    async () => {
      const world = makeWorld();
      // world.attributes intentionally empty — no chat-route persona write.

      const res = await handleCaptureSubmit(
        mockReq({
          tenantId: TENANT_A,
          visitorId: VISITOR_A,
          conversationId: CONVO_A,
          action: "submit",
          field: "email",
          value: "blake@example.com",
        }),
        CASE_A,
        makeDeps(world),
      );
      assertEq(res.status, 200, "status");
      assertEq(world.contacts.length, 1, "contact created");
      const contactAttrs = world.contacts[0].attributes ?? {};
      assertEq(
        contactAttrs.persona,
        undefined,
        "no persona key when no case attribute exists",
      );
    },
  );

  await test(
    "CON-248: submit mobile with persona attribute enriches contact",
    async () => {
      const world = makeWorld();
      world.attributes.push({
        tenantId: TENANT_A,
        caseId: CASE_A,
        key: "persona",
        value: "contractor",
      });

      await handleCaptureSubmit(
        mockReq({
          tenantId: TENANT_A,
          visitorId: VISITOR_A,
          conversationId: CONVO_A,
          action: "submit",
          field: "mobile",
          value: "0400123456",
        }),
        CASE_A,
        makeDeps(world),
      );
      assertEq(world.contacts.length, 1, "contact created");
      const contactAttrs = world.contacts[0].attributes ?? {};
      assertEq(
        contactAttrs.persona as string,
        "contractor",
        "mobile-path also enriches persona",
      );
    },
  );

  await test(
    "CON-248: submit name (non-identifier) does NOT trigger persona enrichment (no contact row)",
    async () => {
      const world = makeWorld();
      world.attributes.push({
        tenantId: TENANT_A,
        caseId: CASE_A,
        key: "persona",
        value: "farmer",
      });

      const res = await handleCaptureSubmit(
        mockReq({
          tenantId: TENANT_A,
          visitorId: VISITOR_A,
          conversationId: CONVO_A,
          action: "submit",
          field: "name",
          value: "Blake",
        }),
        CASE_A,
        makeDeps(world),
      );
      assertEq(res.status, 200, "status");
      // Name is not an identifier field — no contact upsert at all.
      assertEq(world.contacts.length, 0, "no contact for name-only capture");
    },
  );

  await test("skip writes audit only", async () => {
    const world = makeWorld();
    const res = await handleCaptureSubmit(
      mockReq({
        tenantId: TENANT_A,
        visitorId: VISITOR_A,
        conversationId: CONVO_A,
        action: "skip",
        field: "postcode",
      }),
      CASE_A,
      makeDeps(world),
    );
    assertEq(res.status, 200, "status");
    assertEq(world.attributes.length, 0, "no attribute");
    assertEq(world.contacts.length, 0, "no contact");
    assertEq(world.events.length, 1, "one event");
    assertEq(world.events[0].eventType, "capture_field_skipped", "type");
    assertEq(world.events[0].payload.field, "postcode", "field in payload");
  });

  await test("privacy_notice_shown writes audit only", async () => {
    const world = makeWorld();
    const res = await handleCaptureSubmit(
      mockReq({
        tenantId: TENANT_A,
        visitorId: VISITOR_A,
        conversationId: CONVO_A,
        action: "privacy_notice_shown",
      }),
      CASE_A,
      makeDeps(world),
    );
    assertEq(res.status, 200, "status");
    assertEq(world.attributes.length, 0, "no attribute");
    assertEq(world.contacts.length, 0, "no contact");
    assertEq(world.events.length, 1, "one event");
    assertEq(world.events[0].eventType, "privacy_notice_shown", "type");
  });

  await test("decline writes audit only, no contact, locked invariant", async () => {
    const world = makeWorld();
    const res = await handleCaptureSubmit(
      mockReq({
        tenantId: TENANT_A,
        visitorId: VISITOR_A,
        conversationId: CONVO_A,
        action: "decline",
      }),
      CASE_A,
      makeDeps(world),
    );
    assertEq(res.status, 200, "status");
    assertEq(world.attributes.length, 0, "no attribute");
    assertEq(world.contacts.length, 0, "no contact");
    assertEq(world.links.length, 0, "no link");
    assertEq(world.caseContactPatches.length, 0, "no case patch");
    // Locked invariant: case row already existed (from D2a), and we did
    // not create a contact. The case persists for staff review.
    assertEq(world.cases[0].contactId, null, "case.contactId stays null");
    assertEq(world.events.length, 1, "one event");
    assertEq(world.events[0].eventType, "consent_declined", "type");
  });

  // ----- Boundary -----

  // CON-246: cross-origin CORS preflight support. Widget is served from
  // convoapp.com.au and embeds on tenant domains; without CORS the
  // browser blocks the POST and the widget surfaces "couldn't save".
  await test("OPTIONS preflight returns 204 with wildcard CORS headers (CON-246)", async () => {
    const res = CaptureOPTIONS();
    assertEq(res.status, 204, "status");
    assertEq(
      res.headers.get("Access-Control-Allow-Origin"),
      "*",
      "Access-Control-Allow-Origin",
    );
    const methods = res.headers.get("Access-Control-Allow-Methods") ?? "";
    assert(methods.includes("POST"), "methods includes POST");
    assert(methods.includes("OPTIONS"), "methods includes OPTIONS");
    assertEq(
      res.headers.get("Access-Control-Allow-Headers"),
      "Content-Type",
      "Access-Control-Allow-Headers",
    );
  });

  await test("POST response carries CORS headers so the browser accepts it (CON-246)", async () => {
    const world = makeWorld();
    const res = await handleCaptureSubmit(
      mockReq({
        tenantId: TENANT_A,
        visitorId: VISITOR_A,
        conversationId: CONVO_A,
        action: "privacy_notice_shown",
      }),
      CASE_A,
      makeDeps(world),
    );
    assertEq(res.status, 200, "status");
    assertEq(
      res.headers.get("Access-Control-Allow-Origin"),
      "*",
      "POST response has ACAO wildcard",
    );
  });

  await test("existing case.contactId is NOT overwritten on second submit", async () => {
    const world = makeWorld();
    world.cases[0] = {
      ...world.cases[0],
      contactId: "pre-existing-contact-id",
    };
    await handleCaptureSubmit(
      mockReq({
        tenantId: TENANT_A,
        visitorId: VISITOR_A,
        conversationId: CONVO_A,
        action: "submit",
        field: "email",
        value: "blake@example.com",
      }),
      CASE_A,
      makeDeps(world),
    );
    // No patch should fire because case.contactId was already set.
    assertEq(world.caseContactPatches.length, 0, "no overwrite");
  });

  // ----- Summary -----
  console.log("");
  if (failed === 0) {
    console.log(`✅ All ${passed} tests passed.`);
    process.exit(0);
  } else {
    console.log(`❌ ${failed}/${passed + failed} tests failed.`);
    for (const f of failures) console.log(`   - ${f}`);
    process.exit(1);
  }
}

void runAll();
