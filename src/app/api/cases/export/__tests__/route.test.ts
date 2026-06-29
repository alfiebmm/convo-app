#!/usr/bin/env node

import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {
  handleCasesExport,
  type CaseExportDeps,
} from "../route";
import type { CaseListItemRow } from "@/lib/cases";
import type { ContactDetailRow } from "@/lib/contacts";
import type { LogAuditEventInput } from "@/lib/audit/log-event";

const TENANT_A = "a1111111-1111-4111-8111-111111111111";
const TENANT_B = "b2222222-2222-4222-9222-222222222222";
const ACTOR = "c3333333-3333-4333-8333-333333333333";
const CONTACT_A = "d4444444-4444-4444-8444-444444444444";
const CONTACT_B = "e5555555-5555-4555-8555-555555555555";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`OK ${name}`);
    passed++;
  } catch (error) {
    console.log(`FAIL ${name}`);
    console.log(error instanceof Error ? error.message : String(error));
    failed++;
  }
}

function caseRow(overrides: Partial<CaseListItemRow>): CaseListItemRow {
  const now = new Date("2026-06-29T01:02:03.000Z");
  return {
    id: "f6666666-6666-4666-8666-666666666666",
    tenantId: TENANT_A,
    conversationId: "a7777777-7777-4777-8777-777777777777",
    contactId: CONTACT_A,
    caseType: "sales",
    status: "open",
    priority: "medium",
    routingKey: "sales",
    title: "Standard enquiry",
    summary: "Needs follow-up",
    reason: "Visitor asked for help",
    source: "rule",
    ruleId: "rule-a",
    classifierConfidence: 0.88,
    assignedTo: null,
    externalSystem: null,
    externalId: null,
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    conversationStatus: "completed",
    conversationVisitorId: "visitor-a",
    conversationMessageCount: 3,
    conversationStartedAt: now,
    latestMessageAt: now,
    latestCaseEventAt: now,
    lastActivityAt: now,
    contactDisplayName: "Ada Lovelace",
    assignedOwnerName: null,
    latestConnectorType: null,
    latestConnectorDestinationId: null,
    latestConnectorStatus: null,
    ...overrides,
  };
}

function contactDetail(contactId: string): ContactDetailRow {
  const now = new Date("2026-06-29T01:02:03.000Z");
  return {
    contact: {
      id: contactId,
      tenantId: TENANT_A,
      displayName: "Ada Lovelace",
      emailNormalised: "ada@example.com",
      phoneNormalised: "+61400111222",
      preferredContactMethod: "email",
      attributes: {},
      consentState: null,
      privacyNoticeVersion: null,
      firstSeenAt: now,
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now,
    },
    identifiers: [
      {
        id: "b8888888-8888-4888-8888-888888888888",
        tenantId: TENANT_A,
        contactId,
        type: "email",
        valueNormalised: "ada@example.com",
        verifiedAt: null,
        source: "chat",
        createdAt: now,
      },
    ],
    conversations: [],
    cases: [],
    connectors: [],
    events: [],
  };
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\r" && text[i + 1] === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i++;
    } else {
      cell += char;
    }
  }
  return rows.filter((candidate) => candidate.length > 1);
}

function makeDeps(
  rows: CaseListItemRow[],
  canExportPii: boolean,
  seen: {
    tenantIds: string[];
    statuses: unknown[];
    auditEvents?: LogAuditEventInput[];
  } = { tenantIds: [], statuses: [] },
): CaseExportDeps {
  return {
    getSessionUserId: async () => ACTOR,
    getActiveTenant: async () => ({ id: TENANT_A, slug: "Doggo" }),
    getTenantMembership: async () => ({ role: canExportPii ? "editor" : "viewer" }) as never,
    canExportPii: () => canExportPii,
    listCases: async (tenantId, filters) => {
      seen.tenantIds.push(tenantId);
      seen.statuses.push(filters.status);
      return rows.filter((row) => row.tenantId === tenantId);
    },
    getContactDetail: async (tenantId, contactId) => {
      seen.tenantIds.push(tenantId);
      return contactDetail(contactId);
    },
    logAuditEvent: async (input) => {
      seen.auditEvents?.push(input);
      return "99999999-9999-4999-8999-999999999999";
    },
    now: () => new Date("2026-06-29T12:00:00.000Z"),
  };
}

async function readCsv(res: Response) {
  return parseCsv(await res.text());
}

async function run() {
  await test("tenant isolation only exports rows returned for the active tenant", async () => {
    const rows = [
      caseRow({ tenantId: TENANT_A, id: "a1111111-2222-4333-8444-555555555555" }),
      caseRow({ tenantId: TENANT_B, id: "b1111111-2222-4333-8444-555555555555", contactId: CONTACT_B }),
    ];
    const seen = { tenantIds: [] as string[], statuses: [] as unknown[] };
    const res = await handleCasesExport(
      new Request("https://app.test/api/cases/export?format=csv"),
      makeDeps(rows, true, seen),
    );
    const csv = await readCsv(res);
    assert.equal(seen.tenantIds.every((id) => id === TENANT_A), true);
    assert.equal(csv.length, 2);
    assert.equal(csv[1][0], "a1111111-2222-4333-8444-555555555555");
  });

  await test("full PII is exported when the existing PII permission allows it", async () => {
    const res = await handleCasesExport(
      new Request("https://app.test/api/cases/export?format=csv"),
      makeDeps([caseRow({})], true),
    );
    const csv = await readCsv(res);
    const headers = csv[0];
    const row = csv[1];
    assert.equal(row[headers.indexOf("email")], "ada@example.com");
    assert.equal(row[headers.indexOf("phone")], "+61400111222");
    assert.equal(row[headers.indexOf("contact_identifiers")], "email:ada@example.com");
    assert.equal(row[headers.indexOf("pii_redacted")], "false");
  });

  await test("PII columns are redacted without the existing PII permission", async () => {
    const res = await handleCasesExport(
      new Request("https://app.test/api/cases/export?format=csv"),
      makeDeps([caseRow({})], false),
    );
    const csv = await readCsv(res);
    const headers = csv[0];
    const row = csv[1];
    assert.equal(row[headers.indexOf("email")], "[redacted]");
    assert.equal(row[headers.indexOf("phone")], "[redacted]");
    assert.equal(row[headers.indexOf("contact_identifiers")], "[redacted]");
    assert.equal(row[headers.indexOf("pii_redacted")], "true");
  });

  await test("CSV escaping preserves commas, quotes, and newlines", async () => {
    const res = await handleCasesExport(
      new Request("https://app.test/api/cases/export?format=csv"),
      makeDeps([
        caseRow({
          title: 'Lead, says "urgent"',
          summary: "Line one\nLine two",
        }),
      ], true),
    );
    const csv = await readCsv(res);
    const headers = csv[0];
    assert.equal(csv[1][headers.indexOf("title")], 'Lead, says "urgent"');
    assert.equal(csv[1][headers.indexOf("summary")], "Line one\nLine two");
  });

  await test("XLSX round-trip exposes rows and cell values", async () => {
    const res = await handleCasesExport(
      new Request("https://app.test/api/cases/export?format=xlsx"),
      makeDeps([caseRow({ title: "Round trip case" })], true),
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await res.arrayBuffer());
    const sheet = workbook.getWorksheet("Cases");
    assert.equal(sheet?.rowCount, 2);
    assert.equal(sheet?.getRow(2).getCell(7).value, "Round trip case");
  });

  await test("status filter is forwarded using the dashboard filter shape", async () => {
    const seen = { tenantIds: [] as string[], statuses: [] as unknown[] };
    await handleCasesExport(
      new Request("https://app.test/api/cases/export?format=csv&status=resolved"),
      makeDeps([caseRow({ status: "resolved" })], true, seen),
    );
    assert.equal(seen.statuses[0], "resolved");
  });

  await test("filename uses tenant slug and ISO date", async () => {
    const res = await handleCasesExport(
      new Request("https://app.test/api/cases/export?format=csv"),
      makeDeps([caseRow({})], true),
    );
    assert.equal(
      res.headers.get("Content-Disposition"),
      'attachment; filename="convo-cases-doggo-2026-06-29.csv"',
    );
  });

  await test("export writes an audit event with filter and row count", async () => {
    const seen = {
      tenantIds: [] as string[],
      statuses: [] as unknown[],
      auditEvents: [] as LogAuditEventInput[],
    };
    await handleCasesExport(
      new Request("https://app.test/api/cases/export?format=csv&status=open"),
      makeDeps([caseRow({ status: "open" })], false, seen),
    );

    assert.equal(seen.auditEvents.length, 1);
    assert.equal(seen.auditEvents[0].eventType, "export");
    assert.equal(seen.auditEvents[0].tenantId, TENANT_A);
    assert.equal(seen.auditEvents[0].actorId, ACTOR);
    assert.equal(seen.auditEvents[0].caseId, "f6666666-6666-4666-8666-666666666666");
    assert.deepEqual(seen.auditEvents[0].payload, {
      scope: "cases",
      filter: { format: "csv", status: "open" },
      row_count: 1,
      format: "csv",
      pii_redacted: true,
    });
  });
}

run().then(() => {
  if (failed > 0) process.exit(1);
  console.log(`cases export route tests passed: ${passed}`);
});
