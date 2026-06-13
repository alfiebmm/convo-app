#!/usr/bin/env node

import { handleQualifyingState } from "../route";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`OK ${name}`);
    passed++;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`FAIL ${name}`);
    console.log(`  ${message}`);
    failed++;
  }
}

function assertEq<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

async function readJson(res: Response) {
  return JSON.parse(await res.text());
}

const TENANT_ID = "tenant-a";
const VISITOR_ID = "visitor-a";
const CONVERSATION_ID = "conversation-a";

async function run() {
  await test("missing tenant/visitor params returns 400", async () => {
    const res = await handleQualifyingState(
      new URL("https://example.com/api/conversations/qualifying/state?conversation=abc")
    );
    assertEq(res.status, 400, "status");
  });

  await test("cross-visitor lookup returns 404", async () => {
    const res = await handleQualifyingState(
      new URL(
        `https://example.com/api/conversations/qualifying/state?conversation=${CONVERSATION_ID}&tenant=${TENANT_ID}&visitor=visitor-b`
      ),
      {
        getConversationForVisitor: async () => null,
      }
    );
    assertEq(res.status, 404, "status");
  });

  await test("scoped qualifying state returns only the visitor state", async () => {
    const res = await handleQualifyingState(
      new URL(
        `https://example.com/api/conversations/qualifying/state?conversation=${CONVERSATION_ID}&tenant=${TENANT_ID}&visitor=${VISITOR_ID}`
      ),
      {
        getConversationForVisitor: async () => ({
          id: CONVERSATION_ID,
          tenantId: TENANT_ID,
          visitorId: VISITOR_ID,
          metadata: {
            qualifying: {
              persona: { role: "buyer" },
              answers: [{ field: "role", value: "buyer" }],
              completedAt: "2026-06-13T01:23:45.000Z",
              skipped: false,
            },
          },
        }),
      }
    );

    assertEq(res.status, 200, "status");
    const body = (await readJson(res)) as {
      persona?: Record<string, string>;
      answeredFields?: string[];
      completedAt?: string | null;
      skipped?: boolean;
    };
    assertEq(body.persona?.role, "buyer", "persona.role");
    assertEq(body.answeredFields?.[0], "role", "answered field");
    assertEq(body.skipped, false, "skipped");
  });

  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
