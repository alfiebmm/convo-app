#!/usr/bin/env node

import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {
  handleContactsExport,
  type ContactExportDeps,
} from "../route";
import type { ContactDetailRow, ContactListItemRow } from "@/lib/contacts";
import type { LogAuditEventInput } from "@/lib/audit/log-event";

const TENANT_A = "a1111111-1111-4111-8111-111111111111";
const TENANT_B = "b2222222-2222-4222-9222-222222222222";
const ACTOR = "c3333333-3333-4333-8333-333333333333";

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

function contactRow(overrides: Partial<ContactListItemRow>): ContactListItemRow {
  const now = new Date("2026-06-29T01:02:03.000Z");
  return {
    id: "d4444444-4444-4444-8444-444444444444",
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
    company: "Doggo, Pty Ltd",
    location: "Sydney",
    persona: "owner",
    marketplaceSide: "buyer",
    serviceOrProduct: "Training",
    relatedCaseType: "sales",
    openCaseStatus: "open",
    ...overrides,
  };
}

function contactDetail(row: ContactListItemRow): ContactDetailRow {
  return {
    contact: row,
    identifiers: [
      {
        id: "e5555555-5555-4555-8555-555555555555",
        tenantId: row.tenantId,
        contactId: row.id,
        type: "email",
        valueNormalised: row.emailNormalised ?? "unknown@example.com",
        verifiedAt: null,
        source: "chat",
        createdAt: row.createdAt,
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
  rows: ContactListItemRow[],
  canExportPii: boolean,
  seen: {
    tenantIds: string[];
    q: unknown[];
    statuses: unknown[];
    auditEvents?: LogAuditEventInput[];
  } = {
    tenantIds: [],
    q: [],
    statuses: [],
  },
): ContactExportDeps {
  return {
    getSessionUserId: async () => ACTOR,
    getActiveTenant: async () => ({ id: TENANT_A, slug: "Doggo" }),
    getTenantMembership: async () => ({ role: canExportPii ? "editor" : "viewer" }) as never,
    canExportPii: () => canExportPii,
    listContacts: async (tenantId, filters) => {
      seen.tenantIds.push(tenantId);
      seen.q.push(filters.q);
      seen.statuses.push(filters.caseStatus);
      const scoped = rows.filter((row) => row.tenantId === tenantId);
      return { rows: scoped, totalCount: scoped.length };
    },
    getContactDetail: async (tenantId, contactId) => {
      seen.tenantIds.push(tenantId);
      const row = rows.find((candidate) => candidate.id === contactId);
      return row ? contactDetail(row) : null;
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
  await test("tenant isolation only exports active-tenant contacts", async () => {
    const rows = [
      contactRow({ id: "a1111111-2222-4333-8444-555555555555", tenantId: TENANT_A }),
      contactRow({ id: "b1111111-2222-4333-8444-555555555555", tenantId: TENANT_B }),
    ];
    const seen = { tenantIds: [] as string[], q: [] as unknown[], statuses: [] as unknown[] };
    const res = await handleContactsExport(
      new Request("https://app.test/api/contacts/export?format=csv"),
      makeDeps(rows, true, seen),
    );
    const csv = await readCsv(res);
    assert.equal(seen.tenantIds.every((id) => id === TENANT_A), true);
    assert.equal(csv.length, 2);
    assert.equal(csv[1][0], "a1111111-2222-4333-8444-555555555555");
    assert.equal(csv.some((row) => row.includes("b1111111-2222-4333-8444-555555555555")), false);
  });

  await test("full PII is exported when the existing PII permission allows it", async () => {
    const res = await handleContactsExport(
      new Request("https://app.test/api/contacts/export?format=csv"),
      makeDeps([contactRow({})], true),
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
    const res = await handleContactsExport(
      new Request("https://app.test/api/contacts/export?format=csv"),
      makeDeps([contactRow({})], false),
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
    const res = await handleContactsExport(
      new Request("https://app.test/api/contacts/export?format=csv"),
      makeDeps([
        contactRow({
          displayName: 'Ada, "Countess"',
          location: "Sydney\nMelbourne",
        }),
      ], true),
    );
    const csv = await readCsv(res);
    const headers = csv[0];
    assert.equal(csv[1][headers.indexOf("display_name")], 'Ada, "Countess"');
    assert.equal(csv[1][headers.indexOf("location")], "Sydney\nMelbourne");
  });

  await test("XLSX round-trip exposes rows and cell values", async () => {
    const res = await handleContactsExport(
      new Request("https://app.test/api/contacts/export?format=xlsx"),
      makeDeps([contactRow({ displayName: "Round Trip Contact" })], true),
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await res.arrayBuffer());
    const sheet = workbook.getWorksheet("Contacts");
    assert.equal(sheet?.rowCount, 2);
    assert.equal(sheet?.getRow(2).getCell(2).value, "Round Trip Contact");
  });

  await test("filter params are forwarded using the dashboard filter shape", async () => {
    const seen = { tenantIds: [] as string[], q: [] as unknown[], statuses: [] as unknown[] };
    await handleContactsExport(
      new Request("https://app.test/api/contacts/export?format=csv&q=ada&case-status=open"),
      makeDeps([contactRow({})], true, seen),
    );
    assert.equal(seen.q[0], "ada");
    assert.equal(seen.statuses[0], "open");
  });

  await test("export writes a tenant-scoped audit event with filter and row count", async () => {
    const seen = {
      tenantIds: [] as string[],
      q: [] as unknown[],
      statuses: [] as unknown[],
      auditEvents: [] as LogAuditEventInput[],
    };

    await handleContactsExport(
      new Request("https://app.test/api/contacts/export?format=csv&q=ada&case-status=open"),
      makeDeps([contactRow({})], false, seen),
    );

    assert.equal(seen.auditEvents.length, 1);
    assert.equal(seen.auditEvents[0].eventType, "export");
    assert.equal(seen.auditEvents[0].tenantId, TENANT_A);
    assert.equal(seen.auditEvents[0].actorId, ACTOR);
    assert.deepEqual(seen.auditEvents[0].payload, {
      scope: "contacts",
      filter: { format: "csv", q: "ada", "case-status": "open" },
      row_count: 1,
      format: "csv",
      pii_redacted: true,
    });
  });

  await test("filename uses tenant slug and ISO date", async () => {
    const res = await handleContactsExport(
      new Request("https://app.test/api/contacts/export?format=xlsx"),
      makeDeps([contactRow({})], true),
    );
    assert.equal(
      res.headers.get("Content-Disposition"),
      'attachment; filename="convo-contacts-doggo-2026-06-29.xlsx"',
    );
  });
}

run().then(() => {
  if (failed > 0) process.exit(1);
  console.log(`contacts export route tests passed: ${passed}`);
});
