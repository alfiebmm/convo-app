/**
 * ContactsStore — data-access seam for the contact helpers (CON-164).
 *
 * See `src/lib/cases/store.ts` for the rationale behind the store pattern.
 * Tenant-scope rule: every method takes `tenantId` first and the Drizzle
 * implementation includes `eq(table.tenantId, tenantId)` in every WHERE
 * clause. No escape hatches.
 */

import { and, eq } from "drizzle-orm";

import { db as defaultDb } from "@/lib/db";
import {
  contacts,
  conversationContacts,
} from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export interface ContactRow {
  id: string;
  tenantId: string;
  displayName: string | null;
  emailNormalised: string | null;
  phoneNormalised: string | null;
  preferredContactMethod: string | null;
  attributes: Record<string, unknown>;
  consentState: string | null;
  privacyNoticeVersion: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertContactInput {
  /**
   * Lowercased + trimmed e-mail. Caller normalises; the store just stores.
   */
  emailNormalised?: string | null;
  /**
   * E.164 phone. Caller normalises; the store just stores.
   */
  phoneNormalised?: string | null;
  displayName?: string | null;
  preferredContactMethod?: string | null;
  attributes?: Record<string, unknown>;
  consentState?: string | null;
  privacyNoticeVersion?: string | null;
}

export interface ConversationContactLinkRow {
  tenantId: string;
  conversationId: string;
  contactId: string;
  relationship: string;
  createdAt: Date;
}

export interface LinkContactInput {
  conversationId: string;
  contactId: string;
  /**
   * Free-form for v1 — e.g. "primary", "cc". The Convo product currently
   * uses "primary" everywhere; downstream tickets may introduce more.
   */
  relationship: string;
}

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

export interface ContactsStore {
  /**
   * Find an existing contact for this tenant by normalised email/phone, or
   * insert a new one. Returns the canonical row and whether it was newly
   * created. Matching prefers email over phone when both are supplied.
   */
  upsertContact(
    tenantId: string,
    input: UpsertContactInput
  ): Promise<{ contact: ContactRow; created: boolean }>;

  findContactById(tenantId: string, contactId: string): Promise<ContactRow | null>;

  linkContactToConversation(
    tenantId: string,
    input: LinkContactInput
  ): Promise<ConversationContactLinkRow>;
}

// ---------------------------------------------------------------------------
// Drizzle implementation
// ---------------------------------------------------------------------------

type DrizzleDb = typeof defaultDb;

export function createDrizzleContactsStore(
  db: DrizzleDb = defaultDb
): ContactsStore {
  return {
    async upsertContact(tenantId, input) {
      // Match precedence: email > phone. Both lookups are tenant-scoped via
      // the `contacts_tenant_email_idx` / `contacts_tenant_phone_idx`
      // indexes (see schema).
      let existing: ContactRow | null = null;
      if (input.emailNormalised) {
        const [row] = await db
          .select()
          .from(contacts)
          .where(
            and(
              eq(contacts.tenantId, tenantId),
              eq(contacts.emailNormalised, input.emailNormalised)
            )
          )
          .limit(1);
        existing = (row as ContactRow) ?? null;
      }
      if (!existing && input.phoneNormalised) {
        const [row] = await db
          .select()
          .from(contacts)
          .where(
            and(
              eq(contacts.tenantId, tenantId),
              eq(contacts.phoneNormalised, input.phoneNormalised)
            )
          )
          .limit(1);
        existing = (row as ContactRow) ?? null;
      }

      if (existing) {
        const now = new Date();
        // Idempotent merge: first-win for PII fields, last-write for
        // mutable preferences. attributes shallow-merge so callers can add
        // structured signals over time without clobbering prior keys.
        const mergedAttributes = {
          ...existing.attributes,
          ...(input.attributes ?? {}),
        };
        const [updated] = await db
          .update(contacts)
          .set({
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
          })
          .where(
            and(
              eq(contacts.tenantId, tenantId),
              eq(contacts.id, existing.id)
            )
          )
          .returning();
        return { contact: updated as ContactRow, created: false };
      }

      const [inserted] = await db
        .insert(contacts)
        .values({
          tenantId,
          displayName: input.displayName ?? null,
          emailNormalised: input.emailNormalised ?? null,
          phoneNormalised: input.phoneNormalised ?? null,
          preferredContactMethod: input.preferredContactMethod ?? null,
          attributes: input.attributes ?? {},
          consentState: input.consentState ?? null,
          privacyNoticeVersion: input.privacyNoticeVersion ?? null,
        })
        .returning();
      return { contact: inserted as ContactRow, created: true };
    },

    async findContactById(tenantId, contactId) {
      const [row] = await db
        .select()
        .from(contacts)
        .where(
          and(eq(contacts.tenantId, tenantId), eq(contacts.id, contactId))
        )
        .limit(1);
      return (row as ContactRow) ?? null;
    },

    async linkContactToConversation(tenantId, input) {
      // Composite PK (conversation_id, contact_id) — upsert as no-op so the
      // helper is idempotent. Always re-asserts tenantId in the WHERE so a
      // cross-tenant collision (defensive: not possible because the PK is
      // global) cannot mutate a link in another tenant's scope.
      const [row] = await db
        .insert(conversationContacts)
        .values({
          tenantId,
          conversationId: input.conversationId,
          contactId: input.contactId,
          relationship: input.relationship,
        })
        .onConflictDoUpdate({
          target: [
            conversationContacts.conversationId,
            conversationContacts.contactId,
          ],
          set: { relationship: input.relationship },
          setWhere: eq(conversationContacts.tenantId, tenantId),
        })
        .returning();
      return row as ConversationContactLinkRow;
    },
  };
}

// ---------------------------------------------------------------------------
// Default singleton
// ---------------------------------------------------------------------------

let defaultStore: ContactsStore | null = null;

export function getDefaultContactsStore(): ContactsStore {
  if (!defaultStore) {
    defaultStore = createDrizzleContactsStore();
  }
  return defaultStore;
}

export function setDefaultContactsStoreForTests(store: ContactsStore): void {
  defaultStore = store;
}

export function resetDefaultContactsStore(): void {
  defaultStore = null;
}
