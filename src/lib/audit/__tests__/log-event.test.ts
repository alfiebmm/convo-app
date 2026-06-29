import { test } from "node:test";
import assert from "node:assert/strict";

import {
  logAuditEvent,
  type AuditEventWriter,
  type LogAuditEventInput,
} from "../log-event";

const TENANT_A = "a1111111-1111-4111-8111-111111111111";
const CASE_A = "b2222222-2222-4222-9222-222222222222";
const CONVERSATION_A = "c3333333-3333-4333-8333-333333333333";
const ACTOR_A = "d4444444-4444-4444-8444-444444444444";

function createWriter(seen: LogAuditEventInput[]): AuditEventWriter {
  return {
    async insert(input) {
      seen.push(input);
      return "e5555555-5555-4555-8555-555555555555";
    },
  };
}

test("logAuditEvent writes the expected audit event shape and returns the id", async () => {
  const seen: LogAuditEventInput[] = [];

  const id = await logAuditEvent(
    {
      tenantId: TENANT_A,
      actorId: ACTOR_A,
      actorType: "user",
      eventType: "pii_reveal",
      caseId: CASE_A,
      conversationId: CONVERSATION_A,
      payload: { field: "emailNormalised" },
    },
    { writer: createWriter(seen) },
  );

  assert.equal(id, "e5555555-5555-4555-8555-555555555555");
  assert.deepEqual(seen, [
    {
      tenantId: TENANT_A,
      actorId: ACTOR_A,
      actorType: "user",
      eventType: "pii_reveal",
      caseId: CASE_A,
      conversationId: CONVERSATION_A,
      payload: { field: "emailNormalised" },
    },
  ]);
});

test("logAuditEvent throws when tenantId is missing", async () => {
  await assert.rejects(
    () =>
      logAuditEvent(
        {
          tenantId: "",
          actorId: ACTOR_A,
          actorType: "user",
          eventType: "export",
          payload: {},
        },
        { writer: createWriter([]) },
      ),
    /tenantId is required/,
  );
});
