#!/usr/bin/env node

import {
  handleWidgetTrack,
  type WidgetTrackDeps,
} from "../route";

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

function req(body: unknown) {
  return {
    json: async () => body,
  };
}

async function readJson(res: Response) {
  return JSON.parse(await res.text());
}

const TENANT_ID = "tenant-a";
const VISITOR_ID = "visitor-a";
const CONVERSATION_ID = "conversation-a";

function deps(overrides: Partial<WidgetTrackDeps> = {}): WidgetTrackDeps {
  return {
    getConversationForVisitor: async (
      conversationId: string,
      tenantId: string,
      visitorId: string
    ) =>
      conversationId === CONVERSATION_ID &&
      tenantId === TENANT_ID &&
      visitorId === VISITOR_ID
        ? { id: CONVERSATION_ID, tenantId: TENANT_ID, visitorId: VISITOR_ID }
        : null,
    markEngaged: async () => {},
    createSession: async () => {},
    ...overrides,
  };
}

async function run() {
  await test("missing tenantId or visitorId returns 400", async () => {
    const res = await handleWidgetTrack(req({ tenantId: TENANT_ID }), deps());
    assertEq(res.status, 400, "status");
  });

  await test("cross-visitor engagement returns 404", async () => {
    const res = await handleWidgetTrack(
      req({
        tenantId: TENANT_ID,
        visitorId: "visitor-b",
        engaged: true,
        conversationId: CONVERSATION_ID,
      }),
      deps()
    );
    assertEq(res.status, 404, "status");
  });

  await test("valid engagement marks the scoped session", async () => {
    let marked: [string, string, string] | null = null;
    const res = await handleWidgetTrack(
      req({
        tenantId: TENANT_ID,
        visitorId: VISITOR_ID,
        engaged: true,
        conversationId: CONVERSATION_ID,
      }),
      deps({
        markEngaged: async (tenantId, visitorId, conversationId) => {
          marked = [tenantId, visitorId, conversationId];
        },
      })
    );
    assertEq(res.status, 200, "status");
    assertEq(marked?.[0], TENANT_ID, "tenantId");
    assertEq(marked?.[1], VISITOR_ID, "visitorId");
    assertEq(marked?.[2], CONVERSATION_ID, "conversationId");
  });

  await test("new widget session records page URL", async () => {
    let created: [string, string, string | null] | null = null;
    const res = await handleWidgetTrack(
      req({
        tenantId: TENANT_ID,
        visitorId: VISITOR_ID,
        pageUrl: "https://doggo.com.au/listings",
      }),
      deps({
        createSession: async (tenantId, visitorId, pageUrl) => {
          created = [tenantId, visitorId, pageUrl];
        },
      })
    );
    assertEq(res.status, 200, "status");
    const body = (await readJson(res)) as { ok?: boolean };
    assertEq(body.ok, true, "ok");
    assertEq(created?.[2], "https://doggo.com.au/listings", "pageUrl");
  });

  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
