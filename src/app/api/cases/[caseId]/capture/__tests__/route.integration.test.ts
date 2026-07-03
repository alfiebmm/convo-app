import { describe, expect, it } from "vitest";

import {
  handleCaptureSubmit,
  hashIdentifierForAudit,
  type CaptureRouteDeps,
} from "../route";
import { getCaseById } from "@/lib/cases";
import { setCaseAttribute } from "@/lib/cases/attributes";
import { recordCaseEvent } from "@/lib/cases/events";
import { createInMemoryCasesStore } from "@/lib/cases/__tests__/in-memory-store";
import { upsertContact, linkContactToConversation } from "@/lib/contacts";
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
    recordCaseEvent: (tenantId, input) =>
      recordCaseEvent(tenantId, input, { store: casesStore }),
    upsertContact: (tenantId, input) =>
      upsertContact(tenantId, input, { store: contactsStore }),
    linkContactToConversation: (tenantId, input) =>
      linkContactToConversation(tenantId, input, { store: contactsStore }),
    updateCaseContactId: async (tenantId, caseId, contactId) => {
      await casesStore.updateCase(tenantId, caseId, { contactId });
    },
  };

  return { casesStore, contactsStore, deps, kase };
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return JSON.parse(await res.text()) as Record<string, unknown>;
}

describe("POST /api/cases/:caseId/capture integration", () => {
  it("submits an identifier-grade email, upserts a tenant-scoped contact, audits with a hash, and links the case", async () => {
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

    expect(res.status).toBe(200);
    expect(await readJson(res)).toMatchObject({
      ok: true,
      action: "submit",
      field: "email",
      contact_created: true,
    });

    const contactsDump = contactsStore._dump();
    expect(contactsDump.contacts).toHaveLength(1);
    expect(contactsDump.contacts[0]).toMatchObject({
      tenantId: TENANT_ID,
      emailNormalised: "test@example.com",
    });

    const casesDump = casesStore._dump();
    expect(casesDump.events.map((event) => event.eventType)).toEqual([
      "consent_granted",
      "capture_field_submitted",
    ]);
    const submittedEvent = casesDump.events.find(
      (event) => event.eventType === "capture_field_submitted",
    );
    expect(submittedEvent?.payload).toMatchObject({
      field: "email",
      value_hash: hashIdentifierForAudit("test@example.com"),
      contact_id: contactsDump.contacts[0].id,
      contact_created: true,
    });
    expect(JSON.stringify(submittedEvent?.payload)).not.toContain(
      "test@example.com",
    );

    const updatedCase = casesDump.cases.find((row) => row.id === kase.id);
    expect(updatedCase?.contactId).toBe(contactsDump.contacts[0].id);
  });

  it("records a decline audit event without creating a contact or setting case.contactId", async () => {
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

    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ ok: true, action: "decline" });

    expect(contactsStore._dump().contacts).toHaveLength(0);

    const casesDump = casesStore._dump();
    expect(casesDump.events).toHaveLength(1);
    expect(casesDump.events[0]).toMatchObject({
      tenantId: TENANT_ID,
      caseId: kase.id,
      conversationId: CONVERSATION_ID,
      actorType: "visitor",
      actorId: VISITOR_ID,
      eventType: "consent_declined",
      payload: {},
    });
    expect(casesDump.cases.find((row) => row.id === kase.id)?.contactId).toBe(
      null,
    );
  });
});
