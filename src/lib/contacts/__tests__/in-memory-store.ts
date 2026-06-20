/**
 * In-memory ContactsStore for unit tests (CON-164).
 * Tenant-scoped by construction (every method filters by tenantId).
 */

import { randomUUID } from "node:crypto";

import type {
  ContactListItemRow,
  ContactRow,
  ContactsStore,
  ConversationContactLinkRow,
  LinkContactInput,
  ListContactsByTenantFilters,
  UpsertContactInput,
} from "../store";

export interface InMemoryContactsStore extends ContactsStore {
  _addOpenCase(input: {
    tenantId: string;
    contactId: string;
    caseType: string;
    status: string;
    updatedAt?: Date;
  }): void;
  _setContactLastSeenAt(contactId: string, lastSeenAt: Date): void;
  _dump(): {
    contacts: ContactRow[];
    links: ConversationContactLinkRow[];
  };
}

export function createInMemoryContactsStore(): InMemoryContactsStore {
  const contacts: ContactRow[] = [];
  const links: ConversationContactLinkRow[] = [];
  const openCases: Array<{
    tenantId: string;
    contactId: string;
    caseType: string;
    status: string;
    updatedAt: Date;
  }> = [];

  function stringAttr(
    attrs: Record<string, unknown>,
    key: string,
  ): string | null {
    const value = attrs[key];
    return typeof value === "string" && value.trim() ? value : null;
  }

  function toListItem(contact: ContactRow): ContactListItemRow {
    const latestCase = openCases
      .filter(
        (c) => c.tenantId === contact.tenantId && c.contactId === contact.id,
      )
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];

    return {
      ...contact,
      company: stringAttr(contact.attributes, "company"),
      location: stringAttr(contact.attributes, "location"),
      persona: stringAttr(contact.attributes, "persona"),
      marketplaceSide: stringAttr(contact.attributes, "marketplace_side"),
      serviceOrProduct:
        stringAttr(contact.attributes, "service_or_product") ??
        stringAttr(contact.attributes, "service") ??
        stringAttr(contact.attributes, "product"),
      relatedCaseType: latestCase?.caseType ?? null,
      openCaseStatus: latestCase?.status ?? null,
    };
  }

  function includes(value: string | null | undefined, q: string) {
    return (value ?? "").toLowerCase().includes(q);
  }

  return {
    async upsertContact(tenantId, input: UpsertContactInput) {
      // Match precedence: email > phone.
      let existing: ContactRow | undefined;
      if (input.emailNormalised) {
        existing = contacts.find(
          (c) =>
            c.tenantId === tenantId &&
            c.emailNormalised === input.emailNormalised,
        );
      }
      if (!existing && input.phoneNormalised) {
        existing = contacts.find(
          (c) =>
            c.tenantId === tenantId &&
            c.phoneNormalised === input.phoneNormalised,
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
        (c) => c.tenantId === tenantId && c.id === contactId,
      );
      return row ? { ...row } : null;
    },

    async listContactsByTenant(
      tenantId,
      filters: ListContactsByTenantFilters,
    ): Promise<{ rows: ContactListItemRow[]; totalCount: number }> {
      const q = filters.q?.trim().toLowerCase();
      let rows = contacts
        .filter((contact) => contact.tenantId === tenantId)
        .map(toListItem);

      if (q) {
        rows = rows.filter((contact) =>
          [
            contact.displayName,
            contact.emailNormalised,
            contact.phoneNormalised,
            contact.company,
            contact.location,
          ].some((value) => includes(value, q)),
        );
      }
      if (filters.persona) {
        rows = rows.filter((contact) => contact.persona === filters.persona);
      }
      if (filters.mktSide) {
        rows = rows.filter(
          (contact) => contact.marketplaceSide === filters.mktSide,
        );
      }
      if (filters.caseType) {
        rows = rows.filter(
          (contact) => contact.relatedCaseType === filters.caseType,
        );
      }
      if (filters.caseStatus) {
        rows = rows.filter(
          (contact) => contact.openCaseStatus === filters.caseStatus,
        );
      }
      if (filters.from) {
        rows = rows.filter((contact) => contact.lastSeenAt >= filters.from!);
      }
      if (filters.to) {
        rows = rows.filter((contact) => contact.lastSeenAt <= filters.to!);
      }

      rows = rows.sort((a, b) => {
        if (filters.sort === "name-asc" || filters.sort === "name-desc") {
          const cmp = (a.displayName ?? "").localeCompare(b.displayName ?? "");
          return filters.sort === "name-asc" ? cmp : -cmp;
        }
        const cmp = a.lastSeenAt.getTime() - b.lastSeenAt.getTime();
        return filters.sort === "last-seen-asc" ? cmp : -cmp;
      });

      const page = Math.max(1, filters.page ?? 1);
      const start = (page - 1) * 50;
      return {
        rows: rows.slice(start, start + 50).map((row) => ({ ...row })),
        totalCount: rows.length,
      };
    },

    async linkContactToConversation(
      tenantId,
      input: LinkContactInput,
    ): Promise<ConversationContactLinkRow> {
      const existingIdx = links.findIndex(
        (l) =>
          l.tenantId === tenantId &&
          l.conversationId === input.conversationId &&
          l.contactId === input.contactId,
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

    _addOpenCase(input) {
      openCases.push({
        tenantId: input.tenantId,
        contactId: input.contactId,
        caseType: input.caseType,
        status: input.status,
        updatedAt: input.updatedAt ?? new Date(),
      });
    },

    _setContactLastSeenAt(contactId, lastSeenAt) {
      const idx = contacts.findIndex((contact) => contact.id === contactId);
      if (idx === -1) return;
      contacts[idx] = {
        ...contacts[idx],
        lastSeenAt,
        updatedAt: lastSeenAt,
      };
    },

    _dump() {
      return {
        contacts: contacts.map((r) => ({ ...r })),
        links: links.map((r) => ({ ...r })),
      };
    },
  };
}
