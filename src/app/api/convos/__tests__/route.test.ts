#!/usr/bin/env node

import test from "node:test";
import assert from "node:assert/strict";

import { handleGetConvos, type ConvosRouteDeps } from "../route";
import { handleGetConvo, handlePatchConvo } from "../[id]/route";
import { handlePostConvoNote } from "../[id]/notes/route";
import { handleGenerateSummary } from "../[id]/generate-summary/route";
import type {
  ConvoDetail,
  ConvoListItem,
  ConvoNote,
  ConvosStore,
  ListConvosFilters,
} from "@/lib/convos";

const TENANT_A = "a1111111-1111-4111-8111-111111111111";
const TENANT_B = "b2222222-2222-4222-9222-222222222222";
const USER_EDITOR = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const USER_VIEWER = "11111111-2222-4222-8222-222222222222";
const CONVO_A = "cccccccc-cccc-4ccc-accc-cccccccccccc";
const CONVO_B = "dddddddd-dddd-4ddd-addd-dddddddddddd";

function jsonReq(url: string, body?: unknown) {
  return {
    nextUrl: new URL(url),
    json: async () => body,
  } as never;
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

function baseConvo(
  id: string,
  tenantId: string,
  index: number
): ConvoListItem {
  return {
    id,
    tenantId,
    title: `Thread ${index}`,
    topic: index % 2 === 0 ? "pricing" : "support",
    persona: index % 2 === 0 ? "buyer" : "owner",
    status: "active",
    blogStatus: index === 1 ? "draft" : null,
    followUpRequired: index % 2 === 0,
    followUpType: index % 2 === 0 ? "lead" : null,
    followUpStatus: index % 2 === 0 ? "open" : null,
    assignedOwnerId: null,
    assignedOwnerName: null,
    startedAt: new Date(`2026-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`),
    lastActivityAt: new Date(`2026-01-${String(index + 1).padStart(2, "0")}T01:00:00.000Z`),
    messageCount: index,
  };
}

function makeStore(): ConvosStore & { calls: Array<[string, ListConvosFilters]> } {
  const convos = [
    baseConvo(CONVO_A, TENANT_A, 1),
    baseConvo("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", TENANT_A, 2),
    baseConvo(CONVO_B, TENANT_B, 3),
  ];
  const notes: ConvoNote[] = [];
  const calls: Array<[string, ListConvosFilters]> = [];

  return {
    calls,
    async listConvos(tenantId, filters) {
      calls.push([tenantId, filters]);
      let rows = convos.filter((convo) => convo.tenantId === tenantId);
      if (filters.followUpRequired !== undefined) {
        rows = rows.filter(
          (convo) => convo.followUpRequired === filters.followUpRequired
        );
      }
      const page = rows.slice(filters.offset, filters.offset + filters.limit + 1);
      return {
        items: page.slice(0, filters.limit),
        nextOffset:
          page.length > filters.limit ? filters.offset + filters.limit : null,
      };
    },
    async getConvoDetail(tenantId, convoId) {
      const convo = convos.find(
        (item) => item.tenantId === tenantId && item.id === convoId
      );
      if (!convo) return null;
      const detail: ConvoDetail = {
        convo: {
          ...convo,
          visitorId: "visitor-1",
          metadata: { pageUrl: "https://example.test" },
          completedAt: null,
          summary: null,
          summaryGeneratedAt: null,
        },
        transcript: [
          {
            id: "99999999-9999-4999-8999-999999999999",
            role: "user",
            content: "Hello",
            createdAt: convo.startedAt,
          },
        ],
        tags: [{ key: "persona", value: { value: "buyer" } }],
        capturedCustomerDetails: {
          id: "77777777-7777-4777-8777-777777777777",
          displayName: "Ada",
          emailNormalised: "ada@example.test",
          phoneNormalised: null,
          preferredContactMethod: "email",
          attributes: {},
        },
        internalNotes: notes,
        activityHistory: notes.map((note) => ({
          id: note.id,
          eventType: "note_added",
          actorType: "user",
          actorId: note.actorId,
          payload: { body_html: note.bodyHtml },
          createdAt: note.createdAt,
        })),
        linkedBlogArticle: {
          id: "88888888-8888-4888-8888-888888888888",
          title: "Pricing guide",
          slug: "pricing-guide",
          status: "draft",
          publishedAt: null,
        },
      };
      return detail;
    },
    async updateConvo(tenantId, convoId, patch) {
      const convo = convos.find(
        (item) => item.tenantId === tenantId && item.id === convoId
      );
      if (!convo) return null;
      if (patch.followUpStatus !== undefined) {
        convo.followUpStatus = patch.followUpStatus;
        convo.followUpRequired = !["resolved", "dismissed"].includes(
          patch.followUpStatus
        );
      }
      if (patch.assignedOwnerId !== undefined) {
        convo.assignedOwnerId = patch.assignedOwnerId;
      }
      return convo;
    },
    async appendNote(tenantId, convoId, bodyHtml, actorId) {
      const convo = convos.find(
        (item) => item.tenantId === tenantId && item.id === convoId
      );
      if (!convo) return null;
      const note = {
        id: "66666666-6666-4666-8666-666666666666",
        bodyHtml,
        actorId,
        createdAt: new Date("2026-01-04T00:00:00.000Z"),
      };
      notes.push(note);
      return note;
    },
  };
}

function depsFor(
  store: ConvosStore,
  role: "owner" | "admin" | "editor" | "viewer" = "editor",
  tenantId = TENANT_A,
  userId = USER_EDITOR
): ConvosRouteDeps {
  return {
    auth: async () => ({ user: { id: userId } }) as never,
    getActiveTenantIdForUser: async () => tenantId,
    getTenantMembership: async () =>
      ({
        id: "55555555-5555-4555-8555-555555555555",
        tenantId,
        userId,
        role,
        createdAt: new Date(),
      }) as never,
    store,
  };
}

test("GET /api/convos paginates and tenant-scopes the list", async () => {
  const store = makeStore();
  const res = await handleGetConvos(
    jsonReq("https://app.test/api/convos?limit=1&offset=0"),
    depsFor(store)
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.items.length, 1);
  assert.equal(body.items[0].tenantId, TENANT_A);
  assert.equal(body.pagination.nextOffset, 1);
  assert.equal(store.calls[0][0], TENANT_A);
});

test("GET /api/convos returns only the active tenant's rows", async () => {
  const store = makeStore();
  const res = await handleGetConvos(
    jsonReq("https://app.test/api/convos?limit=10"),
    depsFor(store, "editor", TENANT_B)
  );
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.deepEqual(body.items.map((item: { tenantId: string }) => item.tenantId), [
    TENANT_B,
  ]);
});

test("GET /api/convos/:id returns the detail payload including transcript and linked blog", async () => {
  const store = makeStore();
  const res = await handleGetConvo(
    jsonReq(`https://app.test/api/convos/${CONVO_A}`),
    params(CONVO_A),
    depsFor(store)
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.convo.id, CONVO_A);
  assert.equal(body.convo.summary, null);
  assert.equal(body.transcript[0].content, "Hello");
  assert.equal(body.capturedCustomerDetails.emailNormalised, "ada@example.test");
  assert.equal(body.linkedBlogArticle.slug, "pricing-guide");
});

test("GET /api/convos/:id hides another tenant's conversation behind 404", async () => {
  const store = makeStore();
  const res = await handleGetConvo(
    jsonReq(`https://app.test/api/convos/${CONVO_B}`),
    params(CONVO_B),
    depsFor(store, "editor", TENANT_A)
  );
  assert.equal(res.status, 404);
});

test("PATCH /api/convos/:id updates status and appends a note for editors", async () => {
  const store = makeStore();
  const res = await handlePatchConvo(
    jsonReq(`https://app.test/api/convos/${CONVO_A}`, {
      followUpStatus: "resolved",
      assignedOwnerId: USER_EDITOR,
      note: "<p>Called back.</p>",
    }),
    params(CONVO_A),
    depsFor(store)
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.convo.followUpStatus, "resolved");
  assert.equal(body.convo.assignedOwnerId, USER_EDITOR);
});

test("PATCH /api/convos/:id rejects viewer writes", async () => {
  const store = makeStore();
  const res = await handlePatchConvo(
    jsonReq(`https://app.test/api/convos/${CONVO_A}`, {
      followUpStatus: "resolved",
    }),
    params(CONVO_A),
    depsFor(store, "viewer", TENANT_A, USER_VIEWER)
  );
  assert.equal(res.status, 403);
});

test("POST /api/convos/:id/notes appends an internal note", async () => {
  const store = makeStore();
  const res = await handlePostConvoNote(
    jsonReq(`https://app.test/api/convos/${CONVO_A}/notes`, {
      body: "<p>Owner will follow up tomorrow.</p>",
    }),
    params(CONVO_A),
    depsFor(store)
  );
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.note.bodyHtml, "<p>Owner will follow up tomorrow.</p>");
  assert.equal(body.note.actorId, USER_EDITOR);
});

test("POST /api/convos/:id/generate-summary returns the explicit CON-118 stub", async () => {
  const store = makeStore();
  const res = await handleGenerateSummary(
    jsonReq(`https://app.test/api/convos/${CONVO_A}/generate-summary`),
    params(CONVO_A),
    depsFor(store)
  );
  assert.equal(res.status, 501);
  assert.deepEqual(await res.json(), {
    error: "not_implemented",
    summary: null,
  });
});
