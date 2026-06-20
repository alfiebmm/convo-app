import { recordCaseEvent } from "@/lib/cases/events";
import type { CasesStore } from "@/lib/cases/store";
import { assertTenantId, assertUuid } from "@/lib/cases/tenant-guard";
import {
  getContactDetailById,
  type ContactDetailRow,
  type ContactsStore,
} from "./index";

export interface RevealContactIdentifierResult {
  identifierId: string;
  type: string;
  value: string | null;
}

export interface ContactPiiOptions {
  contactsStore?: ContactsStore;
  casesStore?: CasesStore;
}

function latestAuditCase(detail: ContactDetailRow) {
  return detail.cases[0] ?? null;
}

export async function revealContactIdentifierForTenant(
  tenantId: string,
  contactId: string,
  identifierId: string,
  actorId: string,
  opts?: ContactPiiOptions,
): Promise<RevealContactIdentifierResult | null> {
  assertTenantId(tenantId);
  assertUuid(contactId, "contactId");
  assertUuid(identifierId, "identifierId");
  assertUuid(actorId, "actorId");

  const detail = await getContactDetailById(tenantId, contactId, {
    store: opts?.contactsStore,
  });
  if (!detail) return null;

  const identifier = detail.identifiers.find((item) => item.id === identifierId);
  if (!identifier) return null;

  const auditCase = latestAuditCase(detail);
  if (auditCase) {
    await recordCaseEvent(
      tenantId,
      {
        caseId: auditCase.id,
        conversationId: auditCase.conversationId,
        actorType: "user",
        actorId,
        eventType: "pii_reveal",
        payload: {
          scope: "contact",
          contact_id: contactId,
          identifier_id: identifierId,
          identifier_type: identifier.type,
          actor_id: actorId,
        },
      },
      { store: opts?.casesStore },
    );
  } else {
    console.warn("[contacts] skipped pii_reveal audit with no contact case", {
      tenantId,
      contactId,
      identifierId,
      actorId,
    });
  }

  return {
    identifierId,
    type: identifier.type,
    value: identifier.valueNormalised,
  };
}
