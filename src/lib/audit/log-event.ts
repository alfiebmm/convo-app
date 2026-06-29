import { db as defaultDb } from "@/lib/db";
import { followUpEvents } from "@/lib/db/schema";
import { assertTenantId, assertUuid } from "@/lib/cases/tenant-guard";

export type AuditEventType =
  | "pii_reveal"
  | "export"
  | "assignment_change"
  | "status_change"
  | "connector_delivery_attempt"
  | "privacy_notice_shown"
  | "consent_granted"
  | "consent_declined";

export type AuditActorType = "user" | "visitor" | "system";

export interface LogAuditEventInput {
  tenantId: string;
  actorId: string | null;
  actorType: AuditActorType;
  eventType: AuditEventType;
  caseId?: string | null;
  conversationId?: string | null;
  payload?: Record<string, unknown>;
}

export interface AuditEventWriter {
  insert(input: LogAuditEventInput): Promise<string>;
}

type DrizzleDb = typeof defaultDb;

export function createDrizzleAuditEventWriter(
  db: DrizzleDb = defaultDb,
): AuditEventWriter {
  return {
    async insert(input) {
      const [row] = await db
        .insert(followUpEvents)
        .values({
          tenantId: input.tenantId,
          caseId: input.caseId ?? null,
          conversationId: input.conversationId ?? null,
          actorType: input.actorType,
          actorId: input.actorId,
          eventType: input.eventType,
          payload: input.payload ?? {},
        })
        .returning({ id: followUpEvents.id });
      if (!row?.id) {
        throw new Error("Audit event insert did not return an id");
      }
      return row.id;
    },
  };
}

let defaultWriter: AuditEventWriter | null = null;

function resolveWriter(writer?: AuditEventWriter): AuditEventWriter {
  if (writer) return writer;
  if (!defaultWriter) {
    defaultWriter = createDrizzleAuditEventWriter();
  }
  return defaultWriter;
}

export async function logAuditEvent(
  input: LogAuditEventInput,
  opts: { writer?: AuditEventWriter } = {},
): Promise<string> {
  assertTenantId(input.tenantId);
  if (input.caseId !== undefined && input.caseId !== null) {
    assertUuid(input.caseId, "caseId");
  }
  if (input.conversationId !== undefined && input.conversationId !== null) {
    assertUuid(input.conversationId, "conversationId");
  }
  if (!input.actorType) {
    throw new Error("actorType is required");
  }
  if (!input.eventType) {
    throw new Error("eventType is required");
  }

  return resolveWriter(opts.writer).insert({
    ...input,
    payload: input.payload ?? {},
  });
}
