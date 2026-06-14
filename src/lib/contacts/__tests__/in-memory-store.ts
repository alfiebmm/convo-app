/**
 * In-memory ContactsStore for unit tests (CON-164).
 * Tenant-scoped by construction (every method filters by tenantId).
 */

import { randomUUID } from "node:crypto";

import type {
  ContactRow,
  ContactsStore,
  ConversationContactLinkRow,
  LinkContactInput,
  UpsertContactInput,
} from "../store";

export interface InMemoryContactsStore extends ContactsStore {
  _dump(): {
    contacts: ContactRow[];
    links: ConversationContactLinkRow[];
  };
}

export function createInMemoryContactsStore(): InMemoryContactsStore {
  const contacts: ContactRow[] = [];
  const links: ConversationContactLinkRow[] = [];

  return {
    async upsertContact(tenantId, input: UpsertContactInput) {
      // Match precedence: email > phone.
      let existing: ContactRow | undefined;
      if (input.emailNormalised) {
        existing = contacts.find(
          (c) =>
            c.tenantId === tenantId &&
            c.emailNormalised === input.emailNormalised
        );
      }
      if (!existing && input.phoneNormalised) {
        existing = contacts.find(
          (c) =>
            c.tenantId === tenantId &&
            c.phoneNormalised === input.phoneNormalised
        );
      }

      const now = new Date();
      if (existing) {
        const mergedAttributes = {
          ...existing.attributes,
          ...(input.attributes ?? {}),
        };
        const updated: ContactRow = {
          ...existing,
          displayName: existing.displayName ?? input.displayName ?? null,
          emailNormalised:
            existing.emailNormalised ?? input.emailNormalised ?? null,
          phoneNormalised:
            existing.phoneNormalised ?? input.phoneNormalised ?? null,
          preferredContactMethod:
            input.preferredContactMethod ?? existing.preferredContactMethod,
          attributes: mergedAttributes,
          consentState: input.consentState ?? existing.consentState,
          privacyNoticeVersion:
            input.privacyNoticeVersion ?? existing.privacyNoticeVersion,
          lastSeenAt: now,
          updatedAt: now,
        };
        const idx = contacts.indexOf(existing);
        contacts[idx] = updated;
        return { contact: { ...updated }, created: false };
      }

      const row: ContactRow = {
        id: randomUUID(),
        tenantId,
        displayName: input.displayName ?? null,
        emailNormalised: input.emailNormalised ?? null,
        phoneNormalised: input.phoneNormalised ?? null,
        preferredContactMethod: input.preferredContactMethod ?? null,
        attributes: input.attributes ?? {},
        consentState: input.consentState ?? null,
        privacyNoticeVersion: input.privacyNoticeVersion ?? null,
        firstSeenAt: now,
        lastSeenAt: now,
        createdAt: now,
        updatedAt: now,
      };
      contacts.push(row);
      return { contact: { ...row }, created: true };
    },

    async findContactById(tenantId, contactId): Promise<ContactRow | null> {
      const row = contacts.find(
        (c) => c.tenantId === tenantId && c.id === contactId
      );
      return row ? { ...row } : null;
    },

    async linkContactToConversation(
      tenantId,
      input: LinkContactInput
    ): Promise<ConversationContactLinkRow> {
      const existingIdx = links.findIndex(
        (l) =>
          l.tenantId === tenantId &&
          l.conversationId === input.conversationId &&
          l.contactId === input.contactId
      );
      if (existingIdx !== -1) {
        links[existingIdx] = {
          ...links[existingIdx],
          relationship: input.relationship,
        };
        return { ...links[existingIdx] };
      }
      const row: ConversationContactLinkRow = {
        tenantId,
        conversationId: input.conversationId,
        contactId: input.contactId,
        relationship: input.relationship,
        createdAt: new Date(),
      };
      links.push(row);
      return { ...row };
    },

    _dump() {
      return {
        contacts: contacts.map((r) => ({ ...r })),
        links: links.map((r) => ({ ...r })),
      };
    },
  };
}
