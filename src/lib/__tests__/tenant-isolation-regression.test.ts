import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path: string) {
  return readFileSync(join(root, path), "utf8");
}

function exists(path: string) {
  return existsSync(join(root, path));
}

function tableBlock(sql: string, tableName: string) {
  const match = new RegExp(
    `CREATE TABLE IF NOT EXISTS ${tableName} \\([\\s\\S]*?\\n\\);`,
  ).exec(sql);
  assert.ok(match, `${tableName} definition exists`);
  return match[0];
}

test("Epic B tables keep tenant-owned rows deleted with the owning tenant", () => {
  const contactsSql = read("drizzle/0009_con160_contacts.sql");
  const casesSql = read("drizzle/0010_con161_follow_up_cases.sql");
  const outboxSql = read("drizzle/0011_con162_connector_outbox.sql");

  for (const [sql, tableName] of [
    [contactsSql, "contacts"],
    [contactsSql, "contact_identifiers"],
    [contactsSql, "conversation_contacts"],
    [casesSql, "follow_up_cases"],
    [casesSql, "follow_up_case_attributes"],
    [casesSql, "follow_up_events"],
    [outboxSql, "connector_outbox"],
  ] as const) {
    assert.match(
      tableBlock(sql, tableName),
      /tenant_id\s+UUID NOT NULL REFERENCES tenants\(id\) ON DELETE CASCADE/,
      `${tableName} deletes with its owning tenant`,
    );
  }
});

test("Epic B child rows delete through tenant-scoped parent records", () => {
  const contactsSql = read("drizzle/0009_con160_contacts.sql");
  const casesSql = read("drizzle/0010_con161_follow_up_cases.sql");
  const outboxSql = read("drizzle/0011_con162_connector_outbox.sql");

  assert.match(
    tableBlock(contactsSql, "contact_identifiers"),
    /contact_id\s+UUID NOT NULL REFERENCES contacts\(id\) ON DELETE CASCADE/,
    "contact_identifiers delete with contacts",
  );
  assert.match(
    tableBlock(contactsSql, "conversation_contacts"),
    /contact_id\s+UUID NOT NULL REFERENCES contacts\(id\) ON DELETE CASCADE/,
    "conversation_contacts delete with contacts",
  );
  assert.match(
    tableBlock(casesSql, "follow_up_case_attributes"),
    /case_id\s+UUID NOT NULL REFERENCES follow_up_cases\(id\) ON DELETE CASCADE/,
    "follow_up_case_attributes delete with cases",
  );
  assert.match(
    tableBlock(casesSql, "follow_up_events"),
    /case_id\s+UUID NOT NULL REFERENCES follow_up_cases\(id\) ON DELETE CASCADE/,
    "follow_up_events delete with cases",
  );
  assert.match(
    tableBlock(outboxSql, "connector_outbox"),
    /case_id\s+UUID NOT NULL REFERENCES follow_up_cases\(id\) ON DELETE CASCADE/,
    "connector_outbox deletes with cases",
  );
});

test("audit export route reads, logs and names files from the active tenant only", () => {
  const source = read("src/app/api/audit/export/route.ts");

  assert.match(
    source,
    /const tenantId = await getActiveTenantIdForUser\(actorId\);/,
    "tenant comes from the authenticated actor",
  );
  assert.match(
    source,
    /listAuditEventsForTenant\(tenantId, filters, cursor,\s*\{\s*limit: 500,\s*\}\s*\)/,
    "audit export lists events for the active tenant",
  );
  assert.match(
    source,
    /logAuditEvent\(\{\s*tenantId,/,
    "audit export logs the export event to the same tenant",
  );
  assert.match(
    source,
    /where\(eq\(tenants\.id, tenantId\)\)/,
    "audit export filename tenant slug is scoped by tenantId",
  );
});

test("Epic E REST route inventory is explicit on main", () => {
  const casesRoutes = read("src/app/api/cases/export/route.ts");
  const captureRoute = read("src/app/api/cases/[caseId]/capture/route.ts");
  const contactsExportRoute = read("src/app/api/contacts/export/route.ts");

  assert.match(casesRoutes, /handleCasesExport/, "cases export route exists");
  assert.match(captureRoute, /handleCaptureSubmit/, "case capture route exists");
  assert.match(
    contactsExportRoute,
    /handleContactsExport/,
    "contacts export route exists",
  );

  assert.deepEqual(
    [
      "src/app/api/cases/route.ts",
      "src/app/api/cases/[caseId]/route.ts",
      "src/app/api/cases/[caseId]/assignment/route.ts",
      "src/app/api/cases/[caseId]/status/route.ts",
      "src/app/api/cases/[caseId]/notes/route.ts",
      "src/app/api/contacts/route.ts",
      "src/app/api/contacts/[contactId]/route.ts",
    ].filter(exists),
    [],
    "CON-183 open question: list/detail/mutation API route files are absent on this branch",
  );
});
