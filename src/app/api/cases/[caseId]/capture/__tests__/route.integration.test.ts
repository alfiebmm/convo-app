import { test } from "node:test";
import assert from "node:assert/strict";

import {
  handleCaptureSubmit,
  hashIdentifierForAudit,
  type CaptureRouteDeps,
} from "../route";
import { getCaseById } from "@/lib/cases";
import { setCaseAttribute, getCaseAttributes } from "@/lib/cases/attributes";
import { recordCaseEvent } from "@/lib/cases/events";
import { createInMemoryCasesStore } from "@/lib/cases/__tests__/in-memory-store";
import {
  upsertContact,
  linkContactToConversation,
  updateContactDisplayName,
} from "@/lib/contacts";
import { createInMemoryContactsStore } from "@/lib/contacts/__tests__/in-memory-store";

const TENANT_ID = "a1111111-1111-4111-8111-111111111111";
const VISITOR_ID = "visitor-a";
const CONVERSATION_ID = "cccccccc-cccc-4ccc-accc-cccccccccccc";

function mockReq(body: unknown): { json: () => Promise<unknown> } {
  return { json: async () => body };
}

async function seedHarness() {
  const casesStore = createInMemoryCasesStore();
  const contactsStore = createInMemoryContactsStore();
  const kase = await casesStore.insertCase(TENANT_ID, {
    conversationId: CONVERSATION_ID,
    caseType: "lead",
    status: "open",
    source: "follow_up_classifier",
  });

  const deps: CaptureRouteDeps = {
    getTenantById: async (id) => (id === TENANT_ID ? { id } : null),
    getConversationForVisitor: async (conversationId, tenantId, visitorId) =>
      conversationId === CONVERSATION_ID &&
      tenantId === TENANT_ID &&
      visitorId === VISITOR_ID
        ? { id: CONVERSATION_ID, tenantId: TENANT_ID }
        : null,
    getCaseById: (tenantId, caseId) =>
      getCaseById(tenantId, caseId, { store: casesStore }),
    setCaseAttribute: (tenantId, input) =>
      setCaseAttribute(tenantId, input, { store: casesStore }),
    getCaseAttributes: (tenantId, caseId) =>
      getCaseAttributes(tenantId, caseId, { store: casesStore }),
    recordCaseEvent: (tenantId, input) =>
      recordCaseEvent(tenantId, input, { store: casesStore }),
    upsertContact: (tenantId, input) =>
      upsertContact(tenantId, input, { store: contactsStore }),
    linkContactToConversation: (tenantId, input) =>
      linkContactToConversation(tenantId, input, { store: contactsStore }),
    updateContactDisplayName: (tenantId, contactId, displayName) =>
      updateContactDisplayName(tenantId, contactId, displayName, {
        store: contactsStore,
      }),
    updateCaseContactId: async (tenantId, caseId, contactId) => {
      await casesStore.updateCase(tenantId, caseId, { contactId });
    },
  };

  return { casesStore, contactsStore, deps, kase };
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return JSON.parse(await res.text()) as Record<string, unknown>;
}

test("POST /api/cases/:caseId/capture integration submits an identifier-grade email, upserts a tenant-scoped contact, audits with a hash, and links the case", async () => {
  const { casesStore, contactsStore, deps, kase } = await seedHarness();

  const res = await handleCaptureSubmit(
    mockReq({
      tenantId: TENANT_ID,
      visitorId: VISITOR_ID,
      conversationId: CONVERSATION_ID,
      action: "submit",
      field: "email",
      value: "test@example.com",
    }),
    kase.id,
    deps,
  );

  assert.equal(res.status, 200);
  const body = await readJson(res);
  assert.equal(body.ok, true);
  assert.equal(body.action, "submit");
  assert.equal(body.field, "email");
  assert.equal(body.contact_created, true);

  const contactsDump = contactsStore._dump();
  assert.equal(contactsDump.contacts.length, 1);
  assert.equal(contactsDump.contacts[0].tenantId, TENANT_ID);
  assert.equal(contactsDump.contacts[0].emailNormalised, "test@example.com");

  const casesDump = casesStore._dump();
  assert.deepEqual(
    casesDump.events.map((event) => event.eventType),
    ["consent_granted", "capture_field_submitted"],
  );
  const submittedEvent = casesDump.events.find(
    (event) => event.eventType === "capture_field_submitted",
  );
  assert.ok(submittedEvent);
  assert.equal(submittedEvent.payload.field, "email");
  assert.equal(
    submittedEvent.payload.value_hash,
    hashIdentifierForAudit("test@example.com"),
  );
  assert.equal(submittedEvent.payload.contact_id, contactsDump.contacts[0].id);
  assert.equal(submittedEvent.payload.contact_created, true);
  assert.equal(
    JSON.stringify(submittedEvent.payload).includes("test@example.com"),
    false,
  );

  const updatedCase = casesDump.cases.find((row) => row.id === kase.id);
  assert.equal(updatedCase?.contactId, contactsDump.contacts[0].id);
});

test("POST /api/cases/:caseId/capture integration records a decline audit event without creating a contact or setting case.contactId", async () => {
  const { casesStore, contactsStore, deps, kase } = await seedHarness();

  const res = await handleCaptureSubmit(
    mockReq({
      tenantId: TENANT_ID,
      visitorId: VISITOR_ID,
      conversationId: CONVERSATION_ID,
      action: "decline",
    }),
    kase.id,
    deps,
  );

  assert.equal(res.status, 200);
  assert.deepEqual(await readJson(res), { ok: true, action: "decline" });

  assert.equal(contactsStore._dump().contacts.length, 0);

  const casesDump = casesStore._dump();
  assert.equal(casesDump.events.length, 1);
  assert.equal(casesDump.events[0].tenantId, TENANT_ID);
  assert.equal(casesDump.events[0].caseId, kase.id);
  assert.equal(casesDump.events[0].conversationId, CONVERSATION_ID);
  assert.equal(casesDump.events[0].actorType, "visitor");
  assert.equal(casesDump.events[0].actorId, VISITOR_ID);
  assert.equal(casesDump.events[0].eventType, "consent_declined");
  assert.deepEqual(casesDump.events[0].payload, {});
  assert.equal(casesDump.cases.find((row) => row.id === kase.id)?.contactId, null);
});
